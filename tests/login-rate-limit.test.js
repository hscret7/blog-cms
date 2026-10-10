const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createLoginRateLimiter } = require('../src/middlewares/login-rate-limit');

test('Login rate limiter middleware', async (t) => {
  await t.test(
    'cho phép yêu cầu trong giới hạn, trả HTTP 429 khi vượt giới hạn và phục hồi sau windowMs',
    async () => {
      const windowMs = 250;
      const limit = 3;
      const limiter = createLoginRateLimiter({
        windowMs,
        limit
      });

      const app = express();
      let handlerCallCount = 0;

      app.post('/test-login', limiter, (req, res) => {
        handlerCallCount++;
        return res.status(200).json({ ok: true });
      });

      const server = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/test-login`;

      try {
        // 1. Gửi các yêu cầu trong giới hạn cho phép (3 yêu cầu)
        for (let i = 1; i <= limit; i++) {
          const response = await fetch(url, { method: 'POST' });
          assert.equal(
            response.status,
            200,
            `Yêu cầu thứ ${i} trong giới hạn phải trả HTTP 200`
          );
          const data = await response.json();
          assert.equal(data.ok, true);
          assert.equal(handlerCallCount, i, `Handler phải được gọi ${i} lần`);
        }

        // 2. Gửi yêu cầu thứ 4 vượt giới hạn (phải bị chặn với HTTP 429)
        const blockedResponse = await fetch(url, { method: 'POST' });
        assert.equal(
          blockedResponse.status,
          429,
          'Yêu cầu vượt quá giới hạn phải trả HTTP 429'
        );

        // Xác nhận handler đăng nhập không được gọi
        assert.equal(
          handlerCallCount,
          limit,
          'Handler không được gọi khi yêu cầu bị chặn bởi rate limiter'
        );

        // Xác nhận header Cache-Control: no-store
        assert.equal(
          blockedResponse.headers.get('cache-control'),
          'no-store',
          'Header Cache-Control phải là no-store'
        );

        // Xác nhận header Retry-After tồn tại
        const retryAfter = blockedResponse.headers.get('retry-after');
        assert.ok(
          retryAfter !== null && retryAfter !== undefined,
          'Phải có header Retry-After trong phản hồi HTTP 429'
        );
        assert.ok(
          Number(retryAfter) >= 0,
          'Giá trị header Retry-After phải là số không âm'
        );

        // Xác nhận thông báo tiếng Việt
        const blockedBody = await blockedResponse.json();
        assert.equal(
          blockedBody.message,
          'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.'
        );

        // 3. Đợi hết cửa sổ thời gian windowMs
        await new Promise((resolve) => setTimeout(resolve, windowMs + 60));

        // 4. Gửi yêu cầu tiếp theo khi đã hết windowMs (phải được chấp nhận lại)
        const restoredResponse = await fetch(url, { method: 'POST' });
        assert.equal(
          restoredResponse.status,
          200,
          'Yêu cầu sau khi hết windowMs phải được chấp nhận lại với HTTP 200'
        );
        assert.equal(
          handlerCallCount,
          limit + 1,
          'Handler phải được gọi khi cửa sổ rate limit được đặt lại'
        );
      } finally {
        // Đóng HTTP server
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        // Dọn dẹp timer và bộ nhớ của MemoryStore theo API thư viện
        limiter.store.shutdown();
      }
    }
  );

  await t.test(
    'cho phép tùy chỉnh tham số windowMs và limit phục vụ kiểm thử',
    () => {
      const customLimiter = createLoginRateLimiter({
        windowMs: 5000,
        limit: 2
      });

      try {
        assert.equal(typeof customLimiter, 'function');
      } finally {
        customLimiter.store.shutdown();
      }
    }
  );
});

