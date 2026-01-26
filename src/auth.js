const jwt = require('jsonwebtoken')
const { OAuthError } = require('./errors')

let publicKey

function setPublicKey (key) {
  publicKey = key
}

function getPublicKey () {
  return publicKey
}

// Middleware to verify JWT token from Authorization header
function authenticateToken (req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next(new OAuthError('invalid_request', 'Missing authorization token'))
  }

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    })
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new OAuthError('invalid_grant', 'Token has expired'))
    }
    return next(new OAuthError('invalid_grant', 'Invalid token'))
  }
}

// Middleware to verify Bearer token (access token)
function authenticateBearerToken (req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next(new OAuthError('invalid_request', 'Missing bearer token'))
  }

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    })

    if (decoded.token_type !== 'access') {
      throw new Error('Invalid token type')
    }

    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new OAuthError('invalid_grant', 'Token has expired'))
    }
    return next(new OAuthError('invalid_grant', 'Invalid token'))
  }
}

// Middleware to verify scope
function requireScope (...scopes) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new OAuthError('invalid_request', 'User not authenticated'))
    }

    const userScopes = (req.user.scope || '').split(' ').filter(s => s)

    const hasScope = scopes.some(scope =>
      userScopes.includes(scope)
    )

    if (!hasScope) {
      return next(new OAuthError('insufficient_scope', `Required scope: ${scopes.join(' or ')}`))
    }

    next()
  }
}

module.exports = {
  authenticateToken,
  authenticateBearerToken,
  requireScope,
  setPublicKey,
  getPublicKey
}
