const assert=require('node:assert/strict');const test=require('node:test');const {load}=require('./helpers/load-module');
const clientId='123-test.apps.googleusercontent.com',nonce='a'.repeat(64);
function fixture(options={}) {
 const state={used:false,commits:0,rollbacks:0,calls:[],user:options.user||null,links:options.links||[],existingEmail:options.existingEmail||false};let snapshot;
 const challenge={nonce,mode:options.mode||'LOGIN',userId:options.mode==='LINK'?4:null,authVersion:options.mode==='LINK'?1:null};
 const payload={aud:clientId,iss:'https://accounts.google.com',exp:Date.now()/1000+600,nonce,sub:'google-123',name:'Độc giả',email:'reader@gmail.com',email_verified:true,...options.payload};
 const c={beginTransaction:async()=>{snapshot={used:state.used,user:state.user,links:[...state.links]};},commit:async()=>{state.commits++;},rollback:async()=>{state.rollbacks++;Object.assign(state,snapshot);},release(){},async execute(sql,values=[]){
 state.calls.push({sql,values});
 if(sql.startsWith('SELECT mode'))return[[...(!state.used&&!options.expired?[{mode:challenge.mode,user_id:challenge.userId,auth_version:challenge.authVersion}]:[])]];
 if(sql.startsWith('UPDATE google_challenges')){state.used=true;return[{affectedRows:1}];}
 if(sql.startsWith('SELECT user_id FROM user_identities'))return[state.links];
 if(sql.startsWith('SELECT id FROM users WHERE email'))return[[...(state.existingEmail?[{id:4}]:[])]];
 if(sql.includes('FROM users WHERE id'))return[[...(state.user?[state.user]:[])]];
 if(sql.startsWith('INSERT INTO users')){state.user={id:11,name:payload.name,email:payload.email,role:'READER',status:'ACTIVE',email_verified_at:new Date(),session_version:0};return[{insertId:11}];}
 if(sql.startsWith('INSERT INTO user_identities')){state.links.push({user_id:values[0]});return[{affectedRows:1}];}
 if(sql.startsWith('SELECT subject'))return[[]];
 if(sql.startsWith('DELETE FROM user_identities'))return[{affectedRows:state.links.length}];
 return[{affectedRows:1}];}};
 const {createGoogleService}=load('src/services/google-service.js',{'../config/database':{},'./activity-service':{record:async(c,...values)=>{state.calls.push({audit:values});}}});
 const service=createGoogleService({db:{getConnection:async()=>c,execute:c.execute},env:{GOOGLE_CLIENT_ID:clientId},client:{verifyIdToken:async args=>{assert.equal(args.audience,clientId);if(options.badSignature)throw new Error('Invalid');return{getPayload:()=>payload};}},passwordVerifier:async(hash,pw)=>pw==='TEST_PASSWORD'});
 return{state,challenge,service};
}
test('Google mới tạo READER, không lưu credential/mật khẩu Google',async()=>{
 const f=fixture();const r=await f.service.complete('TEST_CREDENTIAL',f.challenge);assert.equal(r.success,true);assert.equal(r.user.role,'READER');
 const insert=f.state.calls.find(c=>c.sql?.startsWith('INSERT INTO users'));assert.match(insert.sql,/NULL,'READER','ACTIVE'/);assert.ok(!f.state.calls.some(c=>c.values?.includes('TEST_CREDENTIAL')));assert.equal(f.state.commits,1);
});
test('Token chữ ký sai, audience/issuer/nonce/hạn sai đều bị từ chối trước SQL',async()=>{
 const options=[{badSignature:true},{payload:{aud:'other'}},{payload:{iss:'evil.invalid'}},{payload:{nonce:'b'.repeat(64)}},{payload:{nonce:'😀'.repeat(32)}},{payload:{exp:1}},{payload:{email_verified:false}},{payload:{sub:'<invalid>'}}];
 for(const option of options){const f=fixture(option);assert.equal((await f.service.complete('TEST',f.challenge)).success,false);assert.equal(f.state.calls.length,0);}
});
test('Google challenge thành công không dùng lại được; challenge hết hạn bị chặn',async()=>{
 const f=fixture();await f.service.complete('TEST',f.challenge);assert.equal((await f.service.complete('TEST',f.challenge)).status,400);
 const expired=fixture({expired:true});assert.equal((await expired.service.complete('TEST',expired.challenge)).status,400);
});
test('Email đã tồn tại không tự gộp hoặc cấp phiên Google',async()=>{
 const f=fixture({existingEmail:true});const r=await f.service.complete('TEST',f.challenge);assert.equal(r.status,409);assert.ok(!r.user);assert.ok(!f.state.calls.some(c=>c.sql?.startsWith('INSERT INTO users')));
});
test('Google không mở khóa tài khoản website đã LOCKED',async()=>{
 const f=fixture({links:[{user_id:4}],user:{id:4,status:'LOCKED',role:'AUTHOR'}});assert.equal((await f.service.complete('TEST',f.challenge)).status,403);
});
test('Liên kết Google phải khớp phiên, tài khoản và email',async()=>{
 const actor={id:4,session_version:1},user={id:4,email:'reader@gmail.com',status:'ACTIVE',email_verified_at:new Date(),session_version:1};
 const ok=fixture({mode:'LINK',user});assert.equal((await ok.service.complete('TEST',ok.challenge,actor)).linked,true);
 const otherEmail=fixture({mode:'LINK',user:{...user,email:'other@gmail.com'}});assert.equal((await otherEmail.service.complete('TEST',otherEmail.challenge,actor)).status,409);
 const stale=fixture({mode:'LINK',user});assert.equal((await stale.service.complete('TEST',stale.challenge,{...actor,session_version:0})).status,403);
 const occupied=fixture({mode:'LINK',user,links:[{user_id:5}]});assert.equal((await occupied.service.complete('TEST',occupied.challenge,actor)).status,409);
});
test('Google third-party email không tự được xác minh trên website',async()=>{
 const f=fixture({payload:{email:'reader@example.invalid',hd:undefined}});const r=await f.service.complete('TEST',f.challenge);assert.equal(r.user.email_verified_at,null);
});
test('Không gỡ Google là phương thức đăng nhập duy nhất; gỡ cần đúng mật khẩu',async()=>{
 const actor={id:4,session_version:1};const user={id:4,status:'ACTIVE',session_version:1,password_hash:null};const only=fixture({user,links:[{user_id:4}]});assert.equal((await only.service.unlink(actor,'TEST_PASSWORD')).status,409);
 const wrong=fixture({user:{...user,password_hash:'TEST_HASH'},links:[{user_id:4}]});assert.equal((await wrong.service.unlink(actor,'wrong')).status,422);
 const ok=fixture({user:{...user,password_hash:'TEST_HASH'},links:[{user_id:4}]});assert.equal((await ok.service.unlink(actor,'TEST_PASSWORD')).success,true);assert.ok(ok.state.calls.some(c=>c.sql?.includes('session_version=session_version+1')));
});

test('Thư viện Google kiểm tra chữ ký RSA thật với khóa kiểm thử; token sửa bị chặn',async()=>{
 const crypto=require('node:crypto');const {OAuth2Client}=require('google-auth-library');
 const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});const client=new OAuth2Client();
 client.getFederatedSignonCertsAsync=async()=>({certs:{test:keys.publicKey.export({type:'spki',format:'pem'})}});
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url');
 const payload={aud:clientId,iss:'https://accounts.google.com',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,nonce,sub:'test-google-sub',name:'Độc giả',email:'reader@gmail.com',email_verified:true};
 const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');const body=header+'.'+encoded;const signature=crypto.sign('RSA-SHA256',Buffer.from(body),keys.privateKey).toString('base64url');
 const {createGoogleService}=load('src/services/google-service.js',{'../config/database':{},'./activity-service':{}});const service=createGoogleService({db:{},env:{GOOGLE_CLIENT_ID:clientId},client});
 assert.equal((await service.verifyCredential(body+'.'+signature,nonce)).success,true);
 const tampered=header+'.'+Buffer.from(JSON.stringify({...payload,sub:'other-sub'})).toString('base64url')+'.'+signature;assert.equal((await service.verifyCredential(tampered,nonce)).status,401);
});
