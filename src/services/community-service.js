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
async function pageRows(select, count, values, query, orderColumn = 'c.id') {
  const f = parseQuery(query);
  const [counts] = await pool.execute(count, values);
  const total = Number(counts[0].total); const totalPages = Math.max(1, Math.ceil(total / 10));
  f.page = Math.min(f.page, totalPages);
  const [rows] = await pool.execute(select + ` ORDER BY ${orderColumn} ${f.sort === 'oldest' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`, [...values, 10, (f.page - 1) * 10]);
  return { rows, total, totalPages, filters: f };
}
async function comments(postId, query) {
  const f = parseQuery(query);
  const where = "c.post_id=? AND c.parent_id IS NULL AND c.status='APPROVED' AND p.status='PUBLISHED'";
  const data = await pageRows(`SELECT c.id,c.content,c.created_at,c.is_deleted,u.name,p.slug FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id WHERE ${where}`,
    `SELECT COUNT(*) total FROM comments c JOIN posts p ON p.id=c.post_id WHERE ${where}`, [postId], fToQuery(f));
  for (const root of data.rows) {
    const [counts] = await pool.execute("SELECT COUNT(*) total FROM comments WHERE parent_id=? AND status='APPROVED' AND is_deleted=0", [root.id]);
    const [replies] = await pool.execute("SELECT c.id,c.content,c.created_at,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.parent_id=? AND c.status='APPROVED' AND c.is_deleted=0 ORDER BY c.id ASC LIMIT 5", [root.id]);
    root.replies = replies; root.reply_count = Number(counts[0].total);
  }
  return data;
}
async function thread(postId, rootId, query = {}) {
  if (!validatePostId(String(rootId)).isValid) return fail(400, 'ID bình luận không hợp lệ.');
  const [roots] = await pool.execute("SELECT c.id,c.content,c.created_at,c.is_deleted,u.name,p.slug FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.post_id=? AND c.parent_id IS NULL AND c.status='APPROVED' AND p.status='PUBLISHED'", [Number(rootId), postId]);
  if (!roots.length) return fail(404, 'Cuộc trao đổi không còn hiển thị công khai.');
  const data = await pageRows("SELECT c.id,c.content,c.created_at,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.parent_id=? AND c.status='APPROVED' AND c.is_deleted=0",
    "SELECT COUNT(*) total FROM comments WHERE parent_id=? AND status='APPROVED' AND is_deleted=0", [Number(rootId)], { ...query, sort: 'oldest' });
  return { success:true, root:roots[0], ...data };
}
function autoApproved(actor, post) { return actor.role === 'ADMIN' || (actor.role === 'AUTHOR' && actor.id === post.author_id); }
async function notifyComment(c, actor, post, comment, parent = null, edited = false) {
  const path = '/comments/' + comment.id + '/go';
  const title = post.title || 'bài viết';
  if (comment.status === 'PENDING') {
    await c.execute(`INSERT INTO notifications(user_id,message,target_path,comment_id)
      SELECT id,?,?,? FROM users WHERE role='ADMIN' AND status='ACTIVE' AND id<>?`,
      [Array.from((edited ? 'Bình luận đã chỉnh sửa, cần duyệt lại trên bài “' : 'Có bình luận chờ duyệt trên bài “') + title + '”.').slice(0,300).join(''), path, comment.id, actor.id]);
    return;
  }
  const recipients = new Map();
  if (post.author_id !== actor.id) recipients.set(post.author_id, 'Bài “' + title + (edited ? '” có bình luận đã chỉnh sửa.' : '” có bình luận mới.'));
  if (parent && parent.user_id !== actor.id) recipients.set(parent.user_id, (edited ? 'Câu trả lời cho bình luận của bạn đã chỉnh sửa trên bài “' : 'Có trả lời bình luận của bạn trên bài “') + title + '”.');
  for (const [id,message] of recipients) await activity.notify(c, id, message, path, comment.id);
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
  if (query.comment) { if (!validatePostId(query.comment).isValid) { const e=new Error('ID bình luận không hợp lệ.');e.status=400;throw e; } terms.push('c.id=?');values.push(Number(query.comment)); }
  terms.push('c.is_deleted=0');
  const joins='comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id';
  const where=terms.join(' AND ');
  return pageRows(`SELECT c.id,c.parent_id,c.content,c.status,c.created_at,p.title,p.slug,u.name FROM ${joins} WHERE ${where}`, `SELECT COUNT(*) total FROM ${joins} WHERE ${where}`, values, fToQuery(f));
}
async function mutate(actor, operation, idText, input = {}) {
  const validation = validatePostId(idText);
  if (!validation.isValid) return fail(400, validation.error);
  if (!['create','edit','delete','moderate'].includes(operation)) return fail(400, 'Thao tác không hợp lệ.');
  if (['create','edit'].includes(operation) && !validContent(input.content)) return fail(422, 'Bình luận phải có từ 1 đến 2.000 ký tự.');
  return activity.withActor(actor, ['ADMIN','AUTHOR','READER'], async (c, current) => {
    if (!current.email_verified_at) return fail(403, 'Hãy xác minh email trước khi bình luận.');
    if (operation === 'create') {
      const [posts] = await c.execute("SELECT id,author_id,title,slug FROM posts WHERE id=? AND status='PUBLISHED' FOR UPDATE", [validation.id]);
      const post = posts[0]; if (!post) return fail(404, 'Không tìm thấy bài viết.');
      let parent = null;
      if (input.parent_id !== undefined && input.parent_id !== '') {
        if (!validatePostId(input.parent_id).isValid) return fail(400, 'Bình luận gốc không hợp lệ.');
        const [parents] = await c.execute("SELECT id,user_id FROM comments WHERE id=? AND post_id=? AND parent_id IS NULL AND status='APPROVED' AND is_deleted=0 FOR UPDATE", [Number(input.parent_id),post.id]);
        parent = parents[0]; if (!parent) return fail(404, 'Bình luận gốc không còn cho phép trả lời.');
      }
      const status = autoApproved(current,post) ? 'APPROVED' : 'PENDING';
      const [result] = await c.execute('INSERT INTO comments(post_id,user_id,parent_id,content,status) VALUES (?,?,?,?,?)', [post.id,current.id,parent?.id || null,input.content.trim(),status]);
      const comment = { id: result.insertId, status };
      await activity.record(c,current.id,parent ? 'COMMENT_REPLY' : 'COMMENT_CREATE','comment',comment.id);
      await notifyComment(c,current,post,comment,parent);
      return { success:true, id:comment.id, status, message:status === 'APPROVED' ? 'Bình luận đã được hiển thị.' : 'Đã gửi bình luận, đang chờ duyệt.' };
    }
    const [candidate] = await c.execute('SELECT post_id FROM comments WHERE id=?', [validation.id]);
    if (!candidate.length) return fail(404,'Không tìm thấy bình luận.');
    const [posts] = await c.execute('SELECT id,author_id,title,slug,status FROM posts WHERE id=? FOR UPDATE',[candidate[0].post_id]);
    const [rows] = await c.execute('SELECT id,user_id,parent_id,status,is_deleted,content FROM comments WHERE id=? FOR UPDATE',[validation.id]);
    const comment=rows[0], post=posts[0];
    if (!post || !comment || comment.is_deleted || (current.role !== 'ADMIN' && comment.user_id !== current.id)) return fail(404,'Không tìm thấy bình luận.');
    if (operation === 'edit') {
      if (comment.user_id !== current.id) return fail(403,'Chỉ người gửi được sửa nội dung bình luận.');
      if (comment.content === input.content.trim()) return {success:true,message:'Nội dung không thay đổi.'};
      comment.status = autoApproved(current,post) ? 'APPROVED' : 'PENDING';
      await c.execute('UPDATE comments SET content=?,status=? WHERE id=?',[input.content.trim(),comment.status,comment.id]);
      if (comment.status === 'PENDING' || post.status === 'PUBLISHED') await notifyComment(c,current,post,comment,null,true);
    } else if (operation === 'delete') {
      const [counts] = await c.execute('SELECT COUNT(*) total FROM comments WHERE parent_id=?', [comment.id]);
      if (Number(counts[0].total) > 0) await c.execute("UPDATE comments SET content='',is_deleted=1 WHERE id=?", [comment.id]);
      else await c.execute('DELETE FROM comments WHERE id=?',[comment.id]);
    } else {
      if (current.role !== 'ADMIN' || !['APPROVED','HIDDEN'].includes(input.status)) return fail(403,'Bạn không có quyền kiểm duyệt.');
      if (comment.status === input.status) return {success:true,message:'Bình luận đã ở trạng thái này.'};
      let parent = null;
      if (input.status === 'APPROVED') {
        if (post.status !== 'PUBLISHED') return fail(409,'Bài viết đang ở dạng nháp. Chỉ duyệt hiển thị khi bài đã xuất bản.');
        if (comment.parent_id) {
          const [parents] = await c.execute('SELECT user_id,status,is_deleted FROM comments WHERE id=?', [comment.parent_id]);
          parent = parents[0];
          if (!parent || parent.status !== 'APPROVED' || parent.is_deleted) return fail(409,'Bình luận gốc không còn hiển thị. Chưa thể duyệt câu trả lời.');
        }
      }
      await c.execute('UPDATE comments SET status=? WHERE id=?',[input.status,comment.id]);
      await c.execute("UPDATE notifications n JOIN users u ON u.id=n.user_id SET n.read_at=COALESCE(n.read_at,UTC_TIMESTAMP()) WHERE n.comment_id=? AND u.role='ADMIN'",[comment.id]);
      if (input.status === 'APPROVED' && comment.status !== 'APPROVED') {
        await activity.notify(c,comment.user_id,'Bình luận của bạn trên bài “' + post.title + '” đã được duyệt.','/comments/'+comment.id+'/go',comment.id);
        await notifyComment(c,{id:comment.user_id},post,{...comment,status:'APPROVED'},parent);
      } else if (input.status === 'HIDDEN' && comment.user_id !== current.id) {
        await activity.notify(c,comment.user_id,'Bình luận của bạn trên bài “' + post.title + '” đã bị ẩn.','/my/comments?comment='+comment.id,comment.id);
      }
    }
    await activity.record(c,current.id,'COMMENT_'+operation.toUpperCase(),'comment',comment.id);
    return { success:true, message:'Đã cập nhật bình luận.' };
  });
}
async function commentDestination(idText, actor, publicView = false) {
  if (!validatePostId(idText).isValid) return fail(400,'ID bình luận không hợp lệ.');
  const [rows] = await pool.execute(`SELECT c.id,c.user_id,c.parent_id,c.status,c.is_deleted,p.author_id,p.slug,p.status post_status,r.status root_status
    FROM comments c JOIN posts p ON p.id=c.post_id LEFT JOIN comments r ON r.id=c.parent_id WHERE c.id=?`, [Number(idText)]);
  const comment=rows[0]; if (!comment || comment.is_deleted) return fail(410,'Bình luận đã bị xóa hoặc không còn tồn tại.');
  if (actor?.role === 'ADMIN' && !publicView) return { success:true, path:'/admin/comments?comment='+comment.id+'#comment-'+comment.id };
  const rootId=comment.parent_id || comment.id;
  if (comment.status === 'APPROVED' && comment.post_status === 'PUBLISHED' && (!comment.parent_id || comment.root_status === 'APPROVED')) {
    let page=1;
    if (comment.parent_id) { const [counts]=await pool.execute("SELECT COUNT(*) total FROM comments WHERE parent_id=? AND status='APPROVED' AND is_deleted=0 AND id<=?",[rootId,comment.id]);page=Math.max(1,Math.ceil(Number(counts[0].total)/10)); }
    return { success:true, path:'/posts/'+comment.slug+'/comments/'+rootId+'?page='+page+'#comment-'+comment.id };
  }
  if (actor?.id === comment.user_id) return {success:true,path:'/my/comments?comment='+comment.id+'#comment-'+comment.id};
  if (actor?.role === 'AUTHOR' && actor.id === comment.author_id) return {success:true,path:'/manage/comments?comment='+comment.id+'#comment-'+comment.id};
  return fail(404,'Bình luận này chưa được công khai hoặc bạn không có quyền xem.');
}
async function notifications(actor, query) {
  const f=parseQuery(query), values=[actor.id], terms=['n.user_id=?'];
  terms.push(query.hidden === '1' ? 'n.hidden_at IS NOT NULL' : 'n.hidden_at IS NULL');
  if (f.q) { terms.push("n.message LIKE ? ESCAPE '!'"); values.push(escapedLike(f.q)); }
  if (query.unread === '1') terms.push('n.read_at IS NULL');
  const where=terms.join(' AND ');
  const data=await pageRows(`SELECT n.id,n.message,n.target_path,n.read_at,n.hidden_at,n.comment_id,n.created_at FROM notifications n WHERE ${where}`,
    `SELECT COUNT(*) total FROM notifications n WHERE ${where}`,values,fToQuery(f),'n.id');
  for (const notice of data.rows) {
    notice.preview = null;
    notice.commentState = null;
    if (notice.comment_id) {
      const [rows]=await pool.execute(`SELECT c.content,c.status,c.is_deleted,p.status post_status,r.status root_status FROM comments c JOIN posts p ON p.id=c.post_id LEFT JOIN comments r ON r.id=c.parent_id WHERE c.id=?
        AND (?='ADMIN' OR c.user_id=? OR (?='AUTHOR' AND p.author_id=?) OR (c.status='APPROVED' AND p.status='PUBLISHED' AND (c.parent_id IS NULL OR r.status='APPROVED')))`,[notice.comment_id,actor.role,actor.id,actor.role,actor.id]);
      const current = rows[0];
      notice.commentState = !current || current.is_deleted ? 'Không còn khả dụng' : current.status === 'PENDING' ? 'Đang chờ duyệt' : current.status === 'HIDDEN' ? 'Đã ẩn' : current.post_status !== 'PUBLISHED' || (current.root_status && current.root_status !== 'APPROVED') ? 'Chưa hiển thị công khai' : 'Đang hiển thị';
      notice.preview=current && !current.is_deleted ? current.content : null;
    }
  }
  return data;
}
async function openNotification(actor, id) {
  if (!validatePostId(id).isValid) return fail(400, 'ID thông báo không hợp lệ.');
  const [rows] = await pool.execute('SELECT target_path FROM notifications WHERE id=? AND user_id=?', [Number(id), actor.id]);
  if (!rows.length) return fail(404, 'Không tìm thấy thông báo.');
  const path = require('../middlewares/ui-context').safePath(rows[0].target_path, null);
  if (!path) return fail(400, 'Đường dẫn thông báo không hợp lệ.');
  await pool.execute('UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE id=? AND user_id=?', [Number(id), actor.id]);
  return { success: true, path };
}
async function hideNotification(actor,id,hidden) {
  if (!validatePostId(id).isValid) return fail(400,'ID thông báo không hợp lệ.');
  await pool.execute('UPDATE notifications SET hidden_at='+ (hidden?'UTC_TIMESTAMP()':'NULL') +' WHERE id=? AND user_id=?',[Number(id),actor.id]);
  return {success:true,message:hidden?'Đã ẩn thông báo.':'Đã hiện lại thông báo.'};
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
    'SELECT COUNT(*) total FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE '+where,values,fToQuery(f),'a.id');
  const [actorOptions] = await pool.execute('SELECT DISTINCT u.id,u.name FROM users u JOIN audit_events a ON a.actor_id=u.id ORDER BY u.name,u.id');
  const [actionOptions] = await pool.execute('SELECT DISTINCT action FROM audit_events ORDER BY action');
  const [typeOptions] = await pool.execute('SELECT DISTINCT object_type FROM audit_events ORDER BY object_type');
  return { ...data, actorOptions, actionOptions, typeOptions };
}
module.exports={validContent,parseQuery,comments,thread,autoApproved,list,mutate,commentDestination,notifications,openNotification,hideNotification,markRead,follows,follow,audit};

