const pool = require('../config/database');
const postService = require('../services/post-service');
const { validatePostId } = require('../validators/post-validator');

async function showHistory(req, res) {
  res.set('Cache-Control', 'no-store');
  const result = await postService.getPostById(req.params.id, req.user);
  if (!result.success) return res.status(result.status).render('posts/error', { statusCode: result.status, message: result.message });
  const pageInput = req.query.page === undefined ? '1' : req.query.page;
  if (!validatePostId(pageInput).isValid || (req.query.version !== undefined && !validatePostId(req.query.version).isValid)) {
    return res.status(400).render('posts/error', { statusCode: 400, message: 'Số trang hoặc phiên bản không hợp lệ.' });
  }
  const post = result.data;
  const [counts] = await pool.execute('SELECT COUNT(*) total FROM post_versions WHERE post_id = ?', [post.id]);
  const total = Number(counts[0].total), totalPages = Math.max(1, Math.ceil(total / 10));
  const page = Math.min(Number(pageInput), totalPages);
  const [versions] = await pool.execute(`SELECT v.id,v.created_at,u.name FROM post_versions v LEFT JOIN users u ON u.id = v.actor_id WHERE v.post_id = ? ORDER BY v.id DESC LIMIT ? OFFSET ?`, [post.id, 10, (page - 1) * 10]);
  let selected = null;
  if (req.query.version) {
    const [rows] = await pool.execute('SELECT title,slug,content,category_id,created_at FROM post_versions WHERE id = ? AND post_id = ?', [Number(req.query.version), post.id]);
    selected = rows[0] || null;
    if (!selected) return res.status(404).render('posts/error', { statusCode: 404, message: 'Không tìm thấy phiên bản của bài viết này.' });
  }
  const link = p => '/manage/posts/' + post.id + '/history?page=' + p;
  return res.render('posts/history', { post, versions, selected, page, total, totalPages, previousUrl: page > 1 ? link(page - 1) : null, nextUrl: page < totalPages ? link(page + 1) : null });
}
module.exports = { showHistory };
