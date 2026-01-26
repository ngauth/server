const express = require('express')
const { getPublicKeyJwk } = require('../tokens')
const db = require('../db')

const router = express.Router()

/**
 * Liveness probe - is the application running?
 * Returns 200 if the process is alive, regardless of dependencies
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

/**
 * Readiness probe - is the application ready to serve traffic?
 * Checks critical dependencies like key initialization and database
 */
router.get('/health/ready', async (req, res) => {
  const checks = {
    keys: false,
    database: false
  }

  try {
    // Check if JWKS key is initialized
    const jwk = getPublicKeyJwk()
    checks.keys = jwk && jwk.kty === 'RSA'
  } catch (err) {
    checks.keys = false
  }

  try {
    // Check if database is accessible
    const users = await db.getUsers()
    checks.database = Array.isArray(users)
  } catch (err) {
    checks.database = false
  }

  const isReady = checks.keys && checks.database

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  })
})

/**
 * Startup probe - has the application finished initialization?
 * More lenient than readiness, used during container startup
 */
router.get('/health/startup', (req, res) => {
  try {
    const jwk = getPublicKeyJwk()
    const isStarted = jwk && jwk.kty === 'RSA'

    res.status(isStarted ? 200 : 503).json({
      status: isStarted ? 'started' : 'starting',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    res.status(503).json({
      status: 'starting',
      error: err.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router
