# OIDC (OpenID Connect) Implementation Guide

This document describes the OpenID Connect (OIDC) 1.0 Core implementation in ngauth.

## Overview

This server implements OIDC 1.0 on top of the existing OAuth 2.0 infrastructure, providing a minimal but complete solution for testing OIDC-dependent applications.

### Compliance

- **OpenID Connect Core 1.0** - Full implementation
- **OpenID Connect Discovery 1.0** - Metadata endpoint support
- **JSON Web Token (JWT)** - ID tokens using RS256
- **JSON Web Key Set (JWKS)** - Public key distribution

## Architecture

The OIDC implementation is built on three core principles:
1. **Simplicity** - Minimal code, fail-fast design
2. **Optimization** - Efficient token generation and verification
3. **Testability** - Easy to use for testing OAuth/OIDC clients

## Core Features

### 1. OpenID Configuration Endpoint

**Endpoint**: `/.well-known/openid-configuration`

Returns OIDC discovery metadata including:
- `issuer` - Token issuer identifier
- `authorization_endpoint` - Authorization server endpoint
- `token_endpoint` - Token exchange endpoint
- `userinfo_endpoint` - User information endpoint
- `jwks_uri` - Public key endpoint
- `scopes_supported` - Supported scopes (openid, profile, email)
- `claims_supported` - Available user claims
- `response_types_supported` - Supported response types
- `grant_types_supported` - Supported grant types
- `token_endpoint_auth_methods_supported` - Auth methods
- `id_token_signing_alg_values_supported` - ID token signing algorithms

```bash
curl http://localhost:3000/.well-known/openid-configuration
```

### 2. ID Tokens

ID tokens are signed JWTs containing user information and authentication metadata.

**Format**: RS256-signed JWT with claims:
- `iss` (issuer) - Token issuer URL
- `sub` (subject) - Unique user identifier
- `aud` (audience) - Client ID
- `exp` (expiration) - Token expiration time
- `iat` (issued at) - Token creation time
- `nonce` - Optional anti-replay token
- User claims based on scope (profile, email)

**Example ID Token Claims**:
```json
{
  "iss": "http://localhost:3000",
  "sub": "user-123",
  "aud": "client-id",
  "exp": 1704067200,
  "iat": 1704063600,
  "nonce": "n-0S6_WzA2Mj",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "preferred_username": "johndoe"
}
```

### 3. Authorization Code Flow with OIDC

Enhanced authorization code flow supporting OIDC:

```
1. Client redirects to /authorize with:
   - client_id
   - redirect_uri
   - response_type=code
   - scope (including "openid")
   - state (optional)
   - nonce (optional, recommended)

2. User authenticates at /authorize

3. Authorization code is issued

4. Client exchanges code at /token with:
   - code
   - redirect_uri
   - grant_type=authorization_code
   - client credentials (Basic or POST)

5. Token response includes:
   - access_token (Bearer token)
   - token_type (Bearer)
   - expires_in (3600 seconds)
   - id_token (JWT, if "openid" scope requested)
   - scope (granted scopes)
```

### 4. Userinfo Endpoint

**Endpoint**: `GET /userinfo`

Returns authenticated user's claims based on authorized scopes.

**Authentication**: Bearer token (access_token)

**Response Example**:
```json
{
  "sub": "user-123",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true,
  "preferred_username": "johndoe"
}
```

**Usage**:
```bash
curl -H "Authorization: Bearer {access_token}" \
  http://localhost:3000/userinfo
```

### 5. Scopes and Claims

#### Supported Scopes

- **openid** - Request ID token (required for OIDC)
- **profile** - Access to user profile claims
- **email** - Access to email claims

#### Profile Scope Claims

When `profile` scope is granted:
- `name` - Full name
- `preferred_username` - Preferred username
- `updated_at` - Last update timestamp

#### Email Scope Claims

When `email` scope is granted:
- `email` - Email address
- `email_verified` - Email verification status

## Core Modules

### `src/oidc.js`

Handles OIDC claims generation and user information building.

**Key Functions**:

```javascript
// Get claims based on requested scope
getClaimsForScope(scope, user)

// Build ID token claims with all required OIDC fields
buildIdTokenClaims(user, clientId, issuer, scope, nonce)

// Build userinfo response based on authorized scope
buildUserinfoResponse(user, scope)
```

### `src/routes/userinfo.js`

Implements the userinfo endpoint with JWT verification.

### `src/routes/authorize.js`

Enhanced authorization endpoint supporting:
- Nonce parameter storage
- OIDC scope handling
- Login form rendering

### `src/routes/token.js`

Enhanced token endpoint supporting:
- ID token generation when "openid" scope is present
- Nonce inclusion in ID tokens
- Scope-based claim filtering

### `src/routes/well-known.js`

OIDC metadata discovery endpoints:
- `/.well-known/openid-configuration`
- `/.well-known/oauth-authorization-server`

## Usage Examples

### 1. Get Discovery Metadata

```bash
curl http://localhost:3000/.well-known/openid-configuration | jq
```

### 2. Authorize with Nonce

```bash
curl -X GET "http://localhost:3000/authorize?client_id=my-client&redirect_uri=http://localhost:3001/callback&response_type=code&scope=openid%20profile%20email&state=state123&nonce=nonce456"
```

### 3. Exchange Code for ID Token

```bash
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u my-client:my-secret \
  -d "grant_type=authorization_code&code=<code>&redirect_uri=http://localhost:3001/callback"
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "openid profile email"
}
```

### 4. Get User Info

```bash
curl -H "Authorization: Bearer {access_token}" \
  http://localhost:3000/userinfo
```

### 5. Verify ID Token

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const publicKey = fs.readFileSync('path-to-public-key.pem');
const decoded = jwt.verify(idToken, publicKey, {
  algorithms: ['RS256']
});

console.log(decoded);
```

## Configuration

### Environment Variables

- `NGAUTH_DATA` - Data directory (default: `/data`)
- `NGAUTH_KEY` - Private key (optional, uses generated key if not set)
- `ISSUER` - Token issuer URL (default: `http://localhost:{PORT}`)
- `PORT` - Server port (default: `3000`)
- `NODE_ENV` - Environment mode (development/production)

### Example with Custom Issuer

```bash
ISSUER=https://auth.example.com PORT=3000 npm start
```

## Security Considerations

### Key Management

- RSA 2048-bit keys are generated automatically
- Private key is persisted in `NGAUTH_DATA/private-key.pem`
- Public key is exposed via JWKS endpoint
- Keys are never exposed in plaintext

### HTTPS

- TLS is enforced in production mode (`NODE_ENV=production`)
- Use reverse proxy (nginx, caddy) for TLS termination
- Set `x-forwarded-proto: https` header from reverse proxy

### Token Expiration

- Access tokens: 1 hour
- Authorization codes: 10 minutes (single-use)
- ID tokens: 1 hour

### CORS and CSRF

- CSRF protection on form endpoints
- No CORS headers (single-origin by default)
- Secure cookies with `HttpOnly` flag

## Testing

### Unit Tests

Test OIDC claims generation:
```bash
npm test test/unit/oidc.test.js
```

### Integration Tests

Test OIDC endpoints:
```bash
NGAUTH_DATA=/tmp/ngauth-test npm test test/integration/oidc.test.js
```

### Manual Testing

Test with curl or Postman:
```bash
# Get configuration
curl http://localhost:3000/.well-known/openid-configuration

# Get JWKS
curl http://localhost:3000/.well-known/jwks.json

# Test userinfo endpoint
curl -H "Authorization: Bearer {token}" http://localhost:3000/userinfo
```

## Client Implementation Examples

### Node.js/JavaScript

```javascript
const { Issuer } = require('openid-client');

const issuer = await Issuer.discover('http://localhost:3000');
const client = new issuer.Client({
  client_id: 'your-client-id',
  client_secret: 'your-client-secret',
  redirect_uris: ['http://localhost:3001/callback']
});

// Authorization flow
const url = client.authorizationUrl({
  scope: 'openid profile email',
  nonce: 'nonce123'
});

// Token exchange
const tokenSet = await client.callback('http://localhost:3001/callback', params);
console.log(tokenSet.id_token); // Verify and decode

// Get userinfo
const userinfo = await client.userinfo(tokenSet.access_token);
console.log(userinfo);
```

### Python

```python
from authlib.integrations.requests_client import OAuth2Session

client = OAuth2Session(
    'client-id',
    client_secret='client-secret',
    redirect_uri='http://localhost:3001/callback',
    server_metadata_url='http://localhost:3000/.well-known/openid-configuration'
)

# Authorization URL
authorization_url, state = client.create_authorization_url(
    'http://localhost:3000/authorize',
    scope='openid profile email'
)

# Token exchange
token = client.fetch_token(
    'http://localhost:3000/token',
    authorization_response=callback_url
)

# Get userinfo
userinfo = client.get('http://localhost:3000/userinfo').json()
print(userinfo)
```

## Troubleshooting

### ID Token Not Returned

- Ensure `openid` scope is included in authorization request
- Check token endpoint response for `id_token` field
- Verify scope claim is set correctly

### Invalid Token Error on Userinfo

- Confirm access_token is valid and not expired
- Check Authorization header format: `Bearer {token}`
- Verify token was issued by this server

### JWKS Endpoint Returns Error

- Check server logs for initialization errors
- Ensure private key file is readable
- Verify `NGAUTH_DATA` directory has proper permissions

### Nonce Mismatch

- Include nonce in both authorization request and token verification
- Nonce is stored with authorization code automatically
- Client must validate nonce in ID token matches original

## Performance Optimization

The implementation is optimized for testing scenarios:

1. **Minimal dependencies** - Only essential packages
2. **In-memory database** - Fast lookup operations
3. **Pre-generated keys** - Keys are generated once and reused
4. **Efficient JWT handling** - Single signature algorithm (RS256)
5. **Stateless tokens** - No session storage required

## Extending OIDC

### Adding New Claims

Edit `src/oidc.js` to extend `getClaimsForScope()` and `STANDARD_CLAIMS`.

### Custom Scope

Add new scope and claims mapping in `buildIdTokenClaims()`.

### Different Signing Algorithm

Modify `generateIdToken()` in `src/tokens.js` (not recommended for simplicity).

## References

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [RFC 6749 - OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [RFC 7519 - JWT](https://tools.ietf.org/html/rfc7519)
- [RFC 8414 - OAuth 2.0 Discovery](https://tools.ietf.org/html/rfc8414)
