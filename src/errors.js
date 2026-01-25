// OAuth 2.0 Error class (RFC 6749 5.2)
class OAuthError extends Error {
  constructor (error, errorDescription, statusCode = 400) {
    super(errorDescription)
    this.error = error
    this.error_description = errorDescription
    this.statusCode = statusCode
  }
}

// Error handler middleware
function errorHandler (err, req, res, next) {
  if (err instanceof OAuthError) {
    return res.status(err.statusCode).json({
      error: err.error,
      error_description: err.error_description
    })
  }

  // Generic error
  console.error(err)
  res.status(500).json({
    error: 'server_error',
    error_description: 'An unexpected error occurred'
  })
}

module.exports = {
  OAuthError,
  errorHandler
}
