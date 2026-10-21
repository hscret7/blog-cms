const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/database');
const activity = require('./activity-service');
const { verifyPassword } = require('./password-service');
const { validateUserInput } = require('../validators/user-validator');
const fail=(status,message)=>({success:false,status,message});
const digest=value=>createHash('sha256').update(value).digest('hex');
function settings(env=process.env) {
  const clientId=env.GOOGLE_CLIENT_ID || '';
  if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)){const error=new Error('Đăng nhập Google chưa được cấu hình.');error.status=503;throw error;}
  return {clientId};
}
function createGoogleService({db=pool,env=process.env,client=new OAuth2Client(),passwordVerifier=verifyPassword}={}) {
  async function transaction(action) {
    const c=await db.getConnection();try{await c.beginTransaction();const result=await action(c);if(result.success)await c.commit();else await c.rollback();return result;}
    catch(error){await c.rollback();if(error.code==='ER_DUP_ENTRY')return fail(409,'Tài khoản hoặc liên kết đã thay đổi. Hãy tải lại trang.');throw error;}finally{c.release();}
  }
  async function issue(mode,user=null) {
    const {clientId}=settings(env),nonce=randomBytes(32).toString('hex');
    await db.execute('INSERT INTO google_challenges(nonce_hash,mode,user_id,auth_version,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))',[digest(nonce),mode,user?.id||null,user?.session_version??null]);
    return {clientId,nonce,mode,userId:user?.id||null,authVersion:user?.session_version??null};
  }
  async function verifyCredential(credential,nonce) {
    const {clientId}=settings(env);
    if(typeof credential!=='string'||credential.length>12000||typeof nonce!=='string'||!/^[a-f0-9]{64}$/.test(nonce))return fail(400,'Thông tin đăng nhập Google không hợp lệ.');
    let payload;try{payload=(await client.verifyIdToken({idToken:credential,audience:clientId})).getPayload();}catch{return fail(401,'Không xác minh được đăng nhập Google. Hãy thử lại.');}
    if(!payload||payload.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||!Number.isFinite(payload.exp)||payload.exp<=Date.now()/1000||typeof payload.nonce!=='string'||!/^[a-f0-9]{64}$/.test(payload.nonce)||!timingSafeEqual(Buffer.from(payload.nonce),Buffer.from(nonce))||typeof payload.sub!=='string'||!/^[A-Za-z0-9_-]{1,255}$/.test(payload.sub)||payload.email_verified!==true)return fail(401,'Thông tin Google đã hết hạn hoặc không khớp yêu cầu.');
    const data=validateUserInput({name:typeof payload.name==='string' && payload.name.trim() ?Array.from(payload.name).slice(0,100).join(''):'Độc giả Google',email:payload.email,role:'READER'});
    if(!data.isValid)return fail(422,'Thông tin tên/email Google không hợp lệ.');
    const authoritative=data.data.email.endsWith('@gmail.com') || (typeof payload.hd==='string'&&payload.hd.length>0);
    return {success:true,identity:{subject:payload.sub,...data.data,authoritative}};
  }
  async function complete(credential,challenge,actor=null) {
    if(!challenge||!['LOGIN','LINK'].includes(challenge.mode))return fail(400,'Hãy mở lại trang đăng nhập Google.');
    const verified=await verifyCredential(credential,challenge.nonce);if(!verified.success)return verified;
    const identity=verified.identity;
    return transaction(async c=>{
      const [challenges]=await c.execute('SELECT mode,user_id,auth_version FROM google_challenges WHERE nonce_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[digest(challenge.nonce)]);
      const row=challenges[0];if(!row||row.mode!==challenge.mode||row.user_id!==challenge.userId||row.auth_version!==challenge.authVersion)return fail(400,'Yêu cầu Google đã dùng hoặc hết hạn.');
      // A successful commit consumes the challenge under a row lock.
      await c.execute('UPDATE google_challenges SET used_at=UTC_TIMESTAMP() WHERE nonce_hash=?',[digest(challenge.nonce)]);
      const [linked]=await c.execute("SELECT user_id FROM user_identities WHERE provider='GOOGLE' AND subject=?",[identity.subject]);
      if(challenge.mode==='LINK') {
        if(!actor||actor.id!==challenge.userId||actor.session_version!==challenge.authVersion)return fail(403,'Phiên liên kết tài khoản không còn hợp lệ.');
        const [users]=await c.execute('SELECT id,email,status,email_verified_at,session_version FROM users WHERE id=? FOR UPDATE',[actor.id]);
        const user=users[0];if(!user||user.status!=='ACTIVE'||!user.email_verified_at||user.session_version!==challenge.authVersion)return fail(403,'Tài khoản không còn cho phép liên kết.');
        if(user.email!==identity.email)return fail(409,'Hãy chọn tài khoản Google có cùng email với tài khoản website.');
        if(linked.length&&linked[0].user_id!==user.id)return fail(409,'Tài khoản Google đã liên kết với người dùng khác.');
        const [existing]=await c.execute("SELECT subject FROM user_identities WHERE user_id=? AND provider='GOOGLE' FOR UPDATE",[user.id]);
        if(existing.length)return fail(409,'Tài khoản đã có liên kết Google.');
        await c.execute("INSERT INTO user_identities(user_id,provider,subject) VALUES (?,'GOOGLE',?)",[user.id,identity.subject]);
        await activity.record(c,user.id,'GOOGLE_LINK','user',user.id);
        return {success:true,linked:true,message:'Đã liên kết Google với tài khoản hiện có.'};
      }
      let user;
      if(linked.length) {
        const [users]=await c.execute('SELECT id,name,email,role,status,email_verified_at,session_version FROM users WHERE id=? FOR UPDATE',[linked[0].user_id]);user=users[0];
        if(!user||user.status!=='ACTIVE'||!['ADMIN','AUTHOR','READER'].includes(user.role))return fail(403,'Tài khoản website không hoạt động.');
      }else{
        const [existing]=await c.execute('SELECT id FROM users WHERE email=? FOR UPDATE',[identity.email]);
        if(existing.length)return fail(409,'Email đã có tài khoản website. Đăng nhập tài khoản đó rồi vào Tài khoản → Liên kết Google.');
        const [insert]=await c.execute("INSERT INTO users(name,email,password_hash,role,status,email_verified_at) VALUES (?,?,NULL,'READER','ACTIVE',?)",[identity.name,identity.email,identity.authoritative?new Date():null]);
        await c.execute("INSERT INTO user_identities(user_id,provider,subject) VALUES (?,'GOOGLE',?)",[insert.insertId,identity.subject]);
        user={id:insert.insertId,name:identity.name,email:identity.email,role:'READER',status:'ACTIVE',email_verified_at:identity.authoritative?new Date():null,session_version:0};
        await activity.record(c,user.id,'GOOGLE_REGISTER','user',user.id);
      }
      await activity.record(c,user.id,'GOOGLE_LOGIN','user',user.id);
      return {success:true,user};
    });
  }
  async function linked(actor){const [rows]=await db.execute("SELECT provider,created_at FROM user_identities WHERE user_id=? AND provider='GOOGLE'",[actor.id]);return rows[0]||null;}
  async function confirmLocal(actor,password){
    const [rows]=await db.execute("SELECT password_hash FROM users WHERE id=? AND status='ACTIVE' AND session_version=?",[actor.id,actor.session_version]);
    return !!rows[0]?.password_hash && await passwordVerifier(rows[0].password_hash,password);
  }
  async function unlink(actor,password){
    return transaction(async c=>{
      const [rows]=await c.execute("SELECT password_hash,status,session_version FROM users WHERE id=? FOR UPDATE",[actor.id]);
      const user=rows[0];if(!user||user.status!=='ACTIVE'||user.session_version!==actor.session_version)return fail(403,'Phiên không còn hợp lệ.');
      if(!user.password_hash)return fail(409,'Google là cách đăng nhập duy nhất. Hãy đặt mật khẩu qua email trước khi gỡ.');
      if(!await passwordVerifier(user.password_hash,password))return fail(422,'Mật khẩu website hiện tại không đúng.');
      const [result]=await c.execute("DELETE FROM user_identities WHERE user_id=? AND provider='GOOGLE'",[actor.id]);
      if(result.affectedRows===0)return fail(404,'Không có liên kết Google.');
      await c.execute('UPDATE users SET session_version=session_version+1 WHERE id=?',[actor.id]);
      await activity.record(c,actor.id,'GOOGLE_UNLINK','user',actor.id);
      return {success:true,message:'Đã gỡ liên kết Google. Hãy đăng nhập lại bằng mật khẩu website.'};
    });
  }
  return {issue,verifyCredential,complete,linked,confirmLocal,unlink};
}
module.exports={settings,createGoogleService,...createGoogleService()};
