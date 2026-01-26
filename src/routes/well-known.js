/* eslint camelcase: "off" */

const express = require('express')

const router = express.Router()

router.get('/oauth-authorization-server', (req, res) => {
  const issuer = process.env.ISSUER || `http://localhost:${process.env.PORT || 3000}`

  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    registration_endpoint: `${issuer}/register`,
    scopes_supported: ['openid', 'profile', 'email'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: [],
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
      'updated_at'
    ],
    subject_types_supported: ['public']
  })
})

// OIDC discovery endpoint (same as oauth-authorization-server)
router.get('/openid-configuration', (req, res) => {
  const issuer = process.env.ISSUER || `http://localhost:${process.env.PORT || 3000}`

  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    registration_endpoint: `${issuer}/register`,
    scopes_supported: ['openid', 'profile', 'email'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    token_endpoint_auth_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: [],
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
      'updated_at'
    ],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    id_token_encryption_alg_values_supported: [],
    id_token_encryption_enc_values_supported: [],
    userinfo_signing_alg_values_supported: ['RS256'],
    request_object_signing_alg_values_supported: ['RS256']
  })
})

module.exports = router
