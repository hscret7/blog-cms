const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');


const pool = require('../src/config/database');
const {
  createSessionStore
} = require('../src/config/session-store');

async function main() {
  const store = createSessionStore({ clearExpired: false });
  const sessionId = `test-${randomUUID()}`;

  try {
    await store.onReady();

    await store.set(sessionId, {
      cookie: {
        expires: new Date(Date.now() + 60 * 1000)
      },
      testMarker: 'kiem-tra-session'
    });

    const [rows] = await pool.execute(
      'SELECT data FROM sessions WHERE session_id = ?',
      [sessionId]
    );

    assert.equal(rows.length, 1);
    assert.equal(
      JSON.parse(rows[0].data).testMarker,
      'kiem-tra-session'
    );
    console.log('PASS: Session đã được ghi vào MySQL.');

    const savedSession = await store.get(sessionId);

    assert.equal(
      savedSession.testMarker,
      'kiem-tra-session'
    );
    console.log('PASS: Session store đọc lại đúng dữ liệu.');

    await store.destroy(sessionId);

    const deletedSession = await store.get(sessionId);
    assert.ok(deletedSession == null);

    const [remaining] = await pool.execute(
      'SELECT COUNT(*) AS total FROM sessions WHERE session_id = ?',
      [sessionId]
    );

    assert.equal(remaining[0].total, 0);
    console.log('PASS: Session đã được xóa khỏi MySQL.');
  } finally {
    try {
      await store.destroy(sessionId);
    } finally {
      try {
        await store.close();
      } finally {
        await pool.end();
      }
    }
  }
}

main().catch((error) => {
  console.error('Kiểm tra session thất bại:', error);
  process.exitCode = 1;
});