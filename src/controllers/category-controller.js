const { setFeedback } = require('../middlewares/ui-context');
const categoryService = require('../services/category-service');
const { getCsrfToken } = require('../middlewares/csrf');

async function listCategories(req, res) {
  res.set('Cache-Control', 'no-store');

  const data = await require('../services/list-service').getPage('categories', req.user, req.query);
  return res.render('categories/index', { user: req.user, csrfToken: getCsrfToken(req), errorMessage: null, ...data, categories: data.rows });
}

function showCreateForm(req, res) {
  res.set('Cache-Control', 'no-store');

  const csrfToken = getCsrfToken(req);

  return res.render('categories/new', {
    user: req.user,
    csrfToken,
    errors: {},
    formData: {
      name: '',
      slug: '',
      description: ''
    },
    errorMessage: null
  });
}

async function createCategory(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await categoryService.createCategory(req.body, req.user);

  if (!result.success) {
    const csrfToken = getCsrfToken(req);

    return res.status(result.status).render('categories/new', {
      user: req.user,
      csrfToken,
      errors: result.errors || {},
      formData: {
        name: typeof req.body?.name === 'string' ? req.body.name : '',
        slug: typeof req.body?.slug === 'string' ? req.body.slug : '',
        description: typeof req.body?.description === 'string' ? req.body.description : ''
      },
      errorMessage: result.message || null
    });
  }

  setFeedback(req, 'Đã cập nhật danh mục.');
  return res.redirect(303, '/admin/categories');
}

async function showEditForm(req, res) {
  res.set('Cache-Control', 'no-store');

  const { id } = req.params;
  const result = await categoryService.getCategoryById(id);

  if (!result.success) {
    return res.status(result.status).render('categories/error', {
      user: req.user,
      statusCode: result.status,
      message: result.message
    });
  }

  const category = result.data;
  const csrfToken = getCsrfToken(req);

  return res.render('categories/edit', {
    user: req.user,
    category,
    csrfToken,
    errors: {},
    formData: {
      name: category.name,
      slug: category.slug,
      description: category.description || ''
    },
    errorMessage: null
  });
}

async function updateCategory(req, res) {
  res.set('Cache-Control', 'no-store');

  const { id } = req.params;
  const result = await categoryService.updateCategory(id, req.body, req.user);

  if (!result.success) {
    if (result.status === 400 || result.status === 404) {
      return res.status(result.status).render('categories/error', {
        user: req.user,
        statusCode: result.status,
        message: result.message
      });
    }

    const csrfToken = getCsrfToken(req);

    return res.status(result.status).render('categories/edit', {
      user: req.user,
      category: { id },
      csrfToken,
      errors: result.errors || {},
      formData: {
        name: typeof req.body?.name === 'string' ? req.body.name : '',
        slug: typeof req.body?.slug === 'string' ? req.body.slug : '',
        description: typeof req.body?.description === 'string' ? req.body.description : ''
      },
      errorMessage: result.message || null
    });
  }

  setFeedback(req, 'Đã cập nhật danh mục.');
  return res.redirect(303, '/admin/categories');
}

async function deleteCategory(req, res) {
  res.set('Cache-Control', 'no-store');

  const { id } = req.params;
  const result = await categoryService.deleteCategory(id, req.user);

  if (!result.success) {
    if (result.status === 400 || result.status === 404) {
      return res.status(result.status).render('categories/error', {
        user: req.user,
        statusCode: result.status,
        message: result.message
      });
    }

    if (result.status === 409) {
      const categories = await categoryService.getAllCategories();
      const csrfToken = getCsrfToken(req);

      return res.status(409).render('categories/index', {
        user: req.user,
        categories,
        csrfToken,
        errorMessage: result.message
      });
    }

    return res.status(result.status || 500).render('categories/error', {
      user: req.user,
      statusCode: result.status || 500,
      message:
        result.message ||
        'Không thể xóa danh mục. Vui lòng thử lại.'
    });
  }

  setFeedback(req, 'Đã cập nhật danh mục.');
  return res.redirect(303, '/admin/categories');
}

module.exports = {
  listCategories,
  showCreateForm,
  createCategory,
  showEditForm,
  updateCategory,
  deleteCategory
};
