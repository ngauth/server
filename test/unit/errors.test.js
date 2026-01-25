/* global describe, test, expect, beforeEach, jest */
const { OAuthError, errorHandler } = require('../../src/errors')

describe('OAuth Error Handling', () => {
  describe('OAuthError', () => {
    test('should create error with default status code', () => {
      const error = new OAuthError('invalid_request', 'Missing required parameter')

      expect(error).toBeInstanceOf(Error)
      expect(error.error).toBe('invalid_request')
      expect(error.error_description).toBe('Missing required parameter')
      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Missing required parameter')
    })

    test('should create error with custom status code', () => {
      const error = new OAuthError('server_error', 'Internal error', 500)

      expect(error.error).toBe('server_error')
      expect(error.statusCode).toBe(500)
    })

    test('should support all RFC 6749 error codes', () => {
      const errorCodes = [
        'invalid_request',
        'invalid_client',
        'invalid_grant',
        'unauthorized_client',
        'unsupported_grant_type',
        'invalid_scope'
      ]

      errorCodes.forEach(code => {
        const error = new OAuthError(code, 'Test description')
        expect(error.error).toBe(code)
      })
    })
  })

  describe('errorHandler', () => {
    let req, res, next

    beforeEach(() => {
      req = {}
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      }
      next = jest.fn()
    })

    test('should handle OAuthError correctly', () => {
      const error = new OAuthError('invalid_client', 'Client authentication failed', 401)

      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      })
    })

    test('should use default 400 status for OAuthError', () => {
      const error = new OAuthError('invalid_request', 'Bad request')

      errorHandler(error, req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    test('should handle generic errors as server_error', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      const error = new Error('Unexpected error')

      errorHandler(error, req, res, next)

      expect(consoleError).toHaveBeenCalledWith(error)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'An unexpected error occurred'
      })

      consoleError.mockRestore()
    })

    test('should return correct error format for invalid_grant', () => {
      const error = new OAuthError('invalid_grant', 'Authorization code expired')

      errorHandler(error, req, res, next)

      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_grant',
        error_description: 'Authorization code expired'
      })
    })

    test('should return correct error format for unsupported_grant_type', () => {
      const error = new OAuthError('unsupported_grant_type', 'Grant type not supported')

      errorHandler(error, req, res, next)

      expect(res.json).toHaveBeenCalledWith({
        error: 'unsupported_grant_type',
        error_description: 'Grant type not supported'
      })
    })

    test('should not call next middleware', () => {
      const error = new OAuthError('invalid_request', 'Test')

      errorHandler(error, req, res, next)

      expect(next).not.toHaveBeenCalled()
    })
  })
})
