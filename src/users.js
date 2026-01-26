const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10

async function hashPassword (password) {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

async function verifyPassword (password, hash) {
  return await bcrypt.compare(password, hash)
}

function validatePassword (password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long')
  }

  // Check complexity - require at least 3 of 4 categories
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumbers = /[0-9]/.test(password)
  const hasSymbols = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?]/.test(password)

  const complexity = [hasUppercase, hasLowercase, hasNumbers, hasSymbols].filter(Boolean).length

  if (complexity < 3) {
    throw new Error('Password must contain at least 3 of: uppercase letters, lowercase letters, numbers, and special characters')
  }

  return true
}

function validateUsername (username) {
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters long')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('Username can only contain letters, numbers, and underscores')
  }
}

function validateEmail (email) {
  // RFC 5322 compliant email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!email || !emailRegex.test(email)) {
    throw new Error('Invalid email format')
  }

  // RFC 5321 - max length 254
  if (email.length > 254) {
    throw new Error('Email too long')
  }

  const [localPart] = email.split('@')

  // RFC 5321 - local part max 64 chars
  if (localPart.length > 64) {
    throw new Error('Email local part too long')
  }

  return true
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
  validateUsername,
  validateEmail
}
