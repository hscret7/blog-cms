const repository = require('../repositories/public-post-repository');
const {
  validatePublicQuery,
  validatePublicSlug
} = require('../validators/public-post-validator');

const PAGE_SIZE = 10;

async function getPublicPage(query) {
  const validation = validatePublicQuery(query);

  if (!validation.isValid) {
    return {
      success: false,
      status: 400,
      message: 'Tham số tìm kiếm hoặc phân trang không hợp lệ.',
      errors: validation.errors
    };
  }

  const filters = {
    q: validation.data.q,
    category_id: validation.data.category_id
  };

  const total = await repository.countPublished(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(validation.data.page, totalPages);

  const posts = await repository.findPublishedPage(filters, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });

  return {
    success: true,
    data: {
      posts,
      filters,
      total,
      page,
      totalPages
    }
  };
}

async function getPublicPost(slug) {
  if (!validatePublicSlug(slug)) {
    return {
      success: false,
      status: 404,
      message: 'Không tìm thấy bài viết.'
    };
  }

  const post = await repository.findPublishedBySlug(slug);

  if (!post) {
    return {
      success: false,
      status: 404,
      message: 'Không tìm thấy bài viết.'
    };
  }

  return {
    success: true,
    data: post
  };
}

module.exports = {
  getPublicPage,
  getPublicPost
};