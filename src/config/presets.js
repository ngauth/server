/**
 * OAuth Provider Presets
 * 
 * Pre-configured settings that mimic popular OAuth/OIDC providers
 * for realistic integration testing.
 */

const PRESETS = {
  auth0: {
    name: 'Auth0',
    endpoints: {
      authorize: '/authorize',
      token: '/oauth/token',
      jwks: '/.well-known/jwks.json',
      oidc: '/.well-known/openid-configuration',
      userinfo: '/userinfo',
      introspect: '/oauth/introspect',
      revoke: '/oauth/revoke',
      logout: '/v2/logout'
    },
    claims: {
      scopeClaimName: 'scope',
      scopeFormat: 'string',
      rolesClaimName: null,
      groupsClaimName: null,
      permissionsClaimName: 'permissions',
      permissionsFormat: 'array',
      requireNamespacedClaims: true,
      namespacePrefix: 'https://ngauth.local'
    },
    tokens: {
      accessTokenTTL: 86400,
      idTokenTTL: 36000,
      refreshTokenTTL: 2592000,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  okta: {
    name: 'Okta',
    endpoints: {
      authorize: '/oauth2/default/v1/authorize',
      token: '/oauth2/default/v1/token',
      jwks: '/oauth2/default/v1/keys',
      oidc: '/oauth2/default/.well-known/openid-configuration',
      userinfo: '/oauth2/default/v1/userinfo',
      introspect: '/oauth2/default/v1/introspect',
      revoke: '/oauth2/default/v1/revoke',
      logout: '/oauth2/default/v1/logout'
    },
    claims: {
      scopeClaimName: 'scp',
      scopeFormat: 'array',
      rolesClaimName: null,
      groupsClaimName: 'groups',
      groupsFormat: 'array',
      permissionsClaimName: null,
      requireNamespacedClaims: false
    },
    tokens: {
      accessTokenTTL: 3600,
      idTokenTTL: 3600,
      refreshTokenTTL: 86400,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  azureb2c: {
    name: 'Azure AD B2C',
    endpoints: {
      authorize: '/oauth2/v2.0/authorize',
      token: '/oauth2/v2.0/token',
      jwks: '/discovery/v2.0/keys',
      oidc: '/v2.0/.well-known/openid-configuration',
      userinfo: '/userinfo',
      introspect: null,
      revoke: null,
      logout: '/oauth2/v2.0/logout'
    },
    claims: {
      scopeClaimName: 'scp',
      scopeFormat: 'string',
      rolesClaimName: 'roles',
      rolesFormat: 'array',
      groupsClaimName: 'groups',
      groupsFormat: 'array',
      permissionsClaimName: null,
      requireNamespacedClaims: false
    },
    tokens: {
      accessTokenTTL: 3600,
      idTokenTTL: 3600,
      refreshTokenTTL: 86400,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  keycloak: {
    name: 'Keycloak',
    endpoints: {
      authorize: '/realms/master/protocol/openid-connect/auth',
      token: '/realms/master/protocol/openid-connect/token',
      jwks: '/realms/master/protocol/openid-connect/certs',
      oidc: '/realms/master/.well-known/openid-configuration',
      userinfo: '/realms/master/protocol/openid-connect/userinfo',
      introspect: '/realms/master/protocol/openid-connect/token/introspect',
      revoke: '/realms/master/protocol/openid-connect/revoke',
      logout: '/realms/master/protocol/openid-connect/logout'
    },
    claims: {
      scopeClaimName: 'scope',
      scopeFormat: 'string',
      rolesClaimName: 'realm_access',
      rolesFormat: 'object',
      useRealmAccess: true,
      useResourceAccess: true,
      groupsClaimName: 'groups',
      groupsFormat: 'array',
      permissionsClaimName: null,
      requireNamespacedClaims: false
    },
    tokens: {
      accessTokenTTL: 300,
      idTokenTTL: 300,
      refreshTokenTTL: 1800,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  identityserver: {
    name: 'Duende IdentityServer',
    endpoints: {
      authorize: '/connect/authorize',
      token: '/connect/token',
      jwks: '/.well-known/openid-configuration/jwks',
      oidc: '/.well-known/openid-configuration',
      userinfo: '/connect/userinfo',
      introspect: '/connect/introspect',
      revoke: '/connect/revocation',
      logout: '/connect/endsession'
    },
    claims: {
      scopeClaimName: 'scope',
      scopeFormat: 'string',
      rolesClaimName: 'role',
      rolesFormat: 'array',
      groupsClaimName: null,
      permissionsClaimName: null,
      requireNamespacedClaims: false
    },
    tokens: {
      accessTokenTTL: 3600,
      idTokenTTL: 3600,
      refreshTokenTTL: 2592000,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  google: {
    name: 'Google Identity Platform',
    endpoints: {
      authorize: '/o/oauth2/v2/auth',
      token: '/oauth2/v4/token',
      jwks: '/oauth2/v3/certs',
      oidc: '/.well-known/openid-configuration',
      userinfo: '/oauth2/v3/userinfo',
      introspect: '/oauth2/v3/tokeninfo',
      revoke: '/o/oauth2/revoke',
      logout: null
    },
    claims: {
      scopeClaimName: 'scope',
      scopeFormat: 'string',
      rolesClaimName: null,
      groupsClaimName: null,
      permissionsClaimName: null,
      requireNamespacedClaims: false
    },
    tokens: {
      accessTokenTTL: 3600,
      idTokenTTL: 3600,
      refreshTokenTTL: null,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  cognito: {
    name: 'AWS Cognito',
    endpoints: {
      authorize: '/oauth2/authorize',
      token: '/oauth2/token',
      jwks: '/.well-known/jwks.json',
      oidc: '/.well-known/openid-configuration',
      userinfo: '/oauth2/userInfo',
      introspect: null,
      revoke: '/oauth2/revoke',
      logout: '/logout'
    },
    claims: {
      scopeClaimName: 'scope',
      scopeFormat: 'string',
      rolesClaimName: null,
      groupsClaimName: 'cognito:groups',
      groupsFormat: 'array',
      permissionsClaimName: null,
      requireNamespacedClaims: false,
      cognitoPrefix: 'cognito:'
    },
    tokens: {
      accessTokenTTL: 3600,
      idTokenTTL: 3600,
      refreshTokenTTL: 2592000,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  },

  custom: {
    name: 'Custom Configuration',
    endpoints: {
      authorize: '/authorize',
      token: '/token',
      jwks: '/.well-known/jwks.json',
      oidc: '/.well-known/openid-configuration',
      userinfo: '/userinfo',
      introspect: '/introspect',
      revoke: '/revoke',
      logout: '/logout'
    },
    claims: {
      scopeClaimName: 'scope',
      scopeFormat: 'string',
      rolesClaimName: 'roles',
      rolesFormat: 'array',
      groupsClaimName: 'groups',
      groupsFormat: 'array',
      permissionsClaimName: 'permissions',
      permissionsFormat: 'array',
      requireNamespacedClaims: false
    },
    tokens: {
      accessTokenTTL: 3600,
      idTokenTTL: 3600,
      refreshTokenTTL: 86400,
      signingAlgorithm: 'RS256'
    },
    features: {
      pkce: true,
      refreshTokens: true,
      offlineAccess: true
    }
  }
};

module.exports = { PRESETS };
