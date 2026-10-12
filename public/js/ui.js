'use strict';

// Chỉ hỗ trợ giao diện; kiểm tra quyền và dữ liệu vẫn thực hiện trên server.
document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
    button.setAttribute('aria-pressed', String(show));
  });
});
