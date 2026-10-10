const { getCsrfToken } = require('../middlewares/csrf');
const { authenticate } = require('../services/auth-service');

function showLogin(req, res) {
  res.set('Cache-Control', 'no-store');

  return res.render('login', {
    csrfToken: getCsrfToken(req),
    email: '',
    errorMessage: null
  });
}

async function login(req, res) {
  res.set('Cache-Control', 'no-store');

  const { email, password } = req.body || {};
  const user = await authenticate(email, password);

  if (!user) {
    return res.status(401).render('login', {
      csrfToken: getCsrfToken(req),
      email: typeof email === 'string'
        ? email.trim().slice(0, 254)
        : '',
      errorMessage: 'Email hoặc mật khẩu không hợp lệ.'
    });
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  req.session.userId = user.id;
  getCsrfToken(req);

  await new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  return res.redirect(303, '/account');
}

function showAccount(req, res) {
  res.set('Cache-Control', 'no-store');

  return res.render('account', {
    user: req.user,
    csrfToken: getCsrfToken(req)
  });
}

async function logout(req, res) {
  res.set('Cache-Control', 'no-store');

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

module.exports = {
  showLogin,
  login,
  showAccount,
  logout
};