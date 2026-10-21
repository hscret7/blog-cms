const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-module');

function fixture() {
  const comments = new Map([
    [7, { id: 7, post_id: 5, user_id: 10, parent_id: null, status: 'APPROVED', is_deleted: 0 }],
    [8, { id: 8, post_id: 5, user_id: 11, parent_id: 7, reply_to_id: 7, status: 'APPROVED', is_deleted: 0 }]
  ]);
  const calls = [], notices = [];
  let nextId = 20;
  const db = { async execute(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('FROM posts') && sql.includes('FOR UPDATE')) return [[{ id: 5, author_id: 4, status: 'PUBLISHED', title: 'Bài thử' }]];
    if (sql.startsWith('SELECT post_id')) return [[{ post_id: 5 }]];
    if (sql.startsWith('SELECT id,user_id,parent_id FROM comments')) {
      const c = comments.get(values[0]);
      return [[...(c && c.post_id === values[1] && c.status === 'APPROVED' && !c.is_deleted ? [c] : [])]];
    }
    if (sql.startsWith('SELECT id FROM comments')) {
      const c = comments.get(values[0]);
      return [[...(c && c.post_id === values[1] && !c.parent_id && c.status === 'APPROVED' && !c.is_deleted ? [c] : [])]];
    }
    if (sql.startsWith('SELECT id,user_id,parent_id,status')) { const row=comments.get(values[0]); return [[...(row ? [{...row}] : [])]]; }
    if (sql.startsWith('SELECT user_id,status,is_deleted')) return [[comments.get(values[0])].filter(Boolean)];
    if (sql.startsWith('SELECT user_id FROM comments')) {
      const c = comments.get(values[0]);
      return [[...(c && c.post_id === values[1] && c.status === 'APPROVED' && !c.is_deleted ? [c] : [])]];
    }
    if (sql.startsWith('INSERT INTO comments')) {
      const [post_id,user_id,parent_id,reply_to_id,content,status] = values;
      const id = nextId++;
      comments.set(id, { id,post_id,user_id,parent_id,reply_to_id,content,status,is_deleted:0 });
      return [{ insertId: id }];
    }
    if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: [...comments.values()].filter(c => c.parent_id === values[0] || c.reply_to_id === values[1]).length }]];
    if (sql.startsWith('UPDATE comments SET status')) comments.get(values[1]).status = values[0];
    if (sql.startsWith("UPDATE comments SET content='',is_deleted=1")) comments.get(values[0]).is_deleted = 1;
    return [{ affectedRows: 1 }];
  } };
  const service = load('src/services/community-service.js', {
    '../config/database': db,
    './activity-service': { withActor: async (actor, roles, action) => action(db,actor), record: async () => {}, notify: async (_, ...args) => notices.push(args) }
  });
  return { service,comments,calls,notices };
}
const admin = { id:3,role:'ADMIN',email_verified_at:new Date() };
test('Trả lời một câu trả lời lưu đúng người nhận và cùng gốc, không tin root do client gửi', async () => {
  const f = fixture();
  const r = await f.service.mutate(admin,'create','5',{parent_id:'8',root_id:'999',content:'Trả lời B'});
  assert.equal(r.success,true);
  assert.equal(f.comments.get(r.id).parent_id,7);
  assert.equal(f.comments.get(r.id).reply_to_id,8);
  assert.deepEqual(f.notices.map(n=>n[0]),[4,11]);
  assert.ok(!f.notices.some(n=>n[0]===10 || n[0]===admin.id));
});
test('Chuỗi trả lời 40 lượt không bị giới hạn hai cấp và vẫn dùng chung gốc', async () => {
  const f=fixture();let target=8;
  for(let i=0;i<40;i++) {
    const r=await f.service.mutate(admin,'create','5',{parent_id:String(target),content:'Lượt '+i});
    assert.equal(r.success,true);
    assert.equal(f.comments.get(r.id).reply_to_id,target);
    assert.equal(f.comments.get(r.id).parent_id,7);
    target=r.id;
  }
});
test('Không trả lời đích khác bài, chờ duyệt, ẩn/xóa, hoặc gốc đã không hợp lệ', async () => {
  for(const change of [{post_id:9},{status:'PENDING'},{status:'HIDDEN'},{is_deleted:1}]) {
    const f=fixture();Object.assign(f.comments.get(8),change);
    assert.equal((await f.service.mutate(admin,'create','5',{parent_id:'8',content:'Thử'})).status,404);
    assert.ok(!f.calls.some(c=>c.sql.startsWith('INSERT INTO comments')));
  }
  for(const change of [{post_id:9},{status:'HIDDEN'},{is_deleted:1}]) {
    const f=fixture();Object.assign(f.comments.get(7),change);
    assert.equal((await f.service.mutate(admin,'create','5',{parent_id:'8',content:'Thử'})).status,404);
  }
});
test('Trả lời chờ duyệt chỉ báo người được trả lời sau khi ADMIN duyệt', async () => {
  const f=fixture();const reader={id:9,role:'READER',email_verified_at:new Date()};
  const r=await f.service.mutate(reader,'create','5',{parent_id:'8',content:'Đợi duyệt'});
  assert.equal(r.status,'PENDING');assert.equal(f.notices.length,0);
  await f.service.mutate(admin,'moderate',String(r.id),{status:'APPROVED'});
  assert.deepEqual(f.notices.map(n=>n[0]),[9,4,11]);
  assert.ok(!f.notices.some(n=>n[0]===10));
});
test('Xóa câu trả lời đã có người trả lời tiếp giữ tombstone và cuộc trao đổi', async () => {
  const f=fixture();await f.service.mutate(admin,'create','5',{parent_id:'8',content:'Tiếp'});
  assert.equal((await f.service.mutate(admin,'delete','8')).success,true);
  assert.equal(f.comments.get(8).is_deleted,1);
  assert.ok(!f.calls.some(c=>c.sql.startsWith('DELETE FROM comments')));
});
test('Cùng là tác giả bài và người được trả lời chỉ nhận một thông báo', async () => {
  const f=fixture();f.comments.get(8).user_id=4;
  await f.service.mutate(admin,'create','5',{parent_id:'8',content:'Tiếp'});
  assert.deepEqual(f.notices.map(n=>n[0]),[4]);
});
