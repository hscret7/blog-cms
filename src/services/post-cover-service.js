const activity = require('./activity-service');
const pool = require('../config/database');
const repository = require('../repositories/post-repository');
const { validatePostId } = require('../validators/post-validator');
const {
  prepareCoverImage,
  CoverImageError
} = require('./cover-image-service');
const { coverStorage } = require('./cover-storage');

function notFound() {
  return {
    success: false,
    status: 404,
    message: 'Bài viết không tồn tại hoặc bạn không có quyền truy cập.'
  };
}

function forbidden() {
  return {
    success: false,
    status: 403,
    message: 'Tài khoản không còn quyền thực hiện thao tác.'
  };
}

async function cleanupFile(fileName) {
  if (fileName === null) {
    return true;
  }

  try {
    await coverStorage.remove(fileName);
    return true;
  } catch (error) {
    console.error(
      'Không dọn được tệp ảnh:',
      error.code || 'COVER_CLEANUP_FAILED'
    );
    return false;
  }
}

async function mutateCover(idParam, user, operation, inputBuffer) {
  const validation = validatePostId(idParam);
  if (!validation.isValid) {
    return {
      success: false,
      status: 400,
      message: validation.error
    };
  }

  if (
    !user ||
    !Number.isInteger(user.id) ||
    user.id <= 0 ||
    user.status !== 'ACTIVE' ||
    !['ADMIN', 'AUTHOR'].includes(user.role)
  ) {
    return forbidden();
  }

  const existing = await repository.findByIdForUser(validation.id, user);
  if (!existing) {
    return notFound();
  }

  let prepared;

  if (operation === 'replace') {
    try {
      prepared = await prepareCoverImage(inputBuffer);
    } catch (error) {
      if (error instanceof CoverImageError) {
        return {
          success: false,
          status: error.status,
          message: error.message
        };
      }
      throw error;
    }
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  let commitAttempted = false;
  let newFileName = null;
  let oldFileName = null;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [actors] = await connection.execute(
      `SELECT id, role, status, session_version
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [user.id]
    );

    const currentUser = actors[0];

    if (
      !currentUser ||
      currentUser.status !== 'ACTIVE' ||
      !['ADMIN', 'AUTHOR'].includes(currentUser.role) ||
      (currentUser.session_version ?? 0) !== (user.session_version ?? 0)
    ) {
      await connection.rollback();
      transactionStarted = false;
      return forbidden();
    }

    const post = await repository.lockByIdForUser(
      validation.id,
      currentUser,
      connection
    );

    if (!post) {
      await connection.rollback();
      transactionStarted = false;
      return notFound();
    }

    oldFileName = post.cover_path;

    // Kiểm tra tên ảnh cũ trước khi thay đổi database.
    if (oldFileName !== null) {
      coverStorage.resolvePath(oldFileName);
    }

    if (operation === 'replace') {
      newFileName = await coverStorage.save(prepared.buffer);

      await repository.updateCover(
        post.id,
        currentUser,
        newFileName,
        connection
      );
    } else if (operation === 'remove') {
      await repository.updateCover(
        post.id,
        currentUser,
        null,
        connection
      );
    } else if (operation === 'delete') {
      await connection.execute('DELETE FROM comments WHERE post_id = ? AND parent_id IS NOT NULL', [post.id]);
      await connection.execute('DELETE FROM comments WHERE post_id = ?', [post.id]);
      const affectedRows = await repository.remove(
        post.id,
        currentUser,
        connection
      );

      if (affectedRows !== 1) {
        throw new Error('Không xóa được bài viết đã khóa.');
      }
    } else {
      throw new Error('Thao tác ảnh không hợp lệ.');
    }

    await activity.record(connection, currentUser.id, operation === 'delete' ? 'POST_DELETE' : operation === 'replace' ? 'COVER_REPLACE' : 'COVER_REMOVE', 'post', post.id);

    commitAttempted = true;
    await connection.commit();
    transactionStarted = false;
  } catch (error) {
    let rollbackSucceeded = false;

    if (transactionStarted) {
      try {
        await connection.rollback();
        rollbackSucceeded = true;
      } catch (rollbackError) {
        console.error(
          'Rollback thao tác ảnh thất bại:',
          rollbackError.code || 'UNKNOWN'
        );
      }
    }

    if (
      newFileName !== null &&
      !commitAttempted &&
      rollbackSucceeded
    ) {
      await cleanupFile(newFileName);
    }

    // Nếu commit đã được gửi nhưng báo lỗi, giữ tệp mới:
    // chưa thể biết chắc database đã commit hay chưa.
    throw error;
  } finally {
    connection.release();
  }

  const cleanupSucceeded = await cleanupFile(oldFileName);

  return {
    success: true,
    id: validation.id,
    cleanupPending: !cleanupSucceeded
  };
}

async function replaceCover(idParam, user, buffer) {
  return mutateCover(idParam, user, 'replace', buffer);
}

async function removeCover(idParam, user) {
  return mutateCover(idParam, user, 'remove');
}

async function deletePostWithCover(idParam, user) {
  return mutateCover(idParam, user, 'delete');
}

module.exports = {
  replaceCover,
  removeCover,
  deletePostWithCover
};
