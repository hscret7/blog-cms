const pool = require('../config/database');

function buildFilters({ q = '', category_id = null }) {
  const conditions = ["p.status = 'PUBLISHED'"];
  const values = [];

  if (q !== '') {
    // Tìm ký tự % và _ như văn bản, không coi là wildcard.
    const escaped = q.replace(/[!%_]/g, (character) => `!${character}`);

    conditions.push("p.title LIKE ? ESCAPE '!'");
    values.push(`%${escaped}%`);
  }

  if (category_id !== null) {
    conditions.push('p.category_id = ?');
    values.push(category_id);
  }

  return {
    where: conditions.join(' AND '),
    values
  };
}

async function countPublished(filters) {
  const { where, values } = buildFilters(filters);

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM posts AS p
     WHERE ${where}`,
    values
  );

  return Number(rows[0].total);
}

async function findPublishedPage(
  filters,
  { limit = 10, offset = 0 } = {}
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error('Tham số phân trang không hợp lệ.');
  }

  const { where, values } = buildFilters(filters);

  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.title,
       p.slug,
       p.cover_path,
       p.category_id,
       p.published_at,
       u.name AS author_name,
       c.name AS category_name
     FROM posts AS p
     JOIN users AS u ON u.id = p.author_id
     JOIN categories AS c ON c.id = p.category_id
     WHERE ${where}
     ORDER BY p.published_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function findPublishedBySlug(slug) {
  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.title,
       p.slug,
       p.content,
       p.cover_path,
       p.category_id,
       p.published_at,
       u.name AS author_name,
       c.name AS category_name
     FROM posts AS p
     JOIN users AS u ON u.id = p.author_id
     JOIN categories AS c ON c.id = p.category_id
     WHERE p.slug = ?
       AND p.status = 'PUBLISHED'
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

module.exports = {
  countPublished,
  findPublishedPage,
  findPublishedBySlug
};