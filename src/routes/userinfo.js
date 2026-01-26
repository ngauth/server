/* eslint camelcase: "off" */

/**
 * OIDC Userinfo Endpoint (RFC 6749 extension)
 * Returns claims about the authenticated end-user
 */

const express = require('express')
const { verifyToken } = require('../tokens')
const { getUserById } = require('../db')
const { buildUserinfoResponse } = require('../oidc')

const router = express.Router()

// Middleware to verify access token
async function verifyAccessToken (req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid authorization header'
    })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = verifyToken(token)
    req.token = decoded
    req.userId = decoded.sub
    req.scope = decoded.scope || ''
    next()
  } catch (err) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Invalid or expired access token'
    })
  }
}

// GET /userinfo - Return user information
router.get('/', verifyAccessToken, async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid token: missing user ID'
      })
    }

    const user = await getUserById(req.userId)
    if (!user) {
      return res.status(404).json({
        error: 'invalid_request',
        error_description: 'User not found'
      })
    }

    const userinfo = buildUserinfoResponse(user, req.scope)
    res.json(userinfo)
  } catch (err) {
    next(err)
  }
})

module.exports = router
