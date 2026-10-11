const publicPostService = require('../services/public-post-service');
const categoryRepository = require('../repositories/category-repository');

function renderError(res, result) {
  return res.status(result.status).render('public/error', {
    statusCode: result.status,
    message: result.message,
    errors: result.errors || {}
  });
}

function buildPageUrl(filters, page) {
  const params = new URLSearchParams();

  if (filters.q !== '') {
    params.set('q', filters.q);
  }

  if (filters.category_id !== null) {
    params.set('category_id', String(filters.category_id));
  }

  params.set('page', String(page));

  return `/?${params.toString()}`;
}

async function showHome(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await publicPostService.getPublicPage(req.query);

  if (!result.success) {
    return renderError(res, result);
  }

  const categories = await categoryRepository.findAll();
  const { page, totalPages, filters } = result.data;

  return res.render('public/index', {
    ...result.data,
    categories,
    previousUrl:
      page > 1 ? buildPageUrl(filters, page - 1) : null,
    nextUrl:
      page < totalPages ? buildPageUrl(filters, page + 1) : null
  });
}

async function showPost(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await publicPostService.getPublicPost(
    req.params.slug
  );

  if (!result.success) {
    return renderError(res, result);
  }

  const post = result.data;

  const publishedAtText = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(post.published_at);

  return res.render('public/detail', {
    post,
    publishedAtText
  });
}

module.exports = {
  showHome,
  showPost
};