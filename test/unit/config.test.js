/* eslint-env jest */

/**
 * Configuration Presets Unit Tests
 */

const { PRESETS } = require('../../src/config/presets')

describe('Configuration Presets', () => {
  describe('Preset Structure Validation', () => {
    const presetNames = Object.keys(PRESETS)

    test('should have all expected presets', () => {
      expect(presetNames).toContain('auth0')
      expect(presetNames).toContain('okta')
      expect(presetNames).toContain('azureb2c')
      expect(presetNames).toContain('entraid')
      expect(presetNames).toContain('keycloak')
      expect(presetNames).toContain('identityserver')
      expect(presetNames).toContain('google')
      expect(presetNames).toContain('cognito')
      expect(presetNames).toContain('custom')
    })

    test.each(presetNames)('preset "%s" should have required structure', (presetName) => {
      const preset = PRESETS[presetName]

      // Check name
      expect(preset).toHaveProperty('name')
      expect(typeof preset.name).toBe('string')

      // Check endpoints
      expect(preset).toHaveProperty('endpoints')
      expect(preset.endpoints).toHaveProperty('authorize')
      expect(preset.endpoints).toHaveProperty('token')
      expect(preset.endpoints).toHaveProperty('jwks')
      expect(preset.endpoints).toHaveProperty('oidc')
      expect(preset.endpoints).toHaveProperty('userinfo')

      // Check claims
      expect(preset).toHaveProperty('claims')
      expect(preset.claims).toHaveProperty('scopeClaimName')
      expect(preset.claims).toHaveProperty('scopeFormat')

      // Check tokens
      expect(preset).toHaveProperty('tokens')
      expect(preset.tokens).toHaveProperty('accessTokenTTL')
      expect(preset.tokens).toHaveProperty('idTokenTTL')
      expect(preset.tokens).toHaveProperty('signingAlgorithm')

      // Check features
      expect(preset).toHaveProperty('features')
      expect(preset.features).toHaveProperty('pkce')
      expect(preset.features).toHaveProperty('refreshTokens')
      expect(preset.features).toHaveProperty('offlineAccess')
    })
  })

  describe('Microsoft Entra ID Preset', () => {
    const entraidPreset = PRESETS.entraid

    test('should have correct name', () => {
      expect(entraidPreset.name).toBe('Microsoft Entra ID')
    })

    test('should have v2.0 endpoints', () => {
      expect(entraidPreset.endpoints.authorize).toBe('/oauth2/v2.0/authorize')
      expect(entraidPreset.endpoints.token).toBe('/oauth2/v2.0/token')
      expect(entraidPreset.endpoints.jwks).toBe('/discovery/v2.0/keys')
      expect(entraidPreset.endpoints.oidc).toBe('/v2.0/.well-known/openid-configuration')
      expect(entraidPreset.endpoints.userinfo).toBe('/oidc/userinfo')
      expect(entraidPreset.endpoints.logout).toBe('/oauth2/v2.0/logout')
    })

    test('should not have introspect or revoke endpoints', () => {
      expect(entraidPreset.endpoints.introspect).toBeNull()
      expect(entraidPreset.endpoints.revoke).toBeNull()
    })

    test('should use scp claim for scopes', () => {
      expect(entraidPreset.claims.scopeClaimName).toBe('scp')
      expect(entraidPreset.claims.scopeFormat).toBe('string')
    })

    test('should support roles and groups as arrays', () => {
      expect(entraidPreset.claims.rolesClaimName).toBe('roles')
      expect(entraidPreset.claims.rolesFormat).toBe('array')
      expect(entraidPreset.claims.groupsClaimName).toBe('groups')
      expect(entraidPreset.claims.groupsFormat).toBe('array')
    })

    test('should not require namespaced claims', () => {
      expect(entraidPreset.claims.requireNamespacedClaims).toBe(false)
    })

    test('should not have permissions claim', () => {
      expect(entraidPreset.claims.permissionsClaimName).toBeNull()
    })

    test('should have appropriate token TTLs', () => {
      expect(entraidPreset.tokens.accessTokenTTL).toBe(3600) // 1 hour
      expect(entraidPreset.tokens.idTokenTTL).toBe(3600) // 1 hour
      expect(entraidPreset.tokens.refreshTokenTTL).toBe(86400) // 24 hours
    })

    test('should use RS256 signing algorithm', () => {
      expect(entraidPreset.tokens.signingAlgorithm).toBe('RS256')
    })

    test('should enable all standard features', () => {
      expect(entraidPreset.features.pkce).toBe(true)
      expect(entraidPreset.features.refreshTokens).toBe(true)
      expect(entraidPreset.features.offlineAccess).toBe(true)
    })
  })

  describe('Preset Comparisons', () => {
    test('entraid should differ from azureb2c in endpoints', () => {
      const entraid = PRESETS.entraid
      const azureb2c = PRESETS.azureb2c

      // Both use v2.0, but different userinfo paths
      expect(entraid.endpoints.userinfo).toBe('/oidc/userinfo')
      expect(azureb2c.endpoints.userinfo).toBe('/userinfo')

      // Both use same token and authorize paths
      expect(entraid.endpoints.authorize).toBe(azureb2c.endpoints.authorize)
      expect(entraid.endpoints.token).toBe(azureb2c.endpoints.token)
    })

    test('entraid and okta both use scp claim', () => {
      expect(PRESETS.entraid.claims.scopeClaimName).toBe('scp')
      expect(PRESETS.okta.claims.scopeClaimName).toBe('scp')
    })

    test('entraid uses string format for scopes while okta uses array', () => {
      expect(PRESETS.entraid.claims.scopeFormat).toBe('string')
      expect(PRESETS.okta.claims.scopeFormat).toBe('array')
    })
  })

  describe('Endpoint Paths', () => {
    test('all presets should have valid endpoint paths', () => {
      Object.entries(PRESETS).forEach(([name, preset]) => {
        // Paths should start with /
        if (preset.endpoints.authorize) {
          expect(preset.endpoints.authorize).toMatch(/^\//)
        }
        if (preset.endpoints.token) {
          expect(preset.endpoints.token).toMatch(/^\//)
        }
        if (preset.endpoints.jwks) {
          expect(preset.endpoints.jwks).toMatch(/^\//)
        }
        if (preset.endpoints.oidc) {
          expect(preset.endpoints.oidc).toMatch(/^\//)
        }
      })
    })
  })

  describe('Token TTL Values', () => {
    test('all presets should have positive TTL values', () => {
      Object.entries(PRESETS).forEach(([name, preset]) => {
        expect(preset.tokens.accessTokenTTL).toBeGreaterThan(0)
        expect(preset.tokens.idTokenTTL).toBeGreaterThan(0)

        // Refresh token TTL can be null for some presets
        if (preset.tokens.refreshTokenTTL !== null) {
          expect(preset.tokens.refreshTokenTTL).toBeGreaterThan(0)
        }
      })
    })

    test('access token TTL should be reasonable (between 5 min and 1 day)', () => {
      Object.entries(PRESETS).forEach(([name, preset]) => {
        const ttl = preset.tokens.accessTokenTTL
        expect(ttl).toBeGreaterThanOrEqual(300) // 5 minutes
        expect(ttl).toBeLessThanOrEqual(86400) // 24 hours
      })
    })
  })
})
