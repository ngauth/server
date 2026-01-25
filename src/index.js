const express = require('express')
const session = require('express-session')
const crypto = require('crypto')
const fs = require('fs').promises
const { initDb } = require('./db')
const { ensurePrivateKey } = require('./tokens')
const wellKnownRouter = require('./routes/well-known')
const jwksRouter = require('./routes/jwks')
const authorizeRouter = require('./routes/authorize')
const tokenRouter = require('./routes/token')
const registerRouter = require('./routes/register')
const { errorHandler } = require('./errors')

const PORT = process.env.PORT || 3000
const NGAUTH_DATA = process.env.NGAUTH_DATA || '/data'

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

  // Initialize database
  await initDb(NGAUTH_DATA)
}

// Initialize before setting up routes
initialize().catch(err => {
  console.error('Failed to initialize server:', err)
  process.exit(1)
})

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if behind HTTPS reverse proxy
}))

// Routes
app.use('/.well-known', wellKnownRouter)
app.use('/.well-known', jwksRouter)
app.use('/authorize', authorizeRouter)
app.use('/token', tokenRouter)
app.use('/register', registerRouter)

// Error handler
app.use(errorHandler)

if (require.main === module) {
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`OAuth 2.0 server listening on port ${PORT}`)
      console.log(`Data directory: ${NGAUTH_DATA}`)
    })
  }).catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}

module.exports = app
