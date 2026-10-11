const express = require('express');
const {
  listCategories,
  showCreateForm,
  createCategory,
  showEditForm,
  updateCategory,
  deleteCategory
} = require('../controllers/category-controller');
const {
  requireAuth,
  requireRole
} = require('../middlewares/auth');
const { requireCsrf } = require('../middlewares/csrf');

const router = express.Router();

const parseForm = express.urlencoded({
  extended: false,
  limit: '10kb',
  parameterLimit: 10
});

// Mọi route quản trị danh mục đều yêu cầu xác thực vai trò ADMIN
router.use('/admin/categories', requireAuth, requireRole('ADMIN'));

router.get('/admin/categories', listCategories);

router.get('/admin/categories/new', showCreateForm);

router.post('/admin/categories', parseForm, requireCsrf, createCategory);

router.get('/admin/categories/:id/edit', showEditForm);

router.post('/admin/categories/:id/update', parseForm, requireCsrf, updateCategory);

router.post('/admin/categories/:id/delete', parseForm, requireCsrf, deleteCategory);

module.exports = router;
