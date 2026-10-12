const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { MAX_FILE_BYTES } = require('./cover-image-service');

const DEFAULT_DIRECTORY = path.resolve(
  __dirname,
  '../../uploads/covers'
);

const FILE_NAME_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/;

function createCoverStorage({ directory = DEFAULT_DIRECTORY } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
    throw new Error('Thư mục lưu ảnh phải là đường dẫn tuyệt đối.');
  }

  const rootDirectory = path.resolve(directory);

  function resolvePath(fileName) {
    if (
      typeof fileName !== 'string' ||
      !FILE_NAME_PATTERN.test(fileName)
    ) {
      throw new Error('Tên tệp ảnh không hợp lệ.');
    }

    return path.join(rootDirectory, fileName);
  }

  async function save(buffer) {
    if (
      !Buffer.isBuffer(buffer) ||
      buffer.length === 0 ||
      buffer.length > MAX_FILE_BYTES
    ) {
      throw new Error('Dữ liệu ảnh để lưu không hợp lệ.');
    }

    await fs.mkdir(rootDirectory, {
      recursive: true,
      mode: 0o700
    });

    const fileName = `${randomUUID()}.webp`;
    const filePath = resolvePath(fileName);

    const handle = await fs.open(filePath, 'wx', 0o600);

    try {
      await handle.writeFile(buffer);
    } catch (error) {
      await handle.close();

      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Ghi ảnh thất bại và không dọn được tệp chưa hoàn tất.'
          );
        }
      }

      throw error;
    }

    try {
      await handle.close();
    } catch (error) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Đóng tệp ảnh thất bại và không dọn được tệp.'
          );
        }
      }

      throw error;
    }

    return fileName;
  }

  async function remove(fileName) {
    const filePath = resolvePath(fileName);

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }

  return {
    save,
    remove,
    resolvePath
  };
}

const coverStorage = createCoverStorage();

module.exports = {
  FILE_NAME_PATTERN,
  createCoverStorage,
  coverStorage
};