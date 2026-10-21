const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./helpers/load-module');
const verified = { id: 4, role: 'READER', status: 'ACTIVE', email_verified_at: new Date() };
function fixture(actor = verified, { owner = 4, published = true, commentStatus = 'APPROVED' } = {}) {
  const calls = [];
  const c = { async execute(sql, values = []) {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT post_id')) return [[{ post_id: 2 }]];
    if (sql.includes('FROM posts') && sql.includes('FOR UPDATE')) return [[...(published ? [{ id: 2, author_id: 3, slug: 'bai-thu', status: 'PUBLISHED' }] : [])]];
    if (sql.includes('FROM comments') && sql.includes('FOR UPDATE')) return [[{ id: 7, user_id: owner, status: commentStatus }]];
    if (sql.startsWith('SELECT COUNT')) return [[{ total: 11 }]];
    if (sql.startsWith('SELECT')) return [[]];
    return [{ insertId: 7, affectedRows: 1 }];
  } };
  const activity = { withActor: async (_, roles, action) => { assert.ok(roles.includes(actor.role)); return action(c, actor); }, record:async (db,...args)=>{ calls.push({ audit:args }); }, notify:async (db,...args)=>{ calls.push({ notify:args }); } };
  const service = load('src/services/community-service.js', { '../config/database': c, './activity-service': activity });
  return { service, calls };
}
test('Độc giả xác minh gửi bình luận PENDING, thông báo ADMIN và ghi nhật ký', async () => {
  const { service,calls }=fixture();assert.equal((await service.mutate(verified,'create','2',{content:'Bình luận'})).success,true);
  assert.ok(calls.some(c=>c.sql?.startsWith('INSERT INTO comments')&&c.values.at(-1)==='PENDING'));
  assert.ok(calls.some(c=>c.audit?.[1]==='COMMENT_CREATE'));
  assert.ok(calls.some(c=>c.sql?.startsWith('INSERT INTO notifications')));
});
test('Chưa xác minh hoặc bài nháp không được gửi bình luận',async()=>{
  const unverified={...verified,email_verified_at:null};const a=fixture(unverified),b=fixture(verified,{published:false});
  assert.equal((await a.service.mutate(unverified,'create','2',{content:'Thử'})).status,403);
  assert.equal((await b.service.mutate(verified,'create','2',{content:'Thử'})).status,404);
  assert.ok(!a.calls.some(c=>c.sql?.startsWith('INSERT')));assert.ok(!b.calls.some(c=>c.sql?.startsWith('INSERT')));
});
test('Độc giả không sửa, xóa hoặc kiểm duyệt bình luận của người khác',async()=>{
 for(const operation of ['edit','delete','moderate']) {
  const {service,calls}=fixture(verified,{owner:9});assert.equal((await service.mutate(verified,operation,'7',{content:'Sửa',status:'APPROVED'})).status,404);
  assert.ok(!calls.some(c=>c.sql?.startsWith('UPDATE')||c.sql?.startsWith('DELETE')));
 }
});
test('Sửa bình luận của mình phải quay về PENDING',async()=>{
 const {service,calls}=fixture();assert.equal((await service.mutate(verified,'edit','7',{content:'Nội dung mới'})).success,true);
 assert.ok(calls.some(c=>c.sql?.startsWith('UPDATE comments SET content') && c.values[1]==='PENDING'));
});
test('ADMIN duyệt bình luận gửi thông báo cho người gửi và tác giả',async()=>{
 const admin={...verified,id:3,role:'ADMIN'};const {service,calls}=fixture(admin,{commentStatus:'PENDING'});await service.mutate(admin,'moderate','7',{status:'APPROVED'});
 assert.equal(calls.filter(c=>c.notify).length,2);
 const repeated=fixture(admin);await repeated.service.mutate(admin,'moderate','7',{status:'APPROVED'});assert.equal(repeated.calls.filter(c=>c.notify).length,0);
});
test('Bình luận công khai chỉ lấy APPROVED trên bài PUBLISHED và chia 10/trang',async()=>{
 const {service,calls}=fixture();const result=await service.comments(2,{page:'2',sort:'oldest'});
 assert.equal(result.totalPages,2);assert.equal(result.filters.page,2);
 const query=calls.find(c=>c.sql?.includes('LIMIT ? OFFSET ?'));assert.match(query.sql,/APPROVED/);assert.match(query.sql,/PUBLISHED/);assert.match(query.sql,/ORDER BY c\.id ASC/);assert.deepEqual(Array.from(query.values.slice(-2)),[10,10]);
});
test('Thông báo đánh dấu đã đọc luôn giới hạn vào người đang đăng nhập',async()=>{
 const {service,calls}=fixture();await service.markRead(verified,'15');await service.markRead(verified,'all');
 for(const call of calls){assert.match(call.sql,/user_id=\?/);assert.equal(call.values.at(-1),verified.id);}
});
test('Từ khóa chứa wildcard được escape, payload lỗi bị chặn trước SQL',async()=>{
 const {service,calls}=fixture();await service.list(verified,{q:'%_!',page:'1'});
 assert.ok(calls.some(c=>c.values.includes('%!%!_!!%')));
 for(const query of [{page:['1']},{sort:'DROP TABLE comments'},{q:['x']},{page:'0'}]) assert.throws(()=>service.parseQuery(query),e=>e.status===400);
 for(const content of ['',[],null,'x'.repeat(2001)])assert.equal(service.validContent(content),false);
});
