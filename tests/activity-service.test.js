const test=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-module');
function fixture(user={id:4,role:'AUTHOR',status:'ACTIVE',email_verified_at:new Date()}) {
 const state={commit:0,rollback:0,release:0,calls:[]};
 const c={beginTransaction:async()=>{},commit:async()=>{state.commit++;},rollback:async()=>{state.rollback++;},release(){state.release++;},execute:async(sql,values=[])=>{state.calls.push({sql,values});if(sql.startsWith('SELECT id,role'))return[[user]];if(sql.startsWith('SELECT category_id'))return[[{category_id:2,slug:'bai-thu',author_id:4}]];return[{affectedRows:1}];}};
 const activity=load('src/services/activity-service.js',{'../config/database':{getConnection:async()=>c}});return{activity,state,c};
}
test('Lưu dữ liệu và nhật ký trong cùng transaction; lỗi ghi nhật ký rollback',async()=>{
 const {activity,state,c}=fixture();c.execute=async(sql)=>{state.calls.push({sql});if(sql.startsWith('SELECT id,role'))return[[{id:4,role:'AUTHOR',status:'ACTIVE'}]];if(sql.startsWith('INSERT INTO audit'))throw new Error('audit unavailable');return[{affectedRows:1}];};
 await assert.rejects(()=>activity.withActor({id:4},['AUTHOR'],async tx=>{await tx.execute('UPDATE posts SET title = ?',['Thử']);await activity.record(tx,4,'POST_UPDATE','post',2);}));
 assert.equal(state.commit,0);assert.equal(state.rollback,1);assert.equal(state.release,1);
});
test('Re-check trạng thái và vai trò dưới khóa trước thay đổi dữ liệu',async()=>{
 for(const user of [{id:4,role:'READER',status:'ACTIVE'},{id:4,role:'AUTHOR',status:'LOCKED'}]){
  const {activity,state}=fixture(user);let called=false;await assert.rejects(()=>activity.withActor({id:4},['AUTHOR'],async()=>{called=true;}),e=>e.status===403);assert.equal(called,false);assert.equal(state.rollback,1);
 }
});
test('Kết quả nghiệp vụ thất bại rollback thay vì commit',async()=>{
 const {activity,state}=fixture();await activity.withActor({id:4},['AUTHOR'],async()=>({success:false,status:404}));assert.equal(state.commit,0);assert.equal(state.rollback,1);
});
test('Thông báo xuất bản chỉ gửi người theo dõi đang hoạt động và xác minh',async()=>{
 const {activity,state,c}=fixture();await activity.published(c,2);const insert=state.calls.find(c=>c.sql.startsWith('INSERT INTO notifications'));
 assert.match(insert.sql,/category_follows/);assert.match(insert.sql,/email_verified_at IS NOT NULL/);assert.match(insert.sql,/status='ACTIVE'/);assert.match(insert.sql,/f.user_id<>\?/);assert.equal(insert.values[0],'/posts/bai-thu');
});
test('Từ chối đường dẫn thông báo bên ngoài',async()=>{
 const {activity,c}=fixture();for(const url of ['https://example.org','//example.org'])await assert.rejects(()=>activity.notify(c,4,'Thử',url));
});
