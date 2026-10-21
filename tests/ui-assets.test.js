const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const express = require('express');

// Load the real app wiring with empty routers and no database/session connections.
function appWithoutDatabase() {
  let sessionRequests = 0;
  const context = {
    __dirname: path.resolve(__dirname, '../src'),
    process: { env: {} }, console, module: { exports: {} },
    require(name) {
      if (name === 'express') return express;
      if (name.startsWith('node:')) return require(name);
      if (name.startsWith('./routes/')) return express.Router();
      if (name === './middlewares/ui-context') return require('../src/middlewares/ui-context');
      if (name === './middlewares/auth') return { optionalAuth(req,res,next) { next(); } };
      if (name === './config/database') return { query: async () => [] };
      if (name === './config/session') return { sessionMiddleware(req, res, next) { sessionRequests++; next(); } };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  };
  const execute = new Function('require','module','__dirname','process','console',fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8'));
  execute(context.require,context.module,context.__dirname,context.process,console);
  return { app: context.module.exports, count: () => sessionRequests };
}

test('CSS/JS được phục vụ trước session; không mở tệp private hoặc uploads', async (t) => {
  const { app, count } = appWithoutDatabase();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [url, type] of [['/css/site.css?v=1', 'text/css'], ['/js/ui.js?v=1', 'javascript']]) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').includes(type));
    await response.text();
  }
  assert.equal(count(), 0);
  for (const url of ['/css/.env', '/uploads/covers/test.webp', '/secrets/grafana-admin-password']) {
    const response = await fetch(base + url);
    assert.equal(response.status, 404, url);
    await response.text();
  }
});
