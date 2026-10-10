const { findById } = require('../repositories/user-repository');

async function requireAuth(req, res, next) {
  res.set('Cache-Control', 'no-store');

  const userId = req.session?.userId;

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.redirect(303, '/login');
  }

  const user = await findById(userId);

  if (
    !user ||
    user.status !== 'ACTIVE' ||
    !['ADMIN', 'AUTHOR'].includes(user.role)
  ) {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    res.clearCookie('blogcms.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    });

    return res.redirect(303, '/login');
  }

  req.user = user;
  return next();
}

function requireRole(...allowedRoles) {
  if (
    allowedRoles.length === 0 ||
    allowedRoles.some((role) => !['ADMIN', 'AUTHOR'].includes(role))
  ) {
    throw new Error('Cấu hình vai trò được phép không hợp lệ.');
  }

  return function checkRole(req, res, next) {
    res.set('Cache-Control', 'no-store');

    if (!req.user) {
      return res.status(401).json({
        message: 'Bạn cần đăng nhập.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Bạn không có quyền thực hiện thao tác này.'
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};