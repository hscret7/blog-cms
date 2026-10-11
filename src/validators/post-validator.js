const MAX_INT_UNSIGNED = 4294967295;
const MAX_CONTENT_BYTES = 100000;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validatePostId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return {
      isValid: false,
      error: 'ID phải là số nguyên dương.'
    };
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > MAX_INT_UNSIGNED) {
    return {
      isValid: false,
      error: 'ID nằm ngoài phạm vi cho phép.'
    };
  }

  return { isValid: true, id };
}

function validatePostInput(input) {
  const data = {
    title: '',
    slug: '',
    content: '',
    category_id: null
  };
  const errors = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: { form: 'Dữ liệu biểu mẫu không hợp lệ.' },
      data
    };
  }

  if (typeof input.title !== 'string') {
    errors.title = 'Tiêu đề phải là văn bản.';
  } else {
    data.title = input.title.trim();
    const length = Array.from(data.title).length;

    if (length < 1 || length > 200) {
      errors.title = 'Tiêu đề phải có từ 1 đến 200 ký tự.';
    }
  }

  if (typeof input.slug !== 'string') {
    errors.slug = 'Slug phải là văn bản.';
  } else {
    data.slug = input.slug.trim().toLowerCase();

    if (
      data.slug.length > 220 ||
      !SLUG_REGEX.test(data.slug)
    ) {
      errors.slug =
        'Slug phải có từ 1 đến 220 ký tự, gồm chữ a-z, số ' +
        'và gạch nối giữa các nhóm.';
    }
  }

  if (typeof input.content !== 'string') {
    errors.content = 'Nội dung phải là văn bản.';
  } else {
    data.content = input.content;

    if (data.content.trim() === '') {
      errors.content = 'Nội dung không được để trống.';
    } else if (
      Buffer.byteLength(data.content, 'utf8') > MAX_CONTENT_BYTES
    ) {
      errors.content = 'Nội dung không được vượt quá 100.000 byte UTF-8.';
    }
  }

  const categoryValidation = validatePostId(input.category_id);

  if (!categoryValidation.isValid) {
    errors.category_id = 'Hãy chọn danh mục hợp lệ.';
  } else {
    data.category_id = categoryValidation.id;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

module.exports = {
  MAX_CONTENT_BYTES,
  validatePostId,
  validatePostInput
};