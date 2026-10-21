const nodemailer = require('nodemailer');

function createMailService(env = process.env) {
  function settings() {
    const required = ['PUBLIC_BASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
    if (required.some(key => !env[key]?.trim())) {
      const error = new Error('Dịch vụ email chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
      error.status = 503;
      throw error;
    }
    const origin = new URL(env.PUBLIC_BASE_URL);
    if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
        !['https:', 'http:'].includes(origin.protocol) ||
        (origin.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(origin.hostname))) {
      throw new Error('PUBLIC_BASE_URL phải là origin HTTPS hoặc HTTP localhost.');
    }
    const port = Number(env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT không hợp lệ.');
    const secure = env.SMTP_SECURE === 'true';
    return { origin: origin.origin, options: {
      host: env.SMTP_HOST, port, secure, requireTLS: !secure,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true
    }};
  }
  async function sendToken(email, purpose, token) {
    const { origin, options } = settings();
    const verify = purpose === 'VERIFY_EMAIL';
    // Fragment không được gửi trong URL request/log Nginx; trang chuyển token vào form POST.
    const link = `${origin}/${verify ? 'verify-email' : 'reset-password'}#token=${token}`;
    await nodemailer.createTransport(options).sendMail({
      from: env.SMTP_FROM, to: email,
      subject: verify ? 'Xác minh email Blog CMS' : 'Đặt lại mật khẩu Blog CMS',
      text: `${verify ? 'Xác minh email' : 'Đặt lại mật khẩu'} bằng liên kết sau:\n${link}\n\nLiên kết dùng một lần, hết hạn sau ${verify ? '24 giờ' : '30 phút'}. Nếu không yêu cầu, hãy bỏ qua email này.`
    });
  }
  return { assertConfigured: settings, sendToken };
}
module.exports = { createMailService, mailService: createMailService() };
