const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCategoryId,
  validateCategoryInput
} = require('../src/validators/category-validator');

test('Category Validation Module', async (t) => {
  await t.test('validateCategoryInput - Dữ liệu hợp lệ', () => {
    // Trường hợp chuẩn: Tiếng Việt có dấu, slug chuẩn, mô tả đầy đủ
    const result1 = validateCategoryInput({
      name: '  Lập trình Web & Di động  ',
      slug: '  Lap-Trinh-Web-2026  ',
      description: '  Chuyên mục chia sẻ kiến thức công nghệ và lập trình.  '
    });

    assert.equal(result1.isValid, true);
    assert.deepEqual(result1.errors, {});
    assert.equal(result1.data.name, 'Lập trình Web & Di động');
    assert.equal(result1.data.slug, 'lap-trinh-web-2026');
    assert.equal(
      result1.data.description,
      'Chuyên mục chia sẻ kiến thức công nghệ và lập trình.'
    );

    // Trường hợp không có mô tả (undefined, null, hoặc chuỗi rỗng) -> lưu NULL
    const result2 = validateCategoryInput({
      name: 'Đời sống - Xã hội',
      slug: 'doi-song-xa-hoi'
    });
    assert.equal(result2.isValid, true);
    assert.equal(result2.data.description, null);

    const result3 = validateCategoryInput({
      name: 'Khoa học',
      slug: 'khoa-hoc',
      description: '   '
    });
    assert.equal(result3.isValid, true);
    assert.equal(result3.data.description, null);

    const result4 = validateCategoryInput({
      name: 'Tin tức',
      slug: 'tin-tuc',
      description: null
    });
    assert.equal(result4.isValid, true);
    assert.equal(result4.data.description, null);

    // Slug ngắn nhất hợp lệ (1 ký tự a-z hoặc 0-9)
    const result5 = validateCategoryInput({
      name: 'A',
      slug: 'a'
    });
    assert.equal(result5.isValid, true);
    assert.equal(result5.data.slug, 'a');

    // Tên đúng 100 code points tiếng Việt
    const name100 = 'Á'.repeat(100);
    const result6 = validateCategoryInput({
      name: name100,
      slug: 'danh-muc-100'
    });
    assert.equal(result6.isValid, true);

    // Mô tả đúng 500 code points
    const desc500 = 'Ế'.repeat(500);
    const result7 = validateCategoryInput({
      name: 'Danh mục',
      slug: 'danh-muc',
      description: desc500
    });
    assert.equal(result7.isValid, true);
    assert.equal(result7.data.description, desc500);

    // Slug đúng 150 ký tự
    const slug150 = 'a'.repeat(150);
    const result8 = validateCategoryInput({
      name: 'Danh mục dài',
      slug: slug150
    });
    assert.equal(result8.isValid, true);
  });

  await t.test('validateCategoryInput - Tên không hợp lệ', () => {
    // Tên rỗng hoặc chỉ có khoảng trắng
    const empty1 = validateCategoryInput({ name: '', slug: 'hop-le' });
    assert.equal(empty1.isValid, false);
    assert.ok(empty1.errors.name);

    const empty2 = validateCategoryInput({ name: '   ', slug: 'hop-le' });
    assert.equal(empty2.isValid, false);
    assert.ok(empty2.errors.name);

    // Tên vượt quá 100 code points (101 ký tự tiếng Việt)
    const longName = 'Ă'.repeat(101);
    const resultLong = validateCategoryInput({ name: longName, slug: 'hop-le' });
    assert.equal(resultLong.isValid, false);
    assert.ok(resultLong.errors.name);

    // Tên sai kiểu dữ liệu (số, mảng, object, boolean, null, undefined)
    const typeNumber = validateCategoryInput({ name: 12345, slug: 'hop-le' });
    assert.equal(typeNumber.isValid, false);
    assert.ok(typeNumber.errors.name);

    const typeArray = validateCategoryInput({ name: ['Tên danh mục'], slug: 'hop-le' });
    assert.equal(typeArray.isValid, false);
    assert.ok(typeArray.errors.name);

    const typeObject = validateCategoryInput({ name: { name: 'Tên' }, slug: 'hop-le' });
    assert.equal(typeObject.isValid, false);
    assert.ok(typeObject.errors.name);

    const typeBool = validateCategoryInput({ name: true, slug: 'hop-le' });
    assert.equal(typeBool.isValid, false);
    assert.ok(typeBool.errors.name);

    const typeNull = validateCategoryInput({ name: null, slug: 'hop-le' });
    assert.equal(typeNull.isValid, false);
    assert.ok(typeNull.errors.name);
  });

  await t.test('validateCategoryInput - Slug không hợp lệ', () => {
    // Slug rỗng hoặc chỉ có khoảng trắng
    const emptySlug = validateCategoryInput({ name: 'Hợp lệ', slug: '' });
    assert.equal(emptySlug.isValid, false);
    assert.ok(emptySlug.errors.slug);

    const whitespaceSlug = validateCategoryInput({ name: 'Hợp lệ', slug: '   ' });
    assert.equal(whitespaceSlug.isValid, false);
    assert.ok(whitespaceSlug.errors.slug);

    // Slug vượt quá 150 ký tự
    const longSlug = 'a'.repeat(151);
    const resultLong = validateCategoryInput({ name: 'Hợp lệ', slug: longSlug });
    assert.equal(resultLong.isValid, false);
    assert.ok(resultLong.errors.slug);

    // Slug có dấu gạch dưới (_)
    const underscoreSlug = validateCategoryInput({ name: 'Hợp lệ', slug: 'lap_trinh' });
    assert.equal(underscoreSlug.isValid, false);
    assert.ok(underscoreSlug.errors.slug);

    // Slug có khoảng trắng ở giữa
    const spaceSlug = validateCategoryInput({ name: 'Hợp lệ', slug: 'lap trinh' });
    assert.equal(spaceSlug.isValid, false);
    assert.ok(spaceSlug.errors.slug);

    // Slug bắt đầu bằng dấu gạch ngang
    const leadingHyphen = validateCategoryInput({ name: 'Hợp lệ', slug: '-lap-trinh' });
    assert.equal(leadingHyphen.isValid, false);
    assert.ok(leadingHyphen.errors.slug);

    // Slug kết thúc bằng dấu gạch ngang
    const trailingHyphen = validateCategoryInput({ name: 'Hợp lệ', slug: 'lap-trinh-' });
    assert.equal(trailingHyphen.isValid, false);
    assert.ok(trailingHyphen.errors.slug);

    // Slug có hai dấu gạch ngang liên tiếp
    const doubleHyphen = validateCategoryInput({ name: 'Hợp lệ', slug: 'lap--trinh' });
    assert.equal(doubleHyphen.isValid, false);
    assert.ok(doubleHyphen.errors.slug);

    // Slug chứa tiếng Việt có dấu
    const vietnameseSlug = validateCategoryInput({ name: 'Hợp lệ', slug: 'lập-trình' });
    assert.equal(vietnameseSlug.isValid, false);
    assert.ok(vietnameseSlug.errors.slug);

    // Slug chứa ký tự đặc biệt
    const specialSlug = validateCategoryInput({ name: 'Hợp lệ', slug: 'lap@trinh' });
    assert.equal(specialSlug.isValid, false);
    assert.ok(specialSlug.errors.slug);

    // Slug sai kiểu dữ liệu
    const arraySlug = validateCategoryInput({ name: 'Hợp lệ', slug: ['slug'] });
    assert.equal(arraySlug.isValid, false);
    assert.ok(arraySlug.errors.slug);

    const numberSlug = validateCategoryInput({ name: 'Hợp lệ', slug: 12345 });
    assert.equal(numberSlug.isValid, false);
    assert.ok(numberSlug.errors.slug);
  });

  await t.test('validateCategoryInput - Mô tả không hợp lệ', () => {
    // Mô tả vượt quá 500 code points
    const longDesc = 'Ô'.repeat(501);
    const resultLong = validateCategoryInput({
      name: 'Hợp lệ',
      slug: 'hop-le',
      description: longDesc
    });
    assert.equal(resultLong.isValid, false);
    assert.ok(resultLong.errors.description);

    // Mô tả sai kiểu dữ liệu (mảng, số, object, boolean)
    const arrayDesc = validateCategoryInput({
      name: 'Hợp lệ',
      slug: 'hop-le',
      description: ['Mô tả không hợp lệ']
    });
    assert.equal(arrayDesc.isValid, false);
    assert.ok(arrayDesc.errors.description);

    const numberDesc = validateCategoryInput({
      name: 'Hợp lệ',
      slug: 'hop-le',
      description: 123
    });
    assert.equal(numberDesc.isValid, false);
    assert.ok(numberDesc.errors.description);
  });

  await t.test('validateCategoryInput - Payload tổng thể không hợp lệ', () => {
    assert.equal(validateCategoryInput(null).isValid, false);
    assert.equal(validateCategoryInput(undefined).isValid, false);
    assert.equal(validateCategoryInput('chuoi').isValid, false);
    assert.equal(validateCategoryInput([]).isValid, false);
    assert.equal(validateCategoryInput(123).isValid, false);
  });

  await t.test('validateCategoryId - Kiểm tra ID hợp lệ và không hợp lệ', () => {
    // ID hợp lệ (số nguyên dương dạng chuỗi trong phạm vi INT UNSIGNED)
    assert.deepEqual(validateCategoryId('1'), { isValid: true, id: 1 });
    assert.deepEqual(validateCategoryId('123'), { isValid: true, id: 123 });
    assert.deepEqual(validateCategoryId('4294967295'), { isValid: true, id: 4294967295 });

    // ID không hợp lệ: số 0
    assert.equal(validateCategoryId('0').isValid, false);

    // ID không hợp lệ: số âm
    assert.equal(validateCategoryId('-1').isValid, false);
    assert.equal(validateCategoryId('-100').isValid, false);

    // ID không hợp lệ: số thập phân
    assert.equal(validateCategoryId('1.5').isValid, false);
    assert.equal(validateCategoryId('2.0').isValid, false);

    // ID không hợp lệ: có chữ hoặc ký tự lạ
    assert.equal(validateCategoryId('abc').isValid, false);
    assert.equal(validateCategoryId('1a').isValid, false);
    assert.equal(validateCategoryId('a1').isValid, false);
    assert.equal(validateCategoryId('').isValid, false);
    assert.equal(validateCategoryId('   ').isValid, false);

    // ID không hợp lệ: vượt quá giới hạn INT UNSIGNED (4294967295)
    assert.equal(validateCategoryId('4294967296').isValid, false);
    assert.equal(validateCategoryId('99999999999999999999').isValid, false);

    // ID sai kiểu dữ liệu
    assert.equal(validateCategoryId(1).isValid, false);
    assert.equal(validateCategoryId(null).isValid, false);
    assert.equal(validateCategoryId(undefined).isValid, false);
    assert.equal(validateCategoryId({}).isValid, false);
    assert.equal(validateCategoryId([]).isValid, false);
  });
});
