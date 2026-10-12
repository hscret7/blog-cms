const service = require('../services/account-service');
const { getCsrfToken } = require('../middlewares/csrf');
const modes = {
  register: ['Tạo tài khoản độc giả', 'Đăng ký', '/register'],
  forgot: ['Quên mật khẩu', 'Gửi liên kết khôi phục', '/forgot-password'],
  reset: ['Đặt lại mật khẩu', 'Lưu mật khẩu mới', '/reset-password'],
  verify: ['Xác minh email', 'Xác minh tài khoản', '/verify-email'],
  profile: ['Sửa thông tin cá nhân', 'Lưu thông tin', '/account/profile'],
  password: ['Đổi mật khẩu', 'Đổi mật khẩu', '/account/password']
};
function render(req, res, mode, result = {}, data = {}) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  return res.status(result.status || 200).render('auth/form', {
    mode, title: modes[mode][0], submitLabel: modes[mode][1], action: modes[mode][2],
    csrfToken: getCsrfToken(req), result, data,
    // Chỉ trả lại token để sửa validation mật khẩu; không trả lại mật khẩu.
    token: mode === 'reset' && typeof req.body?.token === 'string' && /^[a-f0-9]{64}$/.test(req.body.token) ? req.body.token : ''
  });
}
function page(mode) { return (req, res) => render(req, res, mode, {}, { name: req.user?.name || '', email: req.user?.email || '' }); }
function action(mode, fn) {
  return async (req, res) => {
    try {
      const result = await fn(req);
      if (result.success && mode === 'profile' && !result.emailChanged) return res.redirect(303, '/account');
      return render(req, res, mode, result, {
        name: typeof req.body?.name === 'string' ? req.body.name.slice(0, 200) : '',
        email: typeof req.body?.email === 'string' ? req.body.email.slice(0, 254) : ''
      });
    } catch (error) {
      console.error('Thao tác tài khoản thất bại:', error.code || 'ACCOUNT_FAILED');
      return render(req, res, mode, { status: 503, message: 'Dịch vụ email hoặc tài khoản tạm thời chưa sẵn sàng. Vui lòng thử lại sau.' });
    }
  };
}
module.exports = {
  page,
  register: action('register', req => service.register(req.body)),
  forgot: action('forgot', req => service.requestReset(req.body?.email)),
  reset: action('reset', req => service.consume(req.body?.token, 'RESET_PASSWORD', req.body)),
  verify: action('verify', req => service.consume(req.body?.token, 'VERIFY_EMAIL')),
  resend: action('verify', req => service.resend(req.user.id)),
  profile: action('profile', req => service.updateProfile(req.user, req.body)),
  password: action('password', req => service.changePassword(req.user, req.body))
};
