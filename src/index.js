const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const csrf = require('csurf')
const helmet = require('helmet')
const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')
const config = require('./config')
const { initDb, cleanupExpiredCodes } = require('./db')
const { ensurePrivateKey, getPublicKeyPem } = require('./tokens')
const { setPublicKey } = require('./auth')
const { auditMiddleware, initAuditLog } = require('./middleware/auditLog')
const { loginLimiter, registerLimiter } = require('./middleware/rateLimit')
const healthRouter = require('./routes/health')
const wellKnownRouter = require('./routes/well-known')
const jwksRouter = require('./routes/jwks')
const authorizeRouter = require('./routes/authorize')
const tokenRouter = require('./routes/token')
const registerRouter = require('./routes/register')
const userinfoRouter = require('./routes/userinfo')
const usersRouter = require('./routes/users')
const { errorHandler } = require('./errors')

const PORT = config.port
const NGAUTH_DATA = process.env.NGAUTH_DATA || './data'

const app = express()

// Async initialization function
async function initialize () {
  // Ensure data directory exists
  try {
    await fs.access(NGAUTH_DATA)
  } catch {
    await fs.mkdir(NGAUTH_DATA, { recursive: true })
  }

  // Ensure private key exists
  await ensurePrivateKey(NGAUTH_DATA)

  // Validate private key file permissions
  validateKeyFilePermissions(NGAUTH_DATA)

  // Initialize auth module with public key
  const publicKeyPem = getPublicKeyPem()
  setPublicKey(publicKeyPem)

  // Initialize audit logging
  initAuditLog(NGAUTH_DATA)

  // Initialize database
  await initDb(NGAUTH_DATA)

  // Cleanup expired authorization codes on startup (skip in test environment)
  if (process.env.NODE_ENV !== 'test') {
    try {
      await cleanupExpiredCodes()
      console.log('Cleaned up expired authorization codes')
    } catch (err) {
      console.warn('Failed to cleanup expired codes:', err.message)
    }
  }
}

// Validate private key file has secure permissions
function validateKeyFilePermissions (dataDir) {
  const keyPath = path.join(dataDir, 'private-key.pem')
  try {
    const stats = fs.statSync(keyPath)
    const mode = stats.mode & parseInt('777', 8)

    // Warn if file is readable by others
    if (mode & parseInt('044', 8)) {
      console.warn(`⚠️  WARNING: Private key file ${keyPath} is readable by others (permissions: ${(mode).toString(8)})`)
      console.warn('Run: chmod 600 ' + keyPath)
    }
  } catch (e) {
    // File doesn't exist yet, will be created
  }
}

// Initialize before setting up routes
initialize().catch(err => {
  console.error('Failed to initialize server:', err)
  process.exit(1)
})

// Health checks first (no middleware required)
app.use(healthRouter)

// Security headers with helmet
app.use(helmet({
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  }
}))

// Body parsing middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Cookie and CSRF protection
app.use(cookieParser(process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')))

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Set to true if behind HTTPS reverse proxy
    httpOnly: true,
    sameSite: 'strict'
  }
}))

// CSRF protection (only for HTML forms, skip API routes)
app.use((req, res, next) => {
  // Skip CSRF for API routes (they use Bearer tokens) and health checks
  if (req.path.startsWith('/token') || req.path.startsWith('/userinfo') || req.path.startsWith('/users') || req.path.startsWith('/.well-known') || req.path.startsWith('/register') || req.path.startsWith('/health')) {
    return next()
  }
  csrf({ cookie: false })(req, res, next)
})

// Audit logging
app.use(auditMiddleware)

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(307, `https://${req.header('host')}${req.url}`)
    }
    next()
  })
}

// Routes (using preset-configured endpoints)
app.use(config.endpoints.oidc, wellKnownRouter)
app.use(config.endpoints.jwks, jwksRouter)
app.use(config.endpoints.authorize, loginLimiter, authorizeRouter)
app.use(config.endpoints.token, loginLimiter, tokenRouter)
if (config.endpoints.userinfo) {
  app.use(config.endpoints.userinfo, userinfoRouter)
}
app.use('/register', registerLimiter, registerRouter)
app.use('/users', usersRouter)

// Error handler
app.use(errorHandler)

if (require.main === module) {
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 ngauth server listening on port ${PORT}`)
      console.log(`📁 Data directory: ${NGAUTH_DATA}`)
      console.log(`🌐 Issuer: ${config.issuer}`)
      if (config.preset !== 'custom') {
        console.log(`🎭 Preset: ${config.name}`)
      }
    })
  }).catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}

module.exports = app
