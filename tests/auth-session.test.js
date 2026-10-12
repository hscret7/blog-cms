const test=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-module');
const reader={id:4,role:'READER',status:'ACTIVE',email_verified_at:new Date(),session_version:1};
function setup(user=reader,version=1){
 const middleware=load('src/middlewares/auth.js',{'../repositories/user-repository':{findById:async()=>user}});
 const state={next:false,destroy:false};const req={session:{userId:4,authVersion:version,destroy(cb){state.destroy=true;cb();}}};
 const res={locals:{},set(){},clearCookie(){},redirect(status,url){state.status=status;state.url=url;},status(status){state.status=status;return this;},json(){},render(){}};
 return{middleware,state,req,res,next(){state.next=true;}};
}
test('READER được đăng nhập nhưng không qua middleware quản lý bài/admin',async()=>{
 const a=setup();await a.middleware.requireAuth(a.req,a.res,a.next);assert.equal(a.state.next,true);
 a.state.next=false;a.middleware.requireRole('ADMIN','AUTHOR')(a.req,a.res,a.next);assert.equal(a.state.status,403);assert.equal(a.state.next,false);
});
test('Sau đổi mật khẩu, phiên cũ bị hủy và chuyển về đăng nhập',async()=>{
 const a=setup(reader,0);await a.middleware.requireAuth(a.req,a.res,a.next);
 assert.equal(a.state.destroy,true);assert.equal(a.state.url,'/login');assert.equal(a.state.next,false);
});
test('Tài khoản khóa không xuất hiện như người đăng nhập ở trang công khai',async()=>{
 const a=setup({...reader,status:'LOCKED'});await a.middleware.optionalAuth(a.req,a.res,a.next);
 assert.equal(a.req.user,undefined);assert.equal(a.state.next,true);
});
