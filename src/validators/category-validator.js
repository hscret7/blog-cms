const MAX_INT_UNSIGNED = 4294967295;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateCategoryId(idParam) {
  if (typeof idParam !== 'string' || !/^[1-9]\d*$/.test(idParam)) {
    return {
      isValid: false,
      error: 'ID danh mục phải là số nguyên dương.'
    };
  }

  const id = Number(idParam);

  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_INT_UNSIGNED) {
    return {
      isValid: false,
      error: 'ID danh mục vượt quá phạm vi cho phép.'
    };
  }

  return {
    isValid: true,
    id
  };
}

function validateCategoryInput(input) {
  const errors = {};
  const data = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: {
        form: 'Dữ liệu biểu mẫu không hợp lệ.'
      },
      data: {
        name: '',
        slug: '',
        description: null
      }
    };
  }

  // 1. Kiểm tra name
  if (typeof input.name !== 'string') {
    errors.name = 'Tên danh mục phải là chuỗi.';
    data.name = '';
  } else {
    const trimmedName = input.name.trim();
    const nameLength = Array.from(trimmedName).length;

    if (nameLength === 0) {
      errors.name = 'Tên danh mục không được để trống.';
    } else if (nameLength > 100) {
      errors.name = 'Tên danh mục không được vượt quá 100 ký tự.';
    }

    data.name = trimmedName;
  }

  // 2. Kiểm tra slug
  if (typeof input.slug !== 'string') {
    errors.slug = 'Slug phải là chuỗi.';
    data.slug = '';
  } else {
    const normalizedSlug = input.slug.trim().toLowerCase();
    const slugLength = Array.from(normalizedSlug).length;

    if (slugLength === 0) {
      errors.slug = 'Slug không được để trống.';
    } else if (slugLength > 150) {
      errors.slug = 'Slug không được vượt quá 150 ký tự.';
    } else if (!SLUG_REGEX.test(normalizedSlug)) {
      errors.slug = 'Slug chỉ gồm các đoạn chữ thường hoặc số (a-z, 0-9) cách nhau bằng một dấu gạch ngang.';
    }

    data.slug = normalizedSlug;
  }

  // 3. Kiểm tra description
  if (input.description === undefined || input.description === null || input.description === '') {
    data.description = null;
  } else if (typeof input.description !== 'string') {
    errors.description = 'Mô tả phải là chuỗi.';
    data.description = null;
  } else {
    const trimmedDesc = input.description.trim();

    if (trimmedDesc === '') {
      data.description = null;
    } else {
      const descLength = Array.from(trimmedDesc).length;

      if (descLength > 500) {
        errors.description = 'Mô tả không được vượt quá 500 ký tự.';
      }

      data.description = trimmedDesc;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

module.exports = {
  validateCategoryId,
  validateCategoryInput
};
