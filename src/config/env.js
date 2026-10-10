const path = require('node:path');
const { loadEnvFile } = require('node:process');

const envPath = path.resolve(__dirname, '../../.env');

try {
  loadEnvFile(envPath);
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

function required(name) {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Thiếu cấu hình bắt buộc: ${name}`);
  }

  return value;
}

function port(name) {
  const value = required(name);

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} phải là số nguyên từ 1 đến 65535.`);
  }

  const number = Number(value);

  if (number < 1 || number > 65535) {
    throw new Error(`${name} phải nằm trong khoảng 1 đến 65535.`);
  }

  return number;
}

module.exports = {
  database: {
    host: required('DB_HOST'),
    port: port('DB_PORT'),
    user: required('MYSQL_USER'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DATABASE')
  }
};