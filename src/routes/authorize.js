/* eslint camelcase: "off" */
const express = require('express')
const { getClient, getUser, addCode, recordFailedLogin, clearFailedLoginAttempts } = require('../db')
const { generateRandomToken } = require('../tokens')
const { OAuthError } = require('../errors')
const { verifyPassword } = require('../users')

const router = express.Router()

// HTML login form
const loginForm = (clientId, redirectUri, scope, state, nonce, error) => `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Login</title>
  <style>
    body { font-family: sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    input { width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
    .error { color: red; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h2>Sign In</h2>
  ${error ? `<div class="error">${error}</div>` : ''}
  <form method="POST">
    <input type="hidden" name="client_id" value="${clientId}" />
    <input type="hidden" name="redirect_uri" value="${redirectUri}" />
    <input type="hidden" name="scope" value="${scope || ''}" />
    <input type="hidden" name="state" value="${state || ''}" />
    ${nonce ? `<input type="hidden" name="nonce" value="${nonce}" />` : ''}
    <input type="text" name="username" placeholder="Username" required />
    <input type="password" name="password" placeholder="Password" required />
    <button type="submit">Sign In</button>
  </form>
  <p style="font-size: 12px; color: #666;">Test credentials: testuser / testpass</p>
</body>
</html>
`

// GET /authorize - Show login form or redirect with code
router.get('/', async (req, res, next) => {
  const { client_id, redirect_uri, response_type, scope, state, nonce } = req.query

  // Validate required parameters (RFC 6749 4.1.1, OIDC Core 3.1.2.1)
  if (!client_id) {
    return next(new OAuthError('invalid_request', 'Missing client_id parameter'))
  }
  if (!redirect_uri) {
    return next(new OAuthError('invalid_request', 'Missing redirect_uri parameter'))
  }
  if (response_type !== 'code') {
    return next(new OAuthError('unsupported_response_type', 'Only response_type=code is supported'))
  }

  try {
    // Validate client
    const client = await getClient(client_id)
    if (!client) {
      return next(new OAuthError('unauthorized_client', 'Invalid client_id'))
    }

    // Validate redirect_uri
    if (!client.redirect_uris.includes(redirect_uri)) {
      return next(new OAuthError('invalid_request', 'Invalid redirect_uri'))
    }

    // Validate scope - check if requested scopes are allowed by client registration
    // Only validate if client has specific scopes registered
    if (scope && client.scope && client.scope.trim()) {
      const requestedScopes = scope.split(' ').filter(s => s)
      const allowedScopes = client.scope.split(' ').filter(s => s)
      // Allow standard OIDC scopes even if not in client registration
      const standardScopes = ['openid', 'profile', 'email', 'offline_access']
      
      for (const requestedScope of requestedScopes) {
        if (!standardScopes.includes(requestedScope) && !allowedScopes.includes(requestedScope)) {
          return next(new OAuthError('invalid_scope', `Scope '${requestedScope}' not registered for this client`))
        }
      }
    }

    // Check if user is authenticated
    if (!req.session.userId) {
      // Show login form
      return res.send(loginForm(client_id, redirect_uri, scope, state, nonce))
    }

    // User is authenticated, generate authorization code
    const code = generateRandomToken()
    const expiresAt = Date.now() + (10 * 60 * 1000) // 10 minutes

    await addCode({
      code,
      client_id,
      redirect_uri,
      scope: scope || '',
      userId: req.session.userId,
      nonce: nonce || null,
      expiresAt
    })

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri)
    redirectUrl.searchParams.set('code', code)
    if (state) {
      redirectUrl.searchParams.set('state', state)
    }

    res.redirect(redirectUrl.toString())
  } catch (err) {
    next(err)
  }
})

// POST /authorize - Process login
router.post('/', async (req, res, next) => {
  const { username, password, client_id, redirect_uri, scope, state, nonce } = req.body

  try {
    // Validate input
    if (!username || !password) {
      return res.send(loginForm(client_id, redirect_uri, scope, state, nonce, 'Username and password are required'))
    }

    // Validate client
    const client = await getClient(client_id)
    if (!client) {
      return next(new OAuthError('unauthorized_client', 'Invalid client_id'))
    }

    // Validate redirect_uri
    if (!client.redirect_uris.includes(redirect_uri)) {
      return next(new OAuthError('invalid_request', 'Invalid redirect_uri'))
    }

    // Validate scope - check if requested scopes are allowed by client registration
    // Only validate if client has specific scopes registered
    if (scope && client.scope && client.scope.trim()) {
      const requestedScopes = scope.split(' ').filter(s => s)
      const allowedScopes = client.scope.split(' ').filter(s => s)
      // Allow standard OIDC scopes even if not in client registration
      const standardScopes = ['openid', 'profile', 'email', 'offline_access']
      
      for (const requestedScope of requestedScopes) {
        if (!standardScopes.includes(requestedScope) && !allowedScopes.includes(requestedScope)) {
          return res.send(loginForm(client_id, redirect_uri, scope, state, nonce, `Scope '${requestedScope}' not registered for this client`))
        }
      }
    }

    // Authenticate user
    const user = await getUser(username)
    if (!user || !(await verifyPassword(password, user.password))) {
      // Record failed login attempt for rate limiting
      if (user) {
        await recordFailedLogin(user.id)
      }
      return res.send(loginForm(client_id, redirect_uri, scope, state, nonce, 'Invalid username or password'))
    }

    // Check if user account is locked
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return res.send(loginForm(client_id, redirect_uri, scope, state, nonce, 'Account temporarily locked. Please try again later.'))
    }

    // Set session
    req.session.userId = user.id

    // Clear failed login attempts on successful login
    await clearFailedLoginAttempts(user.id)

    // Generate authorization code
    const code = generateRandomToken()
    const expiresAt = Date.now() + (10 * 60 * 1000) // 10 minutes

    await addCode({
      code,
      client_id,
      redirect_uri,
      scope: scope || '',
      userId: user.id,
      nonce: nonce || null,
      expiresAt
    })

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri)
    redirectUrl.searchParams.set('code', code)
    if (state) {
      redirectUrl.searchParams.set('state', state)
    }

    res.redirect(redirectUrl.toString())
  } catch (err) {
    next(err)
  }
})

module.exports = router
