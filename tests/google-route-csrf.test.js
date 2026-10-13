const assert=require('node:assert/strict'),test=require('node:test'),express=require('express');const {load}=require('./helpers/load-module');
test('Google callback/link/unlink dùng CSRF thật; không gọi controller khi thiếu token',async(t)=>{
 let called=0;const ok=(req,res)=>{called++;res.json({ok:true});};const noop=(req,res,next)=>next();
 const router=load('src/routes/google-routes.js',{'../middlewares/auth':{requireAuth:noop,requireVerified:noop},'../controllers/google-controller':{start:ok,complete:ok,settings:ok,link:ok,unlink:ok}});
 const app=express();app.use((req,res,next)=>{req.session={csrfToken:'a'.repeat(64)};next();});app.use(router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 for(const url of ['/auth/google/complete','/account/google/link','/account/google/unlink']){
 const json=url.endsWith('/complete');const headers={'Content-Type':json?'application/json':'application/x-www-form-urlencoded'};
 const wrong=await fetch(base+url,{method:'POST',headers,body:json?JSON.stringify({credential:'TEST'}):'current_password=TEST'});assert.equal(wrong.status,403);await wrong.text();
 const good=await fetch(base+url,{method:'POST',headers,body:json?JSON.stringify({_csrf:'a'.repeat(64),credential:'TEST'}):'_csrf='+'a'.repeat(64)+'&current_password=TEST'});assert.equal(good.status,200);await good.text();
 }
 assert.equal(called,3);
});
