const activity = require('./activity-service');
const postCoverService = require('./post-cover-service');
const postRepository = require('../repositories/post-repository');
const categoryRepository = require('../repositories/category-repository');
const {
  validatePostId,
  validatePostInput
} = require('../validators/post-validator');

const PAGE_SIZE = 20;
async function writePost(actor, id, action, write) {
  return activity.withActor(actor, ['ADMIN', 'AUTHOR'], async (connection, currentActor) => {
    if (id && !await postRepository.lockByIdForUser(id, currentActor, connection)) return 0;
    const result = await write(connection, currentActor);
    if (result > 0) {
      const postId = id || result;
      await activity.record(connection, currentActor.id, action, 'post', postId);
      if (action === 'POST_CREATE' || action === 'POST_UPDATE') await activity.snapshot(connection, currentActor.id, postId);
      if (action === 'POST_PUBLISH') await activity.published(connection, postId);
    }
    return result;
  });
}

function notFound() {
  return {
    success: false,
    status: 404,
    message: 'Bài viết không tồn tại hoặc bạn không có quyền truy cập.'
  };
}

function invalidCategory(data) {
  return {
    success: false,
    status: 422,
    errors: {
      category_id: 'Danh mục không tồn tại. Vui lòng chọn lại.'
    },
    data
  };
}

function handleWriteError(error, data) {
  if (error.code === 'ER_DUP_ENTRY') {
    return {
      success: false,
      status: 409,
      errors: {
        slug: 'Slug này đã được sử dụng. Vui lòng chọn slug khác.'
      },
      data
    };
  }

  if (
    error.code === 'ER_NO_REFERENCED_ROW_2' ||
    error.errno === 1452
  ) {
    return {
      success: false,
      status: 409,
      message:
        'Tài khoản hoặc danh mục liên kết không còn tồn tại. ' +
        'Vui lòng tải lại trang.',
      data
    };
  }

  throw error;
}

async function getPostPage(user, pageParam) {
  const pageText = pageParam === undefined ? '1' : pageParam;
  const pageValidation = validatePostId(pageText);

  if (!pageValidation.isValid) {
    return {
      success: false,
      status: 400,
      message: 'Số trang không hợp lệ.'
    };
  }

  const requestedPage = pageValidation.id;
  const total = await postRepository.countForUser(user);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const posts = await postRepository.findPageForUser(user, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });

  return {
    success: true,
    data: {
      posts,
      page,
      total,
      totalPages
    }
  };
}

async function getPostById(idParam, user) {
  const validation = validatePostId(idParam);

  if (!validation.isValid) {
    return {
      success: false,
      status: 400,
      message: validation.error
    };
  }

  const post = await postRepository.findByIdForUser(
    validation.id,
    user
  );

  if (!post) {
    return notFound();
  }

  return {
    success: true,
    data: post
  };
}

async function createDraft(user, input) {
  const validation = validatePostInput(input);

  if (!validation.isValid) {
    return {
      success: false,
      status: 422,
      errors: validation.errors,
      data: validation.data
    };
  }

  const category = await categoryRepository.findById(
    validation.data.category_id
  );

  if (!category) {
    return invalidCategory(validation.data);
  }

  try {
    const id = await writePost(user, null, 'POST_CREATE', (connection, actor) =>
      postRepository.createDraft(actor, validation.data, connection));

    return {
      success: true,
      id
    };
  } catch (error) {
    return handleWriteError(error, validation.data);
  }
}

async function updatePost(idParam, user, input) {
  const postResult = await getPostById(idParam, user);

  if (!postResult.success) {
    return postResult;
  }

  const validation = validatePostInput(input);

  if (!validation.isValid) {
    return {
      success: false,
      status: 422,
      errors: validation.errors,
      data: validation.data
    };
  }

  const category = await categoryRepository.findById(
    validation.data.category_id
  );

  if (!category) {
    return invalidCategory(validation.data);
  }

  try {
    const affectedRows = await writePost(user, postResult.data.id, 'POST_UPDATE', (connection, actor) =>
      postRepository.updateContent(postResult.data.id, actor, validation.data, connection));

    if (affectedRows === 0) {
      const remaining = await postRepository.findByIdForUser(
        postResult.data.id,
        user
      );

      if (!remaining) {
        return notFound();
      }
    }

    return {
      success: true,
      id: postResult.data.id
    };
  } catch (error) {
    return handleWriteError(error, validation.data);
  }
}

async function changePublication(idParam, user, targetStatus) {
  const postResult = await getPostById(idParam, user);

  if (!postResult.success) {
    return postResult;
  }

  const post = postResult.data;

  // Bài đã ở trạng thái yêu cầu: không ghi lại thời điểm xuất bản.
  if (post.status === targetStatus) {
    return {
      success: true,
      id: post.id
    };
  }

  const affectedRows = await writePost(user, post.id,
    targetStatus === 'PUBLISHED' ? 'POST_PUBLISH' : 'POST_UNPUBLISH',
    (connection, actor) => targetStatus === 'PUBLISHED'
      ? postRepository.publish(post.id, actor, connection)
      : postRepository.unpublish(post.id, actor, connection));

  if (affectedRows > 0) {
    return {
      success: true,
      id: post.id
    };
  }

  // Có thể bài đã bị xóa hoặc trạng thái thay đổi bởi yêu cầu khác.
  const current = await postRepository.findByIdForUser(post.id, user);

  if (!current) {
    return notFound();
  }

  if (current.status === targetStatus) {
    return {
      success: true,
      id: current.id
    };
  }

  return {
    success: false,
    status: 409,
    message:
      'Trạng thái bài viết đã thay đổi. Vui lòng tải lại trang và thử lại.'
  };
}

async function publishPost(idParam, user) {
  return changePublication(idParam, user, 'PUBLISHED');
}

async function unpublishPost(idParam, user) {
  return changePublication(idParam, user, 'DRAFT');
}

async function deletePost(idParam, user) {
  return postCoverService.deletePostWithCover(idParam, user);
}

module.exports = {
  getPostPage,
  getPostById,
  createDraft,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost
};