const { findByEmail } = require('../repositories/user-repository');
const {
  hashPassword,
  verifyPassword
} = require('./password-service');

let dummyHashPromise;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      'Mat khau gia chi dung de kiem tra 2026!'
    );
  }

  return dummyHashPromise;
}

async function authenticate(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordLength = Array.from(password).length;

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    passwordLength < 8 ||
    passwordLength > 128
  ) {
    return null;
  }

  const user = await findByEmail(normalizedEmail);

  const hash = user
    ? (user.password_hash || await getDummyHash())
    : await getDummyHash();

  const passwordMatches = await verifyPassword(hash, password);

  if (
    !user ||
    !passwordMatches ||
    user.status !== 'ACTIVE' ||
    !['ADMIN', 'AUTHOR', 'READER'].includes(user.role)
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    email_verified_at: user.email_verified_at,
    session_version: user.session_version
  };
}

module.exports = {
  authenticate
};