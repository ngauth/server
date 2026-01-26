/* eslint-env jest */

/**
 * OIDC Claims Module Unit Tests
 */

const {
  getClaimsForScope,
  buildIdTokenClaims,
  buildUserinfoResponse
} = require('../../src/oidc')

describe('OIDC Claims Module', () => {
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    created_at: '2024-01-01T00:00:00Z'
  }

  describe('getClaimsForScope', () => {
    test('should return sub claim for empty scope', () => {
      const claims = getClaimsForScope('', mockUser)
      expect(claims).toEqual({ sub: mockUser.id })
    })

    test('should return sub claim for null scope', () => {
      const claims = getClaimsForScope(null, mockUser)
      expect(claims).toEqual({ sub: mockUser.id })
    })

    test('should include profile claims when profile scope is requested', () => {
      const claims = getClaimsForScope('openid profile', mockUser)
      expect(claims).toHaveProperty('sub')
      expect(claims).toHaveProperty('name')
      expect(claims).toHaveProperty('preferred_username')
      expect(claims).toHaveProperty('updated_at')
      expect(claims.name).toBe(mockUser.name)
      expect(claims.preferred_username).toBe(mockUser.username)
    })

    test('should include email claims when email scope is requested', () => {
      const claims = getClaimsForScope('openid email', mockUser)
      expect(claims).toHaveProperty('sub')
      expect(claims).toHaveProperty('email')
      expect(claims).toHaveProperty('email_verified')
      expect(claims.email).toBe(mockUser.email)
      expect(claims.email_verified).toBe(true)
    })

    test('should include both profile and email claims', () => {
      const claims = getClaimsForScope('openid profile email', mockUser)
      expect(claims).toHaveProperty('sub')
      expect(claims).toHaveProperty('name')
      expect(claims).toHaveProperty('email')
      expect(claims.name).toBe(mockUser.name)
      expect(claims.email).toBe(mockUser.email)
    })
  })

  describe('buildIdTokenClaims', () => {
    test('should build ID token with required OIDC claims', () => {
      const issuer = 'https://auth.example.com'
      const clientId = 'client-123'
      const scope = 'openid profile'

      const claims = buildIdTokenClaims(mockUser, clientId, issuer, scope)

      expect(claims).toHaveProperty('iss')
      expect(claims.iss).toBe(issuer)
      expect(claims).toHaveProperty('sub')
      expect(claims.sub).toBe(mockUser.id)
      expect(claims).toHaveProperty('aud')
      expect(claims.aud).toBe(clientId)
      expect(claims).toHaveProperty('exp')
      expect(claims).toHaveProperty('iat')
      expect(claims.exp).toBeGreaterThan(claims.iat)
    })

    test('should include nonce if provided', () => {
      const issuer = 'https://auth.example.com'
      const clientId = 'client-123'
      const scope = 'openid'
      const nonce = 'nonce-123'

      const claims = buildIdTokenClaims(mockUser, clientId, issuer, scope, nonce)

      expect(claims).toHaveProperty('nonce')
      expect(claims.nonce).toBe(nonce)
    })

    test('should not include nonce if not provided', () => {
      const issuer = 'https://auth.example.com'
      const clientId = 'client-123'
      const scope = 'openid'

      const claims = buildIdTokenClaims(mockUser, clientId, issuer, scope)

      expect(claims).not.toHaveProperty('nonce')
    })

    test('should include user claims based on scope', () => {
      const issuer = 'https://auth.example.com'
      const clientId = 'client-123'
      const scope = 'openid profile email'

      const claims = buildIdTokenClaims(mockUser, clientId, issuer, scope)

      expect(claims).toHaveProperty('name')
      expect(claims).toHaveProperty('email')
      expect(claims).toHaveProperty('preferred_username')
    })

    test('should have correct expiration time (1 hour)', () => {
      const issuer = 'https://auth.example.com'
      const clientId = 'client-123'
      const scope = 'openid'

      const before = Math.floor(Date.now() / 1000)
      const claims = buildIdTokenClaims(mockUser, clientId, issuer, scope)
      const after = Math.floor(Date.now() / 1000)

      // exp should be approximately 1 hour (3600 seconds) from now
      const expiresIn = claims.exp - claims.iat
      expect(expiresIn).toBe(3600)

      // iat should be approximately now
      expect(claims.iat).toBeGreaterThanOrEqual(before)
      expect(claims.iat).toBeLessThanOrEqual(after)
    })
  })

  describe('buildUserinfoResponse', () => {
    test('should return sub claim for empty scope', () => {
      const userinfo = buildUserinfoResponse(mockUser, '')
      expect(userinfo).toEqual({ sub: mockUser.id })
    })

    test('should include profile claims when profile scope is authorized', () => {
      const userinfo = buildUserinfoResponse(mockUser, 'profile')
      expect(userinfo).toHaveProperty('sub')
      expect(userinfo).toHaveProperty('name')
      expect(userinfo).toHaveProperty('preferred_username')
      expect(userinfo).toHaveProperty('updated_at')
    })

    test('should include email claims when email scope is authorized', () => {
      const userinfo = buildUserinfoResponse(mockUser, 'email')
      expect(userinfo).toHaveProperty('sub')
      expect(userinfo).toHaveProperty('email')
      expect(userinfo).toHaveProperty('email_verified')
    })

    test('should respect scope limitations', () => {
      // Only profile scope - no email
      const userinfo = buildUserinfoResponse(mockUser, 'profile')
      expect(userinfo).not.toHaveProperty('email')
      expect(userinfo).toHaveProperty('name')
    })

    test('should handle multiple scopes', () => {
      const userinfo = buildUserinfoResponse(mockUser, 'profile email')
      expect(userinfo).toHaveProperty('name')
      expect(userinfo).toHaveProperty('email')
    })

    test('should not include sensitive claims without proper scope', () => {
      const userinfo = buildUserinfoResponse(mockUser, '')
      // Without scope, only sub should be returned
      expect(Object.keys(userinfo)).toEqual(['sub'])
    })
  })
})
