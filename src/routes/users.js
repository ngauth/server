const express = require('express')
const crypto = require('crypto')
const { getUserById, getUser, addUser, updateUser, deleteUser, getUsers, recordFailedLogin, clearFailedLoginAttempts } = require('../db')
const { hashPassword, verifyPassword, validatePassword, validateUsername, validateEmail } = require('../users')
const { authenticateBearerToken, requireScope } = require('../auth')
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit')
const { OAuthError } = require('../errors')

const router = express.Router()

// GET /users - List all users (requires scope: user:read)
router.get('/', authenticateBearerToken, requireScope('user:read'), async (req, res, next) => {
  try {
    const users = await getUsers()
    // Remove password hashes from response
    const sanitized = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt
    }))
    res.json(sanitized)
  } catch (err) {
    next(err)
  }
})

// GET /users/:id - Get specific user (requires scope: user:read)
router.get('/:id', authenticateBearerToken, requireScope('user:read'), async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id)
    if (!user) {
      return next(new OAuthError('invalid_request', 'User not found'))
    }

    // Users can only read their own data unless they have admin scope
    const userScopes = (req.user.scope || '').split(' ').filter(s => s)
    if (req.user.sub !== req.params.id && !userScopes.includes('user:admin')) {
      return next(new OAuthError('invalid_request', 'Unauthorized to access this user'))
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    })
  } catch (err) {
    next(err)
  }
})

// POST /users - Create new user (with rate limiting)
router.post('/', registerLimiter, async (req, res, next) => {
  try {
    const { username, email, password, name } = req.body

    // Validate input
    if (!username || !email || !password) {
      return next(new OAuthError('invalid_request', 'Missing required fields: username, email, password'))
    }

    validateUsername(username)
    validateEmail(email)
    validatePassword(password)

    // Check if user already exists
    const existingUser = await getUser(username)
    if (existingUser) {
      return next(new OAuthError('invalid_request', 'Username already exists'))
    }

    // Check if email already exists
    const users = await getUsers()
    if (users.some(u => u.email === email)) {
      return next(new OAuthError('invalid_request', 'Email already exists'))
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = {
      id: 'user_' + crypto.randomBytes(8).toString('hex'),
      username,
      email,
      name: name || username,
      password: passwordHash,
      createdAt: new Date().toISOString(),
      failedLoginAttempts: 0
    }

    await addUser(user)

    // Return sanitized user
    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    })
  } catch (err) {
    if (err.message && (err.message.includes('must be') || err.message.includes('Invalid') || err.message.includes('can only') || err.message.includes('contain'))) {
      return next(new OAuthError('invalid_request', err.message))
    }
    next(err)
  }
})

// PUT /users/:id - Update user (requires scope: user:write)
router.put('/:id', authenticateBearerToken, requireScope('user:write'), async (req, res, next) => {
  try {
    const { email, name, password } = req.body

    // Users can only update their own data unless they have admin scope
    const userScopes = (req.user.scope || '').split(' ').filter(s => s)
    if (req.user.sub !== req.params.id && !userScopes.includes('user:admin')) {
      return next(new OAuthError('invalid_request', 'Unauthorized to update this user'))
    }

    const user = await getUserById(req.params.id)
    if (!user) {
      return next(new OAuthError('invalid_request', 'User not found'))
    }

    const updates = {}

    if (email) {
      validateEmail(email)
      // Check if email already exists for another user
      const users = await getUsers()
      if (users.some(u => u.id !== req.params.id && u.email === email)) {
        return next(new OAuthError('invalid_request', 'Email already exists'))
      }
      updates.email = email
    }

    if (name) {
      updates.name = name
    }

    if (password) {
      validatePassword(password)
      updates.password = await hashPassword(password)
    }

    const updated = await updateUser(req.params.id, updates)

    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      name: updated.name,
      createdAt: updated.createdAt
    })
  } catch (err) {
    if (err.message && (err.message.includes('must be') || err.message.includes('Invalid') || err.message.includes('can only'))) {
      return next(new OAuthError('invalid_request', err.message))
    }
    next(err)
  }
})

// DELETE /users/:id - Delete user (requires scope: user:admin)
router.delete('/:id', authenticateBearerToken, requireScope('user:admin'), async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id)
    if (!user) {
      return next(new OAuthError('invalid_request', 'User not found'))
    }

    // Prevent deleting self
    if (req.user.sub === req.params.id) {
      return next(new OAuthError('invalid_request', 'Cannot delete your own user'))
    }

    await deleteUser(req.params.id)
    res.json({ message: 'User deleted successfully' })
  } catch (err) {
    next(err)
  }
})

// POST /users/login - Login endpoint with rate limiting and account lockout
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return next(new OAuthError('invalid_request', 'Missing username or password'))
    }

    const user = await getUser(username)
    if (!user) {
      return next(new OAuthError('invalid_grant', 'Invalid credentials'))
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return next(new OAuthError('invalid_grant', 'Account locked due to too many failed login attempts. Try again later.'))
    }

    const validPassword = await verifyPassword(password, user.password)
    if (!validPassword) {
      await recordFailedLogin(user.id)
      return next(new OAuthError('invalid_grant', 'Invalid credentials'))
    }

    // Clear failed login attempts on success
    await clearFailedLoginAttempts(user.id)

    // Generate access token with user scope
    const { generateToken } = require('../tokens')
    const token = generateToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      token_type: 'access',
      scope: 'user:read user:write'
    })

    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
