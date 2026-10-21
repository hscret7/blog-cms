const assert=require('node:assert/strict');const test=require('node:test');const argon2=require('argon2');const {load}=require('./helpers/load-module');
test('Đăng nhập chấp nhận mật khẩu 8 ký tự đã băm, chặn dưới 8',async()=>{
 const password='Aa1!aaaa',hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
 const service=load('src/services/auth-service.js',{'../repositories/user-repository':{findByEmail:async()=>({id:4,password_hash:hash,role:'READER',status:'ACTIVE',session_version:1})}});
 assert.equal((await service.authenticate('reader@example.invalid',password)).id,4);assert.equal(await service.authenticate('reader@example.invalid','Aa1!aaa'),null);
});
test('Đăng nhập không áp dụng lại composition policy lên mật khẩu cũ',async()=>{
 const password='legacy password',hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
 const service=load('src/services/auth-service.js',{'../repositories/user-repository':{findByEmail:async()=>({id:4,password_hash:hash,role:'AUTHOR',status:'ACTIVE',session_version:0})}});
 assert.equal((await service.authenticate('reader@example.invalid',password)).id,4);
});
