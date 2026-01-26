/* eslint camelcase: "off" */
/* eslint-env jest */

/**
 * OIDC (OpenID Connect) Integration Tests
 */

const request = require('supertest')
const app = require('../../src/index')

describe('OIDC Integration Tests', () => {
  describe('OIDC Discovery (.well-known/openid-configuration)', () => {
    test('should serve OpenID Configuration endpoint', async () => {
      const response = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200)

      expect(response.body).toHaveProperty('issuer')
      expect(response.body).toHaveProperty('authorization_endpoint')
      expect(response.body).toHaveProperty('token_endpoint')
      expect(response.body).toHaveProperty('userinfo_endpoint')
      expect(response.body).toHaveProperty('jwks_uri')
      expect(response.body.scopes_supported).toContain('openid')
      expect(response.body.scopes_supported).toContain('profile')
      expect(response.body.scopes_supported).toContain('email')
      expect(response.body.claims_supported).toContain('sub')
      expect(response.body.claims_supported).toContain('email')
      expect(response.body.claims_supported).toContain('name')
    })

    test('should include OIDC-specific metadata fields', async () => {
      const response = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200)

      expect(response.body).toHaveProperty('id_token_signing_alg_values_supported')
      expect(response.body.id_token_signing_alg_values_supported).toContain('RS256')
      expect(response.body).toHaveProperty('subject_types_supported')
      expect(response.body.subject_types_supported).toContain('public')
    })
  })

  describe('JWKS Endpoint with OIDC', () => {
    test('should serve JWKS endpoint with proper format', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200)

      expect(response.body).toHaveProperty('keys')
      expect(Array.isArray(response.body.keys)).toBe(true)
      expect(response.body.keys.length).toBeGreaterThan(0)

      const key = response.body.keys[0]
      expect(key).toHaveProperty('use')
      expect(key.use).toBe('sig')
      expect(key).toHaveProperty('alg')
      expect(key.alg).toBe('RS256')
      expect(key).toHaveProperty('kid')
    })
  })

  describe('Userinfo Endpoint', () => {
    test('should reject userinfo request without authorization header', async () => {
      await request(app)
        .get('/userinfo')
        .expect(401)
    })

    test('should reject userinfo request with invalid token', async () => {
      await request(app)
        .get('/userinfo')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)
    })
  })
})
