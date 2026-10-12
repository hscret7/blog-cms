const pool = require('../config/database');
const activity = require('./activity-service');
const { validatePostId } = require('../validators/post-validator');
const fail = (status, message) => ({ success: false, status, message });
function validContent(value) { return typeof value === 'string' && Array.from(value.trim()).length >= 1 && Array.from(value.trim()).length <= 2000; }
function parseQuery(query = {}) {
  const page = query.page === undefined ? '1' : query.page;
  const q = query.q === undefined ? '' : query.q;
  const sort = query.sort === undefined ? 'newest' : query.sort;
  if (!validatePostId(page).isValid || typeof q !== 'string' || Array.from(q).length > 100 || !['newest','oldest'].includes(sort)) {
    const e = new Error('Tham số tìm kiếm hoặc phân trang không hợp lệ.'); e.status = 400; throw e;
  }
  return { page: Number(page), q: q.trim(), sort, status: query.status || '' };
}
function escapedLike(q) { return '%' + q.replace(/[!%_]/g, ch => '!' + ch) + '%'; }
async function pageRows(select, count, values, query) {
  const f = parseQuery(query);
  const [counts] = await pool.execute(count, values);
  const total = Number(counts[0].total); const totalPages = Math.max(1, Math.ceil(total / 10));
  f.page = Math.min(f.page, totalPages);
  const [rows] = await pool.execute(select + ` ORDER BY id ${f.sort === 'oldest' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`, [...values, 10, (f.page - 1) * 10]);
  return { rows, total, totalPages, filters: f };
}
async function comments(postId, query) {
  const f = parseQuery(query);
  const where = "c.post_id=? AND c.status='APPROVED' AND p.status='PUBLISHED'";
  return pageRows(`SELECT c.id,c.content,c.created_at,u.name,p.slug FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id WHERE ${where}`,
    `SELECT COUNT(*) total FROM comments c JOIN posts p ON p.id=c.post_id WHERE ${where}`, [postId], fToQuery(f));
}
function fToQuery(f) { return { ...f, page: String(f.page) }; }
async function list(actor, query, admin = false, authored = false) {
  const f = parseQuery(query); const values=[]; const terms=[];
  if (authored) { terms.push('p.author_id=?'); values.push(actor.id); }
  else if (!admin) { terms.push('c.user_id=?'); values.push(actor.id); }
  if (f.q) { terms.push("(c.content LIKE ? ESCAPE '!' OR p.title LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!')"); values.push(...Array(3).fill(escapedLike(f.q))); }
  if (f.status) {
    if (!['PENDING','APPROVED','HIDDEN'].includes(f.status)) { const e=new Error('Trạng thái bình luận không hợp lệ.');e.status=400;throw e; }
    terms.push('c.status=?'); values.push(f.status);
  }
  const where=terms.length ? terms.join(' AND ') : '1=1';
  const joins='comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id';
  return pageRows(`SELECT c.id,c.content,c.status,c.created_at,p.title,p.slug,u.name FROM ${joins} WHERE ${where}`, `SELECT COUNT(*) total FROM ${joins} WHERE ${where}`, values, fToQuery(f));
}
async function mutate(actor, operation, idText, input = {}) {
  const validation = validatePostId(idText);
  if (!validation.isValid) return fail(400, validation.error);
  if (['create','edit'].includes(operation) && !validContent(input.content)) return fail(422, 'Bình luận phải có từ 1 đến 2.000 ký tự.');
  return activity.withActor(actor, ['ADMIN','AUTHOR','READER'], async (c, current) => {
    if (!current.email_verified_at) return fail(403, 'Hãy xác minh email trước khi bình luận.');
    if (operation === 'create') {
      const [posts] = await c.execute("SELECT id FROM posts WHERE id=? AND status='PUBLISHED' FOR UPDATE", [validation.id]);
      if (!posts.length) return fail(404, 'Không tìm thấy bài viết.');
      const [result] = await c.execute("INSERT INTO comments(post_id,user_id,content,status) VALUES (?,?,?,'PENDING')", [validation.id,current.id,input.content.trim()]);
      await activity.record(c,current.id,'COMMENT_CREATE','comment',result.insertId);
      await c.execute(`INSERT INTO notifications(user_id,message,target_path) SELECT id,'Có bình luận mới chờ duyệt.','/admin/comments' FROM users WHERE role='ADMIN' AND status='ACTIVE'`);
      return { success:true, message:'Đã gửi bình luận, đang chờ quản trị viên duyệt.' };
    }
    // Luôn khóa bài trước bình luận, đồng bộ với quy trình xóa bài.
    const [candidate] = await c.execute('SELECT post_id FROM comments WHERE id=?', [validation.id]);
    if (!candidate.length) return fail(404,'Không tìm thấy bình luận.');
    const [posts] = await c.execute('SELECT id,author_id,slug,status FROM posts WHERE id=? FOR UPDATE',[candidate[0].post_id]);
    const [rows] = await c.execute('SELECT id,user_id,status FROM comments WHERE id=? FOR UPDATE',[validation.id]);
    const comment=rows[0];
    if (!posts[0] || !comment || (current.role !== 'ADMIN' && comment.user_id !== current.id)) return fail(404,'Không tìm thấy bình luận.');
    if (operation === 'edit') {
      if (comment.user_id !== current.id) return fail(403,'Chỉ người gửi được sửa nội dung bình luận.');
      await c.execute("UPDATE comments SET content=?,status='PENDING' WHERE id=?",[input.content.trim(),comment.id]);
      await c.execute(`INSERT INTO notifications(user_id,message,target_path) SELECT id,'Có bình luận sửa lại chờ duyệt.','/admin/comments' FROM users WHERE role='ADMIN' AND status='ACTIVE'`);
    } else if (operation === 'delete') await c.execute('DELETE FROM comments WHERE id=?',[comment.id]);
    else {
      if (current.role !== 'ADMIN' || !['APPROVED','HIDDEN'].includes(input.status)) return fail(403,'Bạn không có quyền kiểm duyệt.');
      await c.execute('UPDATE comments SET status=? WHERE id=?',[input.status,comment.id]);
      if (input.status === 'APPROVED' && comment.status !== 'APPROVED') {
        await activity.notify(c,comment.user_id,'Bình luận của bạn đã được duyệt.','/my/comments');
        await activity.notify(c,posts[0].author_id,'Bài viết của bạn có bình luận mới.','/posts/'+posts[0].slug);
      }
    }
    await activity.record(c,current.id,'COMMENT_'+operation.toUpperCase(),'comment',comment.id);
    return { success:true, message:'Đã cập nhật bình luận.' };
  });
}
async function notifications(actor, query) {
  const f=parseQuery(query); const unread=query.unread === '1';
  return pageRows('SELECT id,message,target_path,read_at,created_at FROM notifications WHERE user_id=?'+(unread?' AND read_at IS NULL':''),
    'SELECT COUNT(*) total FROM notifications WHERE user_id=?'+(unread?' AND read_at IS NULL':''),[actor.id],fToQuery(f));
}
async function markRead(actor,id) {
  if (id === 'all') await pool.execute('UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND read_at IS NULL',[actor.id]);
  else if (validatePostId(id).isValid) await pool.execute('UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?',[Number(id),actor.id]);
  else return fail(400,'ID thông báo không hợp lệ.');
  return { success:true };
}
async function follows(actor) {
  const [rows]=await pool.execute('SELECT c.id,c.name,(f.user_id IS NOT NULL) followed FROM categories c LEFT JOIN category_follows f ON f.category_id=c.id AND f.user_id=? ORDER BY c.name',[actor.id]);return rows;
}
async function follow(actor,id,enabled) {
  if (!validatePostId(id).isValid) return fail(400,'Danh mục không hợp lệ.');
  return activity.withActor(actor,['ADMIN','AUTHOR','READER'],async(c,user)=>{
    if (!user.email_verified_at) return fail(403,'Hãy xác minh email trước khi theo dõi chủ đề.');
    const [rows]=await c.execute('SELECT id FROM categories WHERE id=? FOR UPDATE',[Number(id)]);
    if (!rows.length) return fail(404,'Không tìm thấy danh mục.');
    if(enabled) await c.execute('INSERT IGNORE INTO category_follows(user_id,category_id) VALUES (?,?)',[user.id,Number(id)]);
    else await c.execute('DELETE FROM category_follows WHERE user_id=? AND category_id=?',[user.id,Number(id)]);
    return {success:true};
  });
}
async function audit(query) {
  const f=parseQuery(query);const terms=['1=1'];const values=[];
  for(const [param,column] of [['actor','a.actor_id'],['action','a.action'],['type','a.object_type']]) {
    if(query[param]) { if(typeof query[param]!=='string'||query[param].length>50){const e=new Error('Bộ lọc nhật ký không hợp lệ.');e.status=400;throw e;} terms.push(column+'=?');values.push(query[param]); }
  }
  for(const [param,operator] of [['from','>='],['to','<=']]) {
    if(query[param]) { if(typeof query[param]!=='string'||(!/^\d{4}-\d{2}-\d{2}$/.test(query[param]) || Number.isNaN(Date.parse(query[param])) || new Date(query[param]).toISOString().slice(0,10) !== query[param])){const e=new Error('Ngày lọc không hợp lệ.');e.status=400;throw e;}terms.push('a.created_at '+operator+' ?');values.push(query[param]+(param==='to'?' 23:59:59':' 00:00:00')); }
  }
  if(f.q){terms.push("(a.action LIKE ? ESCAPE '!' OR a.object_type LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!')");values.push(...Array(3).fill(escapedLike(f.q)));}
  const where=terms.join(' AND ');
  const data = await pageRows('SELECT a.id,a.actor_id,a.action,a.object_type,a.object_id,a.created_at,u.name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE '+where,
    'SELECT COUNT(*) total FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE '+where,values,fToQuery(f));
  const [actorOptions] = await pool.execute('SELECT DISTINCT u.id,u.name FROM users u JOIN audit_events a ON a.actor_id=u.id ORDER BY u.name,u.id');
  const [actionOptions] = await pool.execute('SELECT DISTINCT action FROM audit_events ORDER BY action');
  const [typeOptions] = await pool.execute('SELECT DISTINCT object_type FROM audit_events ORDER BY object_type');
  return { ...data, actorOptions, actionOptions, typeOptions };
}
module.exports={validContent,parseQuery,comments,list,mutate,notifications,markRead,follows,follow,audit};
