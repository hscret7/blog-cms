const assert=require('node:assert/strict');const test=require('node:test');const {load}=require('./helpers/load-module');
function fixture({current={id:4,role:'READER',email_verified_at:new Date()},target={id:4,role:'READER',status:'ACTIVE',email_verified_at:new Date()},status=null}={}){
 const calls=[];const c={async execute(sql,values=[]){calls.push({sql,values});if(sql.startsWith('SELECT status FROM author_requests'))return[[...(status?[{status}]:[])]];if(sql.startsWith('SELECT id,role,status'))return[[target]];return[{affectedRows:1}];}};
 const activity={withActor:async(_,roles,fn)=>{if(!roles.includes(current.role))throw Object.assign(new Error('Denied'),{status:403});return fn(c,current);},record:async()=>{},notify:async()=>{}};
 const service=load('src/services/author-request-service.js',{'../config/database':c,'./activity-service':activity});return{calls,service,current};
}
test('Xin quyền tác giả chỉ tạo yêu cầu, không tự đổi vai trò',async()=>{
 const f=fixture();assert.equal((await f.service.request(f.current,'Viết về công nghệ')).success,true);assert.ok(f.calls.some(c=>c.sql.startsWith('INSERT INTO author_requests')));assert.ok(!f.calls.some(c=>c.sql.startsWith('UPDATE users')));
});
test('Độc giả chưa xác minh và yêu cầu đang pending không gửi lại được',async()=>{
 const a=fixture({current:{id:4,role:'READER',email_verified_at:null}});assert.equal((await a.service.request(a.current,'Viết')).status,403);
 const b=fixture({status:'PENDING'});assert.equal((await b.service.request(b.current,'Viết')).status,409);
});
test('ADMIN duyệt đúng độc giả hoạt động/xác minh thành AUTHOR',async()=>{
 const f=fixture({current:{id:3,role:'ADMIN'},status:'PENDING'});assert.equal((await f.service.review(f.current,'4',{status:'APPROVED',note:''})).success,true);assert.ok(f.calls.some(c=>c.sql.includes("SET role='AUTHOR'")));
});
test('Không cấp AUTHOR cho tài khoản khóa hoặc đang ADMIN, không xử lý lại yêu cầu',async()=>{
 for(const target of [{id:4,role:'READER',status:'LOCKED',email_verified_at:new Date()},{id:4,role:'ADMIN',status:'ACTIVE',email_verified_at:new Date()}]){
 const f=fixture({current:{id:3,role:'ADMIN'},status:'PENDING',target});assert.equal((await f.service.review(f.current,'4',{status:'APPROVED',note:''})).status,409);assert.ok(!f.calls.some(c=>c.sql.startsWith('UPDATE users')));
 }
 const f=fixture({current:{id:3,role:'ADMIN'},status:'APPROVED'});assert.equal((await f.service.review(f.current,'4',{status:'APPROVED',note:''})).status,409);
});
test('Từ chối cần lý do; thao tác review không cho người đọc tự duyệt',async()=>{
 const f=fixture();assert.equal((await f.service.review(f.current,'4',{status:'REJECTED',note:''})).status,422);await assert.rejects(()=>f.service.review(f.current,'4',{status:'APPROVED',note:''}),e=>e.status===403);
});
