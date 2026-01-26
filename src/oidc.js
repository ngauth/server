/* eslint camelcase: "off" */

/**
 * OIDC (OpenID Connect) Claims and Userinfo handling
 * Implements OIDC Core 1.0 specification claims
 */

const STANDARD_CLAIMS = {
  profile: [
    'name',
    'family_name',
    'given_name',
    'middle_name',
    'nickname',
    'preferred_username',
    'profile',
    'picture',
    'website',
    'gender',
    'birthdate',
    'zoneinfo',
    'locale',
    'updated_at'
  ],
  email: [
    'email',
    'email_verified'
  ],
  address: [
    'address'
  ],
  phone: [
    'phone_number',
    'phone_number_verified'
  ]
}

/**
 * Get claims based on requested scope
 * @param {string} scope - Space-separated scope string
 * @param {object} user - User object from database
 * @returns {object} Claims object
 */
function getClaimsForScope (scope, user) {
  const claims = {
    sub: user.id // subject claim - unique user identifier
  }

  if (!scope) {
    return claims
  }

  const scopes = scope.split(' ')

  if (scopes.includes('profile')) {
    claims.name = user.name || user.username
    claims.preferred_username = user.username
    claims.updated_at = Math.floor(new Date(user.created_at).getTime() / 1000)
  }

  if (scopes.includes('email')) {
    claims.email = user.email
    claims.email_verified = user.email_verified || false
  }

  return claims
}

/**
 * Build ID token claims
 * @param {object} user - User object
 * @param {string} clientId - OAuth client ID
 * @param {string} issuer - Token issuer URL
 * @param {string} scope - Requested scopes
 * @param {string} nonce - Optional nonce from authorization request
 * @returns {object} ID token claims
 */
function buildIdTokenClaims (user, clientId, issuer, scope, nonce) {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 3600 // 1 hour

  const claims = {
    iss: issuer,
    sub: user.id,
    aud: clientId,
    exp: now + expiresIn,
    iat: now
  }

  // Add nonce if provided (OIDC Core requires this)
  if (nonce) {
    claims.nonce = nonce
  }

  // Add user claims based on scope
  const userClaims = getClaimsForScope(scope, user)
  Object.assign(claims, userClaims)

  return claims
}

/**
 * Build userinfo response
 * @param {object} user - User object
 * @param {string} scope - Authorized scopes
 * @returns {object} Userinfo response
 */
function buildUserinfoResponse (user, scope) {
  const userinfo = {
    sub: user.id
  }

  if (!scope) {
    return userinfo
  }

  const scopes = scope.split(' ')

  if (scopes.includes('profile')) {
    userinfo.name = user.name || user.username
    userinfo.preferred_username = user.username
    userinfo.updated_at = Math.floor(new Date(user.created_at).getTime() / 1000)
  }

  if (scopes.includes('email')) {
    userinfo.email = user.email
    userinfo.email_verified = user.email_verified || false
  }

  return userinfo
}

module.exports = {
  getClaimsForScope,
  buildIdTokenClaims,
  buildUserinfoResponse,
  STANDARD_CLAIMS
}
