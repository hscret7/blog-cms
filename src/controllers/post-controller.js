const postService = require('../services/post-service');
const categoryRepository = require('../repositories/category-repository');
const { getCsrfToken } = require('../middlewares/csrf');

function renderError(res, result) {
  return res.status(result.status).render('posts/error', {
    statusCode: result.status,
    message: result.message
  });
}

function getFormData(body) {
  return {
    title: typeof body?.title === 'string' ? body.title : '',
    slug: typeof body?.slug === 'string' ? body.slug : '',
    content: typeof body?.content === 'string' ? body.content : '',
    category_id:
      typeof body?.category_id === 'string' ? body.category_id : ''
  };
}

async function listPosts(req, res) {
  const data = await require('../services/list-service').getPage('posts', req.user, req.query);
  return res.render('posts/index', { user: req.user, csrfToken: getCsrfToken(req), ...data, posts: data.rows });
}

async function showCreateForm(req, res) {
  const categories = await categoryRepository.findAll();

  return res.render('posts/new', {
    user: req.user,
    categories,
    csrfToken: getCsrfToken(req),
    formData: getFormData({}),
    errors: {},
    errorMessage: null
  });
}

async function createPost(req, res) {
  const result = await postService.createDraft(req.user, req.body);

  if (!result.success) {
    const categories = await categoryRepository.findAll();

    return res.status(result.status).render('posts/new', {
      user: req.user,
      categories,
      csrfToken: getCsrfToken(req),
      formData: getFormData(req.body),
      errors: result.errors || {},
      errorMessage: result.message || null
    });
  }

  return res.redirect(303, '/manage/posts');
}

async function showEditForm(req, res) {
  const result = await postService.getPostById(
    req.params.id,
    req.user
  );

  if (!result.success) {
    return renderError(res, result);
  }

  const post = result.data;
  const categories = await categoryRepository.findAll();

  return res.render('posts/edit', {
    user: req.user,
    post,
    categories,
    csrfToken: getCsrfToken(req),
    formData: {
      title: post.title,
      slug: post.slug,
      content: post.content,
      category_id: String(post.category_id)
    },
    errors: {},
    errorMessage: null
  });
}

async function updatePost(req, res) {
  const result = await postService.updatePost(
    req.params.id,
    req.user,
    req.body
  );

  if (!result.success) {
    if (result.status === 400 || result.status === 404) {
      return renderError(res, result);
    }

    // Đọc lại trong phạm vi quyền trước khi hiển thị biểu mẫu lỗi.
    const postResult = await postService.getPostById(
      req.params.id,
      req.user
    );

    if (!postResult.success) {
      return renderError(res, postResult);
    }

    const categories = await categoryRepository.findAll();

    return res.status(result.status).render('posts/edit', {
      user: req.user,
      post: postResult.data,
      categories,
      csrfToken: getCsrfToken(req),
      formData: getFormData(req.body),
      errors: result.errors || {},
      errorMessage: result.message || null
    });
  }

  return res.redirect(303, '/manage/posts');
}

async function publishPost(req, res) {
  const result = await postService.publishPost(
    req.params.id,
    req.user
  );

  if (!result.success) {
    return renderError(res, result);
  }

  return res.redirect(303, '/manage/posts');
}

async function unpublishPost(req, res) {
  const result = await postService.unpublishPost(
    req.params.id,
    req.user
  );

  if (!result.success) {
    return renderError(res, result);
  }

  return res.redirect(303, '/manage/posts');
}

async function deletePost(req, res) {
  const result = await postService.deletePost(
    req.params.id,
    req.user
  );

  if (!result.success) {
    return renderError(res, result);
  }

  return res.redirect(303, '/manage/posts');
}

module.exports = {
  listPosts,
  showCreateForm,
  createPost,
  showEditForm,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost
};