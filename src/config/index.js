/**
 * Configuration Loader
 * 
 * Loads configuration from environment variables with preset support.
 */

const { PRESETS } = require('./presets');

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

function loadConfig() {
  const preset = process.env.NGAUTH_PRESET || 'custom';
  
  if (preset !== 'custom' && !PRESETS[preset]) {
    console.warn(`⚠️  Unknown preset: ${preset}. Available presets: ${Object.keys(PRESETS).join(', ')}`);
    console.warn(`⚠️  Falling back to 'custom' configuration.`);
    return loadCustomConfig();
  }

  if (preset === 'custom') {
    console.log('📝 Using custom configuration');
    return loadCustomConfig();
  }

  const presetConfig = PRESETS[preset];
  console.log(`🎭 Using preset: ${presetConfig.name}`);

  // Merge preset with any environment variable overrides
  const config = {
    preset: preset,
    name: presetConfig.name,
    port: parseInt(process.env.PORT || '3000'),
    issuer: process.env.NGAUTH_ISSUER || `http://localhost:${process.env.PORT || '3000'}`,
    endpoints: {
      authorize: process.env.NGAUTH_AUTHORIZE_PATH || presetConfig.endpoints.authorize,
      token: process.env.NGAUTH_TOKEN_PATH || presetConfig.endpoints.token,
      jwks: process.env.NGAUTH_JWKS_PATH || presetConfig.endpoints.jwks,
      oidc: process.env.NGAUTH_OIDC_PATH || presetConfig.endpoints.oidc,
      userinfo: process.env.NGAUTH_USERINFO_PATH || presetConfig.endpoints.userinfo,
      introspect: process.env.NGAUTH_INTROSPECT_PATH || presetConfig.endpoints.introspect,
      revoke: process.env.NGAUTH_REVOKE_PATH || presetConfig.endpoints.revoke,
      logout: process.env.NGAUTH_LOGOUT_PATH || presetConfig.endpoints.logout
    },
    claims: {
      scopeClaimName: process.env.NGAUTH_SCOPE_CLAIM_NAME || presetConfig.claims.scopeClaimName,
      scopeFormat: process.env.NGAUTH_SCOPE_FORMAT || presetConfig.claims.scopeFormat,
      rolesClaimName: process.env.NGAUTH_ROLES_CLAIM_NAME || presetConfig.claims.rolesClaimName,
      rolesFormat: presetConfig.claims.rolesFormat || 'array',
      groupsClaimName: process.env.NGAUTH_GROUPS_CLAIM_NAME || presetConfig.claims.groupsClaimName,
      groupsFormat: presetConfig.claims.groupsFormat || 'array',
      permissionsClaimName: process.env.NGAUTH_PERMISSIONS_CLAIM_NAME || presetConfig.claims.permissionsClaimName,
      permissionsFormat: presetConfig.claims.permissionsFormat || 'array',
      requireNamespacedClaims: parseBoolean(
        process.env.NGAUTH_REQUIRE_NAMESPACED_CLAIMS, 
        presetConfig.claims.requireNamespacedClaims
      ),
      namespacePrefix: process.env.NGAUTH_NAMESPACE_PREFIX || presetConfig.claims.namespacePrefix || '',
      useRealmAccess: parseBoolean(
        process.env.NGAUTH_USE_REALM_ACCESS, 
        presetConfig.claims.useRealmAccess
      ),
      useResourceAccess: parseBoolean(
        process.env.NGAUTH_USE_RESOURCE_ACCESS, 
        presetConfig.claims.useResourceAccess
      ),
      cognitoPrefix: presetConfig.claims.cognitoPrefix || ''
    },
    tokens: {
      accessTokenTTL: parseInt(
        process.env.NGAUTH_ACCESS_TOKEN_TTL || presetConfig.tokens.accessTokenTTL.toString()
      ),
      idTokenTTL: parseInt(
        process.env.NGAUTH_ID_TOKEN_TTL || presetConfig.tokens.idTokenTTL.toString()
      ),
      refreshTokenTTL: parseInt(
        process.env.NGAUTH_REFRESH_TOKEN_TTL || presetConfig.tokens.refreshTokenTTL?.toString() || '86400'
      ),
      signingAlgorithm: process.env.NGAUTH_TOKEN_SIGNING_ALG || presetConfig.tokens.signingAlgorithm
    },
    features: {
      pkce: parseBoolean(process.env.NGAUTH_SUPPORT_PKCE, presetConfig.features.pkce),
      refreshTokens: parseBoolean(
        process.env.NGAUTH_SUPPORT_REFRESH_TOKENS, 
        presetConfig.features.refreshTokens
      ),
      offlineAccess: parseBoolean(
        process.env.NGAUTH_SUPPORT_OFFLINE_ACCESS, 
        presetConfig.features.offlineAccess
      )
    }
  };

  return config;
}

function loadCustomConfig() {
  const port = parseInt(process.env.PORT || '3000');
  
  return {
    preset: 'custom',
    name: 'Custom Configuration',
    port: port,
    issuer: process.env.NGAUTH_ISSUER || `http://localhost:${port}`,
    endpoints: {
      authorize: process.env.NGAUTH_AUTHORIZE_PATH || '/authorize',
      token: process.env.NGAUTH_TOKEN_PATH || '/token',
      jwks: process.env.NGAUTH_JWKS_PATH || '/.well-known/jwks.json',
      oidc: process.env.NGAUTH_OIDC_PATH || '/.well-known/openid-configuration',
      userinfo: process.env.NGAUTH_USERINFO_PATH || '/userinfo',
      introspect: process.env.NGAUTH_INTROSPECT_PATH || '/introspect',
      revoke: process.env.NGAUTH_REVOKE_PATH || '/revoke',
      logout: process.env.NGAUTH_LOGOUT_PATH || '/logout'
    },
    claims: {
      scopeClaimName: process.env.NGAUTH_SCOPE_CLAIM_NAME || 'scope',
      scopeFormat: process.env.NGAUTH_SCOPE_FORMAT || 'string',
      rolesClaimName: process.env.NGAUTH_ROLES_CLAIM_NAME || 'roles',
      rolesFormat: 'array',
      groupsClaimName: process.env.NGAUTH_GROUPS_CLAIM_NAME || 'groups',
      groupsFormat: 'array',
      permissionsClaimName: process.env.NGAUTH_PERMISSIONS_CLAIM_NAME || 'permissions',
      permissionsFormat: 'array',
      requireNamespacedClaims: parseBoolean(process.env.NGAUTH_REQUIRE_NAMESPACED_CLAIMS, false),
      namespacePrefix: process.env.NGAUTH_NAMESPACE_PREFIX || '',
      useRealmAccess: parseBoolean(process.env.NGAUTH_USE_REALM_ACCESS, false),
      useResourceAccess: parseBoolean(process.env.NGAUTH_USE_RESOURCE_ACCESS, false),
      cognitoPrefix: ''
    },
    tokens: {
      accessTokenTTL: parseInt(process.env.NGAUTH_ACCESS_TOKEN_TTL || '3600'),
      idTokenTTL: parseInt(process.env.NGAUTH_ID_TOKEN_TTL || '3600'),
      refreshTokenTTL: parseInt(process.env.NGAUTH_REFRESH_TOKEN_TTL || '86400'),
      signingAlgorithm: process.env.NGAUTH_TOKEN_SIGNING_ALG || 'RS256'
    },
    features: {
      pkce: parseBoolean(process.env.NGAUTH_SUPPORT_PKCE, true),
      refreshTokens: parseBoolean(process.env.NGAUTH_SUPPORT_REFRESH_TOKENS, true),
      offlineAccess: parseBoolean(process.env.NGAUTH_SUPPORT_OFFLINE_ACCESS, true)
    }
  };
}

// Load and export configuration
const config = loadConfig();

module.exports = config;
