const rateLimit = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: {
    error: 'too_many_requests',
    error_description: 'Too many login attempts, please try again later'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV === 'test' // Skip in test environment
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 registrations per hour
  message: {
    error: 'invalid_request',
    error_description: 'Too many registration attempts'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test'
})

module.exports = {
  loginLimiter,
  registerLimiter
}
