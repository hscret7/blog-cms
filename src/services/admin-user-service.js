const pool = require('../config/database');
const repository = require('../repositories/admin-user-repository');
const { hashPassword } = require('./password-service');
const {
  validateUserId,
  validateUserInput
} = require('../validators/user-validator');

function checkActor(actor) {
  if (
    !actor ||
    !Number.isInteger(actor.id) ||
    actor.id <= 0 ||
    actor.role !== 'ADMIN' ||
    actor.status !== 'ACTIVE'
  ) {
    return {
      success: false,
      status: 403,
      message: 'Bạn không có quyền quản lý người dùng.'
    };
  }

  return null;
}

function invalidId(validation) {
  return {
    success: false,
    status: 400,
    message: validation.error
  };
}

function notFound() {
  return {
    success: false,
    status: 404,
    message: 'Không tìm thấy người dùng.'
  };
}

function invalidInput(validation) {
  return {
    success: false,
    status: 422,
    errors: validation.errors,
    data: validation.data
  };
}

async function withAdminTransaction(actor, action) {
  const actorError = checkActor(actor);
  if (actorError) {
    return actorError;
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const users = await repository.lockUsersForAdministration(connection);
    const currentActor = users.find((user) => user.id === actor.id);

    if (
      !currentActor ||
      currentActor.role !== 'ADMIN' ||
      currentActor.status !== 'ACTIVE'
    ) {
      await connection.rollback();
      transactionStarted = false;

      return {
        success: false,
        status: 403,
        message: 'Tài khoản hiện tại không còn quyền quản trị.'
      };
    }

    const result = await action(connection, users);

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        status: 409,
        errors: {
          email: 'Email này đã được sử dụng.'
        }
      };
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function getAllUsers(actor) {
  const actorError = checkActor(actor);
  if (actorError) {
    return actorError;
  }

  return {
    success: true,
    data: await repository.findAll()
  };
}

async function getUserById(idParam, actor) {
  const actorError = checkActor(actor);
  if (actorError) {
    return actorError;
  }

  const validation = validateUserId(idParam);
  if (!validation.isValid) {
    return invalidId(validation);
  }

  const user = await repository.findById(validation.id);
  if (!user) {
    return notFound();
  }

  return { success: true, data: user };
}

async function createUser(input, actor) {
  const actorError = checkActor(actor);
  if (actorError) {
    return actorError;
  }

  const validation = validateUserInput(input, { creating: true });
  if (!validation.isValid) {
    return invalidInput(validation);
  }

  const passwordHash = await hashPassword(input.password);

  return withAdminTransaction(actor, async (connection) => {
    const id = await repository.create(
      validation.data,
      passwordHash,
      connection
    );

    return { success: true, id };
  });
}

async function updateUser(idParam, input, actor) {
  const actorError = checkActor(actor);
  if (actorError) {
    return actorError;
  }

  const idValidation = validateUserId(idParam);
  if (!idValidation.isValid) {
    return invalidId(idValidation);
  }

  const validation = validateUserInput(input);
  if (!validation.isValid) {
    return invalidInput(validation);
  }

  return withAdminTransaction(actor, async (connection, users) => {
    const target = users.find((user) => user.id === idValidation.id);
    if (!target) {
      return notFound();
    }

    if (target.id === actor.id && validation.data.role !== 'ADMIN') {
      return {
        success: false,
        status: 409,
        message: 'Bạn không thể tự hạ quyền tài khoản đang đăng nhập.'
      };
    }

    const activeAdmins = users.filter(
      (user) => user.role === 'ADMIN' && user.status === 'ACTIVE'
    ).length;

    if (
      target.role === 'ADMIN' &&
      target.status === 'ACTIVE' &&
      validation.data.role !== 'ADMIN' &&
      activeAdmins <= 1
    ) {
      return {
        success: false,
        status: 409,
        message: 'Phải giữ ít nhất một ADMIN đang hoạt động.'
      };
    }

    await repository.update(
      target.id,
      validation.data,
      connection
    );

    return { success: true };
  });
}

async function changeStatus(idParam, actor, status) {
  const actorError = checkActor(actor);
  if (actorError) {
    return actorError;
  }

  const validation = validateUserId(idParam);
  if (!validation.isValid) {
    return invalidId(validation);
  }

  return withAdminTransaction(actor, async (connection, users) => {
    const target = users.find((user) => user.id === validation.id);
    if (!target) {
      return notFound();
    }

    if (status === 'LOCKED' && target.id === actor.id) {
      return {
        success: false,
        status: 409,
        message: 'Bạn không thể tự khóa tài khoản đang đăng nhập.'
      };
    }

    const activeAdmins = users.filter(
      (user) => user.role === 'ADMIN' && user.status === 'ACTIVE'
    ).length;

    if (
      status === 'LOCKED' &&
      target.role === 'ADMIN' &&
      target.status === 'ACTIVE' &&
      activeAdmins <= 1
    ) {
      return {
        success: false,
        status: 409,
        message: 'Phải giữ ít nhất một ADMIN đang hoạt động.'
      };
    }

    if (target.status !== status) {
      await repository.setStatus(target.id, status, connection);
    }

    return { success: true };
  });
}

async function lockUser(idParam, actor) {
  return changeStatus(idParam, actor, 'LOCKED');
}

async function unlockUser(idParam, actor) {
  return changeStatus(idParam, actor, 'ACTIVE');
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  lockUser,
  unlockUser
};