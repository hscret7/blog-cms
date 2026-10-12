const postCoverService = require('./post-cover-service');
const postRepository = require('../repositories/post-repository');
const categoryRepository = require('../repositories/category-repository');
const {
  validatePostId,
  validatePostInput
} = require('../validators/post-validator');

const PAGE_SIZE = 20;

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
    const id = await postRepository.createDraft(
      user,
      validation.data
    );

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
    const affectedRows = await postRepository.updateContent(
      postResult.data.id,
      user,
      validation.data
    );

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

  const affectedRows = targetStatus === 'PUBLISHED'
    ? await postRepository.publish(post.id, user)
    : await postRepository.unpublish(post.id, user);

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