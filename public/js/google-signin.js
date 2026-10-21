'use strict';
window.completeGoogleSignIn = async function(response) {
  const output = document.getElementById('google-result');
  if (!response || !response.credential) {
    if (output) output.textContent = 'Không nhận được xác thực từ Google. Hãy thử lại.';
    return;
  }
  if (output) output.textContent = 'Đang xác minh Google…';
  try {
    const csrfInput = document.getElementById('google-csrf');
    const result = await fetch('/auth/google/complete', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: response.credential,
        _csrf: csrfInput ? csrfInput.value : ''
      })
    });
    const data = await result.json();
    if (result.ok && ['/account', '/account/google'].includes(data.redirect)) {
      location.assign(data.redirect);
      return;
    }
    if (output) output.textContent = data.message || 'Không đăng nhập được. Hãy tải lại trang.';
  } catch {
    if (output) output.textContent = 'Không kết nối được với website. Hãy tải lại trang và thử lại.';
  }
};
