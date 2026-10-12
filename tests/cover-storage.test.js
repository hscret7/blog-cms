const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const {
  FILE_NAME_PATTERN,
  createCoverStorage
} = require('../src/services/cover-storage');

const {
  MAX_FILE_BYTES,
  prepareCoverImage
} = require('../src/services/cover-image-service');

async function withTemporaryStorage(action) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'blog-cms-cover-test-')
  );

  const storage = createCoverStorage({ directory });

  try {
    await action(storage, directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function makePreparedImage() {
  const input = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 30, g: 120, b: 180 }
    }
  }).png().toBuffer();

  return prepareCoverImage(input);
}

test('Lưu đúng dữ liệu với tên UUID và quyền tệp riêng tư', async () => {
  await withTemporaryStorage(async (storage, directory) => {
    const image = await makePreparedImage();
    const fileName = await storage.save(image.buffer);

    assert.match(fileName, FILE_NAME_PATTERN);

    const filePath = storage.resolvePath(fileName);
    assert.equal(path.dirname(filePath), directory);

    const saved = await fs.readFile(filePath);
    assert.deepEqual(saved, image.buffer);

    const metadata = await sharp(saved).metadata();
    assert.equal(metadata.format, 'webp');

    if (process.platform !== 'win32') {
      const stat = await fs.stat(filePath);
      assert.equal(stat.mode & 0o777, 0o600);
    }
  });
});

test('Lưu hai lần tạo hai tệp khác nhau', async () => {
  await withTemporaryStorage(async (storage, directory) => {
    const image = await makePreparedImage();

    const first = await storage.save(image.buffer);
    const second = await storage.save(image.buffer);

    assert.notEqual(first, second);
    assert.equal((await fs.readdir(directory)).length, 2);

    assert.deepEqual(
      await fs.readFile(storage.resolvePath(first)),
      image.buffer
    );
    assert.deepEqual(
      await fs.readFile(storage.resolvePath(second)),
      image.buffer
    );
  });
});

test('Xóa tệp thành công; xóa lại trả false', async () => {
  await withTemporaryStorage(async (storage, directory) => {
    const image = await makePreparedImage();
    const fileName = await storage.save(image.buffer);

    assert.equal(await storage.remove(fileName), true);
    assert.deepEqual(await fs.readdir(directory), []);
    assert.equal(await storage.remove(fileName), false);
  });
});

test('Chặn tên tệp sai và đường dẫn vượt thư mục', async () => {
  await withTemporaryStorage(async (storage) => {
    const validName =
      '12345678-1234-4123-8123-123456789abc.webp';

    for (const fileName of [
      undefined,
      null,
      '',
      '../outside.webp',
      `../${validName}`,
      `/tmp/${validName}`,
      `folder/${validName}`,
      `folder\\${validName}`,
      validName.replace('.webp', '.png'),
      validName.toUpperCase(),
      ['image.webp']
    ]) {
      assert.throws(
        () => storage.resolvePath(fileName),
        /Tên tệp ảnh không hợp lệ/
      );

      await assert.rejects(
        () => storage.remove(fileName),
        /Tên tệp ảnh không hợp lệ/
      );
    }
  });
});

test('Từ chối dữ liệu lưu không hợp lệ, không tạo tệp', async () => {
  await withTemporaryStorage(async (storage, directory) => {
    for (const buffer of [
      undefined,
      null,
      'text',
      Buffer.alloc(0),
      Buffer.alloc(MAX_FILE_BYTES + 1)
    ]) {
      await assert.rejects(
        () => storage.save(buffer),
        /Dữ liệu ảnh để lưu không hợp lệ/
      );
    }

    assert.deepEqual(await fs.readdir(directory), []);
  });
});

test('Tự tạo thư mục lưu chưa tồn tại', async () => {
  await withTemporaryStorage(async (unusedStorage, directory) => {
    const nestedDirectory = path.join(directory, 'nested', 'covers');
    const storage = createCoverStorage({
      directory: nestedDirectory
    });

    const image = await makePreparedImage();
    const fileName = await storage.save(image.buffer);

    assert.deepEqual(
      await fs.readFile(storage.resolvePath(fileName)),
      image.buffer
    );

    if (process.platform !== 'win32') {
      const stat = await fs.stat(nestedDirectory);
      assert.equal(stat.mode & 0o777, 0o700);
    }
  });
});

test('Từ chối cấu hình thư mục tương đối hoặc sai kiểu', () => {
  for (const directory of ['uploads/covers', '', null, 123]) {
    assert.throws(
      () => createCoverStorage({ directory }),
      /Thư mục lưu ảnh phải là đường dẫn tuyệt đối/
    );
  }
});