/* eslint camelcase: "off" */

const express = require('express')
const config = require('../config')
const { getClients } = require('../db')

const router = express.Router()

// Helper function to collect scopes from all registered clients
async function getAllScopes () {
  const clients = await getClients()
  const clientScopes = new Set(['openid', 'profile', 'email', 'offline_access'])
  
  clients.forEach(client => {
    if (client.scope) {
      client.scope.split(' ').filter(s => s).forEach(scope => clientScopes.add(scope))
    }
  })
  
  return Array.from(clientScopes).sort()
}

router.get('/oauth-authorization-server', async (req, res) => {
  const issuer = config.issuer
  const scopes_supported = await getAllScopes()

  res.json({
    issuer,
    authorization_endpoint: `${issuer}${config.endpoints.authorize}`,
    token_endpoint: `${issuer}${config.endpoints.token}`,
    userinfo_endpoint: config.endpoints.userinfo ? `${issuer}${config.endpoints.userinfo}` : undefined,
    jwks_uri: `${issuer}${config.endpoints.jwks}`,
    registration_endpoint: `${issuer}/register`,
    scopes_supported,
    response_types_supported: ['code', 'token', 'id_token', 'code id_token'],
    grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: config.features.pkce ? ['S256', 'plain'] : [],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'nonce',
      'auth_time',
      'name',
      'given_name',
      'family_name',
      'preferred_username',
      'email',
      'email_verified',
      'picture',
      'updated_at',
      config.claims.scopeClaimName,
      config.claims.rolesClaimName,
      config.claims.groupsClaimName,
      config.claims.permissionsClaimName
    ].filter(Boolean),
    subject_types_supported: ['public']
  })
})

// OIDC discovery endpoint (same as oauth-authorization-server)
router.get('/openid-configuration', async (req, res) => {
  const issuer = config.issuer
  const scopes_supported = await getAllScopes()

  res.json({
    issuer,
    authorization_endpoint: `${issuer}${config.endpoints.authorize}`,
    token_endpoint: `${issuer}${config.endpoints.token}`,
    userinfo_endpoint: config.endpoints.userinfo ? `${issuer}${config.endpoints.userinfo}` : undefined,
    jwks_uri: `${issuer}${config.endpoints.jwks}`,
    registration_endpoint: `${issuer}/register`,
    revocation_endpoint: config.endpoints.revoke ? `${issuer}${config.endpoints.revoke}` : undefined,
    introspection_endpoint: config.endpoints.introspect ? `${issuer}${config.endpoints.introspect}` : undefined,
    end_session_endpoint: config.endpoints.logout ? `${issuer}${config.endpoints.logout}` : undefined,
    scopes_supported,
    response_types_supported: ['code', 'token', 'id_token', 'code id_token'],
    response_modes_supported: ['query', 'fragment'],
    grant_types_supported: config.features.refreshTokens 
      ? ['authorization_code', 'client_credentials', 'refresh_token']
      : ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    token_endpoint_auth_signing_alg_values_supported: [config.tokens.signingAlgorithm],
    code_challenge_methods_supported: config.features.pkce ? ['S256', 'plain'] : [],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'nonce',
      'auth_time',
      'name',
      'given_name',
      'family_name',
      'preferred_username',
      'email',
      'email_verified',
      'picture',
      'updated_at',
      config.claims.scopeClaimName,
      config.claims.rolesClaimName,
      config.claims.groupsClaimName,
      config.claims.permissionsClaimName
    ].filter(Boolean),
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [config.tokens.signingAlgorithm],
    id_token_encryption_alg_values_supported: [],
    id_token_encryption_enc_values_supported: [],
    userinfo_signing_alg_values_supported: [config.tokens.signingAlgorithm],
    request_object_signing_alg_values_supported: [config.tokens.signingAlgorithm]
  })
})

module.exports = router
