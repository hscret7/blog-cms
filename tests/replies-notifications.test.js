const assert=require('node:assert/strict');const test=require('node:test');const {load}=require('./helpers/load-module');
function fixture({actor={id:4,role:'READER',email_verified_at:new Date()},parent=true,children=0,comment=null,destination=null}={}){
 const calls=[];const c={async execute(sql,values=[]){calls.push({sql,values});
 if(sql.startsWith('SELECT post_id'))return[[{post_id:2}]];
 if(sql.includes('FROM posts')&&sql.includes('FOR UPDATE'))return[[{id:2,author_id:4,title:'Bài thử',slug:'bai-thu',status:'PUBLISHED'}]];
 if(sql.startsWith('SELECT id,user_id,parent_id FROM comments'))return[[...(parent?[{id:7,user_id:5,parent_id:null}]:[])]];
 if(sql.includes('FROM comments WHERE id=? FOR UPDATE'))return[[{id:7,user_id:actor.id,parent_id:null,status:'APPROVED',is_deleted:0,...comment}]];
 if(sql.startsWith('SELECT COUNT'))return[[{total:children}]];
 if(sql.startsWith('SELECT c.id,c.user_id,c.parent_id'))return[[...(destination?[destination]:[])]];
 if(sql.startsWith('SELECT'))return[[]];return[{insertId:8,affectedRows:1}];}};
 const activity={withActor:async(_,roles,fn)=>fn(c,actor),record:async(_, ...values)=>calls.push({audit:values}),notify:async(_,...values)=>calls.push({notification:values})};
 const service=load('src/services/community-service.js',{'../config/database':c,'./activity-service':activity});return{calls,service,actor};
}
test('ADMIN và AUTHOR trên bài của mình được duyệt ngay; AUTHOR khác/READER chờ',async()=>{
 for(const [actor,expected]of [[{id:3,role:'ADMIN'},'APPROVED'],[{id:4,role:'AUTHOR'},'APPROVED'],[{id:9,role:'AUTHOR'},'PENDING'],[{id:4,role:'READER'},'PENDING']]){
 const f=fixture({actor:{...actor,email_verified_at:new Date()}});await f.service.mutate(f.actor,'create','2',{content:'Thử'});assert.equal(f.calls.find(c=>c.sql?.startsWith('INSERT INTO comments')).values.at(-1),expected);
 }
});
test('Trả lời bình luận đã duyệt cùng bài; giữ đúng gốc và đích trả lời',async()=>{
 const f=fixture();assert.equal((await f.service.mutate(f.actor,'create','2',{content:'Trả lời',parent_id:'7'})).success,true);const parent=f.calls.find(c=>c.sql?.startsWith('SELECT id,user_id,parent_id FROM comments'));assert.match(parent.sql,/post_id=\?/);assert.equal(parent.values[1],2);
 const insert=f.calls.find(c=>c.sql?.startsWith('INSERT INTO comments'));assert.equal(insert.values[2],7);assert.equal(insert.values[3],7);
 const hidden=fixture({parent:false});assert.equal((await hidden.service.mutate(hidden.actor,'create','2',{content:'Trả lời',parent_id:'7'})).status,404);assert.ok(!hidden.calls.some(c=>c.sql?.startsWith('INSERT INTO comments')));
});
test('Xóa bình luận gốc có trả lời giữ tombstone, không xóa cuộc trao đổi',async()=>{
 const f=fixture({children:3});assert.equal((await f.service.mutate(f.actor,'delete','7')).success,true);assert.ok(f.calls.some(c=>c.sql?.includes('is_deleted=1')));assert.ok(!f.calls.some(c=>c.sql?.startsWith('DELETE FROM comments')));
});
test('Thông báo chờ duyệt gắn tên bài và ID bình luận chính xác',async()=>{
 const f=fixture();await f.service.mutate(f.actor,'create','2',{content:'Thử'});const notice=f.calls.find(c=>c.sql?.startsWith('INSERT INTO notifications'));assert.match(notice.values[0],/Bài thử/);assert.equal(notice.values[1],'/comments/8/go');assert.equal(notice.values[2],8);
});
test('Link câu trả lời chọn đúng trang, link pending không lộ cho người khác',async()=>{
 const d={id:25,user_id:4,parent_id:7,status:'APPROVED',is_deleted:0,author_id:9,slug:'bai-thu',post_status:'PUBLISHED',root_status:'APPROVED'};
 const f=fixture({destination:d,children:21});assert.equal((await f.service.commentDestination('25',null)).path,'/posts/bai-thu/comments/7?page=3#comment-25');
 const pending=fixture({destination:{...d,status:'PENDING'}});assert.equal((await pending.service.commentDestination('25',{id:5,role:'READER'})).status,404);assert.equal((await pending.service.commentDestination('25',{id:4,role:'READER'})).path,'/my/comments?comment=25#comment-25');
});
test('Ẩn thông báo chỉ tác động thông báo của người hiện tại',async()=>{
 const f=fixture();await f.service.hideNotification(f.actor,'7',true);const update=f.calls[0];assert.match(update.sql,/WHERE id=\? AND user_id=\?/);assert.equal(update.values[1],f.actor.id);
});
test('Bình luận đã xóa trả thông báo rõ; ADMIN mở đúng mục kiểm duyệt',async()=>{
 const deleted=fixture({destination:{id:7,is_deleted:1}});assert.equal((await deleted.service.commentDestination('7',null)).status,410);
 const pending=fixture({destination:{id:7,is_deleted:0,status:'PENDING'}});assert.equal((await pending.service.commentDestination('7',{id:3,role:'ADMIN'})).path,'/admin/comments?comment=7#comment-7');
});

