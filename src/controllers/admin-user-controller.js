const service = require('../services/admin-user-service');
const { getCsrfToken } = require('../middlewares/csrf');

function getFormData(body) {
  return {
    name: typeof body?.name === 'string' ? body.name : '',
    email: typeof body?.email === 'string' ? body.email : '',
    role: typeof body?.role === 'string' ? body.role : 'AUTHOR'
  };
}

function renderError(req, res, result) {
  return res.status(result.status).render('users/error', {
    user: req.user,
    statusCode: result.status,
    message: result.message || 'Không thể thực hiện thao tác.'
  });
}

async function listUsers(req, res) {
  res.set('Cache-Control', 'no-store');

  const data = await require('../services/list-service').getPage('users', req.user, req.query);
  return res.render('users/index', { user: req.user, csrfToken: getCsrfToken(req), ...data, users: data.rows });
}

function showCreateForm(req, res) {
  res.set('Cache-Control', 'no-store');

  return res.render('users/new', {
    user: req.user,
    csrfToken: getCsrfToken(req),
    formData: {
      name: '',
      email: '',
      role: 'AUTHOR'
    },
    errors: {},
    errorMessage: null
  });
}

async function createUser(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await service.createUser(req.body, req.user);

  if (!result.success) {
    if (![422, 409].includes(result.status)) {
      return renderError(req, res, result);
    }

    return res.status(result.status).render('users/new', {
      user: req.user,
      csrfToken: getCsrfToken(req),
      formData: getFormData(req.body),
      errors: result.errors || {},
      errorMessage: result.message || null
    });
  }

  return res.redirect(303, '/admin/users');
}

async function showEditForm(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await service.getUserById(req.params.id, req.user);
  if (!result.success) {
    return renderError(req, res, result);
  }

  return res.render('users/edit', {
    user: req.user,
    targetUser: result.data,
    csrfToken: getCsrfToken(req),
    formData: {
      name: result.data.name,
      email: result.data.email,
      role: result.data.role
    },
    errors: {},
    errorMessage: null
  });
}

async function updateUser(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await service.updateUser(
    req.params.id,
    req.body,
    req.user
  );

  if (!result.success) {
    if (![422, 409].includes(result.status)) {
      return renderError(req, res, result);
    }

    const current = await service.getUserById(req.params.id, req.user);
    if (!current.success) {
      return renderError(req, res, current);
    }

    return res.status(result.status).render('users/edit', {
      user: req.user,
      targetUser: current.data,
      csrfToken: getCsrfToken(req),
      formData: getFormData(req.body),
      errors: result.errors || {},
      errorMessage: result.message || null
    });
  }

  return res.redirect(303, '/admin/users');
}

async function lockUser(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await service.lockUser(req.params.id, req.user);
  if (!result.success) {
    return renderError(req, res, result);
  }

  return res.redirect(303, '/admin/users');
}

async function unlockUser(req, res) {
  res.set('Cache-Control', 'no-store');

  const result = await service.unlockUser(req.params.id, req.user);
  if (!result.success) {
    return renderError(req, res, result);
  }

  return res.redirect(303, '/admin/users');
}

module.exports = {
  listUsers,
  showCreateForm,
  createUser,
  showEditForm,
  updateUser,
  lockUser,
  unlockUser
};