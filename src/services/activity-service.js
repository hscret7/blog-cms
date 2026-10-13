const pool = require('../config/database');
async function record(executor, actorId, action, objectType, objectId) {
  await executor.execute('INSERT INTO audit_events(actor_id,action,object_type,object_id) VALUES (?,?,?,?)', [actorId, action, objectType, objectId]);
}
async function notify(executor, userId, message, targetPath, commentId = null) {
  // Các callers chỉ truyền đường dẫn nội bộ do server sinh.
  if (!targetPath.startsWith('/') || targetPath.startsWith('//')) throw new Error('Đường dẫn thông báo không hợp lệ.');
  await executor.execute('INSERT INTO notifications(user_id,message,target_path,comment_id) VALUES (?,?,?,?)', [userId, Array.from(message).slice(0,300).join(''), targetPath, commentId]);
}
async function published(executor, postId) {
  const [posts] = await executor.execute('SELECT category_id,slug,author_id,title FROM posts WHERE id = ?', [postId]);
  if (!posts.length) return;
  await executor.execute(`INSERT INTO notifications(user_id,message,target_path)
    SELECT f.user_id, ?, ?
    FROM category_follows f JOIN users u ON u.id=f.user_id
    WHERE f.category_id=? AND u.status='ACTIVE' AND u.email_verified_at IS NOT NULL AND f.user_id<>?`,
    [Array.from('Bài “'+(posts[0].title || 'Bài viết mới')+'” vừa được xuất bản trong chủ đề bạn theo dõi.').slice(0,300).join(''), '/posts/' + posts[0].slug, posts[0].category_id, posts[0].author_id]);
}
async function snapshot(executor, actorId, postId) {
  await executor.execute(`INSERT INTO post_versions(post_id,actor_id,title,slug,content,category_id)
    SELECT id,?,title,slug,content,category_id FROM posts WHERE id=?`, [actorId, postId]);
}
async function withActor(actor, allowedRoles, action) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.execute('SELECT id,role,status,email_verified_at FROM users WHERE id=? FOR UPDATE', [actor?.id || 0]);
    if (!rows[0] || rows[0].status !== 'ACTIVE' || !allowedRoles.includes(rows[0].role)) {
      const e = new Error('Bạn không còn quyền thực hiện thao tác.'); e.status = 403; throw e;
    }
    const result = await action(c, rows[0]);
    if (result?.success === false) await c.rollback(); else await c.commit();
    return result;
  } catch (error) { await c.rollback(); throw error; }
  finally { c.release(); }
}
module.exports = { record, notify, published, snapshot, withActor };
