const pool = require('../config/database');

function validateActor(user) {
  if (
    !user ||
    !Number.isInteger(user.id) ||
    user.id < 1 ||
    user.id > 4294967295 ||
    user.status !== 'ACTIVE' ||
    !['ADMIN', 'AUTHOR'].includes(user.role)
  ) {
    throw new Error('Tài khoản thực hiện thao tác không hợp lệ.');
  }
}

async function findPageForUser(user, { limit = 20, offset = 0 } = {}) {
  validateActor(user);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error('Tham số phân trang không hợp lệ.');
  }

  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.author_id,
       p.category_id,
       p.title,
       p.slug,
       p.status,
       p.published_at,
       p.created_at,
       p.updated_at,
       u.name AS author_name,
       c.name AS category_name
     FROM posts AS p
     JOIN users AS u ON u.id = p.author_id
     JOIN categories AS c ON c.id = p.category_id
     WHERE (? = 'ADMIN' OR p.author_id = ?)
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [user.role, user.id, limit, offset]
  );

  return rows;
}

async function countForUser(user) {
  validateActor(user);

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM posts
     WHERE (? = 'ADMIN' OR author_id = ?)`,
    [user.role, user.id]
  );

  return Number(rows[0].total);
}

async function findByIdForUser(id, user) {
  validateActor(user);

  const [rows] = await pool.execute(
    `SELECT
       id,
       author_id,
       category_id,
       title,
       slug,
       content,
       cover_path,
       status,
       published_at,
       created_at,
       updated_at
     FROM posts
     WHERE id = ?
       AND (? = 'ADMIN' OR author_id = ?)
     LIMIT 1`,
    [id, user.role, user.id]
  );

  return rows[0] || null;
}

async function createDraft(user, { title, slug, content, category_id }) {
  validateActor(user);

  const [result] = await pool.execute(
    `INSERT INTO posts (
       author_id,
       category_id,
       title,
       slug,
       content,
       status,
       published_at
     )
     VALUES (?, ?, ?, ?, ?, 'DRAFT', NULL)`,
    [user.id, category_id, title, slug, content]
  );

  return result.insertId;
}

async function updateContent(
  id,
  user,
  { title, slug, content, category_id }
) {
  validateActor(user);

  const [result] = await pool.execute(
    `UPDATE posts
     SET title = ?,
         slug = ?,
         content = ?,
         category_id = ?
     WHERE id = ?
       AND (? = 'ADMIN' OR author_id = ?)`,
    [
      title,
      slug,
      content,
      category_id,
      id,
      user.role,
      user.id
    ]
  );

  return result.affectedRows;
}

async function publish(id, user) {
  validateActor(user);

  const [result] = await pool.execute(
    `UPDATE posts
     SET status = 'PUBLISHED',
         published_at = UTC_TIMESTAMP()
     WHERE id = ?
       AND status = 'DRAFT'
       AND (? = 'ADMIN' OR author_id = ?)`,
    [id, user.role, user.id]
  );

  return result.affectedRows;
}

async function unpublish(id, user) {
  validateActor(user);

  const [result] = await pool.execute(
    `UPDATE posts
     SET status = 'DRAFT',
         published_at = NULL
     WHERE id = ?
       AND status = 'PUBLISHED'
       AND (? = 'ADMIN' OR author_id = ?)`,
    [id, user.role, user.id]
  );

  return result.affectedRows;
}

async function remove(id, user) {
  validateActor(user);

  const [result] = await pool.execute(
    `DELETE FROM posts
     WHERE id = ?
       AND (? = 'ADMIN' OR author_id = ?)`,
    [id, user.role, user.id]
  );

  return result.affectedRows;
}

module.exports = {
  findPageForUser,
  countForUser,
  findByIdForUser,
  createDraft,
  updateContent,
  publish,
  unpublish,
  remove
};