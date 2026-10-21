const assert=require('node:assert/strict'),test=require('node:test'),express=require('express'),path=require('node:path');
const {createLoginRateLimiter}=require('../src/middlewares/login-rate-limit');
test('Giới hạn đăng nhập trả giao diện và thời gian chờ cho trình duyệt',async(t)=>{
 const limiter=createLoginRateLimiter({limit:1,windowMs:60000});const app=express();app.set('view engine','ejs');app.set('views',path.resolve(__dirname,'../views'));app.post('/login',limiter,(req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{limiter.store.shutdown();return new Promise(r=>server.close(r));});const url='http://127.0.0.1:'+server.address().port+'/login';
 let response=await fetch(url,{method:'POST',headers:{Accept:'text/html'}});assert.equal(response.status,200);await response.text();
 response=await fetch(url,{method:'POST',headers:{Accept:'text/html'}});assert.equal(response.status,429);assert.ok(response.headers.get('retry-after'));const html=await response.text();assert.match(html,/data-retry-after=/);assert.match(html,/href="\/login"/);assert.match(html,/Vui lòng chờ/);
});
