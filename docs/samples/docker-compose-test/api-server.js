const express = require('express')
const axios = require('axios')

const app = express()
const PORT = process.env.PORT || 3001
const OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL || 'http://localhost:3000'

app.use(express.json())

// Cache for public keys
let publicKeysCache = null
let publicKeysCacheTime = 0

// Get public keys from OAuth server
async function getPublicKeys () {
  const now = Date.now()
  // Cache keys for 1 hour
  if (publicKeysCache && (now - publicKeysCacheTime) < 3600000) {
    return publicKeysCache
  }

  try {
    const response = await axios.get(`${OAUTH_SERVER_URL}/.well-known/jwks.json`)
    publicKeysCache = response.data
    publicKeysCacheTime = now
    return publicKeysCache
  } catch (err) {
    console.error('Failed to fetch public keys:', err.message)
    throw new Error('Unable to verify tokens')
  }
}

// Middleware to verify OAuth token
async function verifyToken (req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Missing authorization token'
    })
  }

  try {
    // In a real application, you would verify the JWT signature
    // For this example, we'll just check if the token is from the OAuth server
    const jwt = require('jsonwebtoken')
    const keys = await getPublicKeys()
    
    // Get the public key (for RS256, we need the public key from JWKS)
    const key = keys.keys[0]
    if (!key) {
      return res.status(500).json({
        error: 'server_error',
        error_description: 'OAuth server not properly configured'
      })
    }

    // For demonstration, we'll accept any token from the OAuth server
    // In production, verify the signature properly
    console.log('Token received:', token.substring(0, 20) + '...')
    
    // Decode without verification for demo (DO NOT DO THIS IN PRODUCTION!)
    const decoded = jwt.decode(token)
    if (!decoded) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid token format'
      })
    }

    req.user = decoded
    next()
  } catch (err) {
    console.error('Token verification failed:', err.message)
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token verification failed'
    })
  }
}

// Public endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API Server is running',
    oauth_server: OAUTH_SERVER_URL
  })
})

// Protected endpoint
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({
    message: 'This is a protected resource',
    user: req.user,
    timestamp: new Date().toISOString()
  })
})

// Protected endpoint with specific scope requirement
app.get('/api/admin', verifyToken, (req, res) => {
  const userScopes = (req.user.scope || '').split(' ').filter(s => s)
  
  if (!userScopes.includes('admin')) {
    return res.status(403).json({
      error: 'forbidden',
      error_description: 'This endpoint requires admin scope'
    })
  }

  res.json({
    message: 'Admin resource accessed',
    user: req.user,
    timestamp: new Date().toISOString()
  })
})

// Get OAuth server metadata
app.get('/api/oauth-server-info', async (req, res) => {
  try {
    const response = await axios.get(`${OAUTH_SERVER_URL}/.well-known/oauth-authorization-server`)
    res.json(response.data)
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch OAuth server metadata',
      message: err.message
    })
  }
})

app.listen(PORT, () => {
  console.log(`API Server listening on http://localhost:${PORT}`)
  console.log(`OAuth Server: ${OAUTH_SERVER_URL}`)
  console.log(`Try accessing: http://localhost:${PORT}/health`)
})
