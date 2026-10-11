const express = require('express');
const {
  requireAuth,
  requireRole
} = require('../middlewares/auth');
const { requireCsrf } = require('../middlewares/csrf');
const {
  listPosts,
  showCreateForm,
  createPost,
  showEditForm,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost
} = require('../controllers/post-controller');

const router = express.Router();

const parseForm = express.urlencoded({
  extended: false,
  limit: '320kb',
  parameterLimit: 10
});

router.use(
  '/manage/posts',
  requireAuth,
  requireRole('ADMIN', 'AUTHOR'),
  (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }
);

function handleFormError(error, req, res, next) {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Dữ liệu biểu mẫu vượt quá kích thước cho phép.'
    });
  }

  if (error.type === 'parameters.too.many') {
    return res.status(413).json({
      message: 'Biểu mẫu chứa quá nhiều trường dữ liệu.'
    });
  }

  if (error.status === 400) {
    return res.status(400).json({
      message: 'Dữ liệu biểu mẫu không hợp lệ.'
    });
  }

  return next(error);
}

router.get('/manage/posts', listPosts);
router.get('/manage/posts/new', showCreateForm);

router.post(
  '/manage/posts',
  parseForm,
  requireCsrf,
  createPost
);

router.get('/manage/posts/:id/edit', showEditForm);

router.post(
  '/manage/posts/:id/update',
  parseForm,
  requireCsrf,
  updatePost
);

router.post(
  '/manage/posts/:id/publish',
  parseForm,
  requireCsrf,
  publishPost
);

router.post(
  '/manage/posts/:id/unpublish',
  parseForm,
  requireCsrf,
  unpublishPost
);

router.post(
  '/manage/posts/:id/delete',
  parseForm,
  requireCsrf,
  deletePost
);

router.use(handleFormError);

module.exports = router;