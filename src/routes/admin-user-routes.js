const express = require('express');
const controller = require('../controllers/admin-user-controller');
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

router.use(
  '/admin/users',
  requireAuth,
  requireRole('ADMIN')
);

router.get('/admin/users', controller.listUsers);
router.get('/admin/users/new', controller.showCreateForm);

router.post(
  '/admin/users',
  parseForm,
  requireCsrf,
  controller.createUser
);

router.get('/admin/users/:id/edit', controller.showEditForm);

router.post(
  '/admin/users/:id/update',
  parseForm,
  requireCsrf,
  controller.updateUser
);

router.post(
  '/admin/users/:id/lock',
  parseForm,
  requireCsrf,
  controller.lockUser
);

router.post(
  '/admin/users/:id/unlock',
  parseForm,
  requireCsrf,
  controller.unlockUser
);

router.use((error, req, res, next) => {
  if (!req.path.startsWith('/admin/users')) {
    return next(error);
  }

  res.set('Cache-Control', 'no-store');

  if (
    error.type === 'entity.too.large' ||
    error.type === 'parameters.too.many'
  ) {
    return res.status(413).json({
      message: 'Biểu mẫu vượt quá giới hạn cho phép.'
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Dữ liệu biểu mẫu không hợp lệ.'
    });
  }

  return next(error);
});

module.exports = router;