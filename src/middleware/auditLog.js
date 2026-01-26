const fs = require('fs')
const path = require('path')

let auditLogPath

function initAuditLog (dataDir) {
  auditLogPath = path.join(dataDir, 'audit.log')
}

function logSecurityEvent (event) {
  if (!auditLogPath) {
    return
  }

  const timestamp = new Date().toISOString()
  const logEntry = JSON.stringify({
    timestamp,
    ...event
  })

  fs.appendFile(auditLogPath, logEntry + '\n', (err) => {
    if (err && process.env.NODE_ENV !== 'test') {
      console.error('Failed to write audit log:', err)
    }
  })
}

function auditMiddleware (req, res, next) {
  const originalSend = res.send

  res.send = function (data) {
    if (req.path.includes('/users') || req.path.includes('/token') || req.path.includes('/authorize')) {
      const statusCode = res.statusCode

      // Log failed authentications
      if ((statusCode === 401 || statusCode === 403) && (req.path.includes('/users') || req.path.includes('/token'))) {
        logSecurityEvent({
          type: 'AUTH_FAILED',
          method: req.method,
          path: req.path,
          ip: req.ip || req.connection.remoteAddress,
          statusCode
        })
      }

      // Log sensitive operations
      if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.path.includes('/users')) {
        logSecurityEvent({
          type: 'USER_OPERATION',
          method: req.method,
          path: req.path,
          ip: req.ip || req.connection.remoteAddress,
          statusCode,
          userId: req.user?.sub || 'anonymous'
        })
      }
    }

    return originalSend.call(this, data)
  }

  next()
}

module.exports = {
  auditMiddleware,
  logSecurityEvent,
  initAuditLog
}
