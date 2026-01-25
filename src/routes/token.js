/* eslint camelcase: "off" */
const express = require('express')
const { getClient, getCode, deleteCode, cleanupExpiredCodes } = require('../db')
const { generateToken } = require('../tokens')
const { OAuthError } = require('../errors')

const router = express.Router()

// Parse client credentials from Authorization header or body
function getClientCredentials (req) {
  const authHeader = req.headers.authorization

  // Try client_secret_basic (Authorization header)
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.substring(6)
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8')
    const [client_id, client_secret] = credentials.split(':')
    return { client_id, client_secret }
  }

  // Try client_secret_post (body)
  return {
    client_id: req.body.client_id,
    client_secret: req.body.client_secret
  }
}

router.post('/', async (req, res, next) => {
  try {
    await cleanupExpiredCodes()

    const { grant_type, code, redirect_uri, scope } = req.body
    const { client_id, client_secret } = getClientCredentials(req)

    // Validate client credentials
    if (!client_id || !client_secret) {
      return next(new OAuthError('invalid_client', 'Missing client credentials'))
    }

    const client = await getClient(client_id)
    if (!client || client.client_secret !== client_secret) {
      return next(new OAuthError('invalid_client', 'Invalid client credentials'))
    }

    // Handle grant types
    if (grant_type === 'authorization_code') {
      return await handleAuthorizationCodeGrant(req, res, next, client, code, redirect_uri)
    } else if (grant_type === 'client_credentials') {
      return handleClientCredentialsGrant(req, res, next, client, scope)
    } else {
      return next(new OAuthError('unsupported_grant_type', 'Unsupported grant type'))
    }
  } catch (err) {
    next(err)
  }
})

async function handleAuthorizationCodeGrant (req, res, next, client, code, redirect_uri) {
  if (!code) {
    return next(new OAuthError('invalid_request', 'Missing code parameter'))
  }
  if (!redirect_uri) {
    return next(new OAuthError('invalid_request', 'Missing redirect_uri parameter'))
  }

  // Validate authorization code
  const authCode = await getCode(code)
  if (!authCode) {
    return next(new OAuthError('invalid_grant', 'Invalid authorization code'))
  }

  // Check if code is expired
  if (authCode.expiresAt < Date.now()) {
    await deleteCode(code)
    return next(new OAuthError('invalid_grant', 'Authorization code expired'))
  }

  // Validate client_id matches
  if (authCode.client_id !== client.client_id) {
    return next(new OAuthError('invalid_grant', 'Authorization code was issued to another client'))
  }

  // Validate redirect_uri matches
  if (authCode.redirect_uri !== redirect_uri) {
    return next(new OAuthError('invalid_grant', 'Redirect URI mismatch'))
  }

  // Delete code (single-use only per RFC 6749 4.1.2)
  await deleteCode(code)

  // Generate access token
  const payload = {
    sub: authCode.userId,
    client_id: client.client_id,
    scope: authCode.scope
  }

  const accessToken = generateToken(payload, '1h')

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: authCode.scope
  })
}

function handleClientCredentialsGrant (req, res, next, client, scope) {
  // Generate access token for client
  const payload = {
    sub: client.client_id,
    client_id: client.client_id,
    scope: scope || ''
  }

  const accessToken = generateToken(payload, '1h')

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: scope || ''
  })
}

module.exports = router
