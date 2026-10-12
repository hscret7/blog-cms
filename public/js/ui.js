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

const tokenInput = document.getElementById('email-token');
if (tokenInput) {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  if (token && /^[a-f0-9]{64}$/.test(token)) tokenInput.value = token;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
