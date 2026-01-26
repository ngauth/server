# Quick Start: OIDC Testing

## Setup

```bash
# Start server
npm start

# With custom issuer
ISSUER=https://myauth.com npm start

# With custom data directory
NGAUTH_DATA=/data npm start
```

## Endpoints

### Discovery
```bash
GET /.well-known/openid-configuration
GET /.well-known/oauth-authorization-server
```

### Authorization
```bash
GET /authorize?client_id=ID&redirect_uri=URI&response_type=code&scope=openid%20profile&nonce=N
POST /authorize (form: username, password, client_id, redirect_uri, scope, state, nonce)
```

### Token Exchange
```bash
POST /token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code&code=CODE&redirect_uri=URI
```

### User Info
```bash
GET /userinfo
Authorization: Bearer ACCESS_TOKEN
```

### Public Keys
```bash
GET /.well-known/jwks.json
```

## Response: Get ID Token

```bash
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u client-id:client-secret \
  -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=http://localhost:3001/callback"
```

Response:
```json
{
  "access_token": "eyJ...",
  "id_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email"
}
```

## Decode ID Token

```bash
# Get ID token (from above response)
ID_TOKEN="eyJ..."

# Decode (without verification)
echo $ID_TOKEN | cut -d. -f2 | base64 -d | jq

# Verify with public key
curl -s http://localhost:3000/.well-known/jwks.json | jq '.keys[0]'
```

## Test Users

Default test user (if created):
- Username: `testuser`
- Password: `testpass`

## Scopes

- `openid` - Get ID token
- `profile` - Get name, preferred_username, updated_at
- `email` - Get email, email_verified

## Common Flow

1. **Register Client** (if needed)
   ```bash
   curl -X POST http://localhost:3000/register \
     -H "Content-Type: application/json" \
     -d '{
       "client_name": "My App",
       "redirect_uris": ["http://localhost:3001/callback"]
     }'
   ```

2. **Authorize**
   ```bash
   # User visits:
   GET http://localhost:3000/authorize?client_id=...&redirect_uri=...&response_type=code&scope=openid&nonce=xyz
   ```

3. **Get Code**
   ```
   Redirects to: http://localhost:3001/callback?code=AUTH_CODE&state=...
   ```

4. **Exchange Code**
   ```bash
   curl -X POST http://localhost:3000/token \
     -u client:secret \
     -d "grant_type=authorization_code&code=...&redirect_uri=..."
   ```

5. **Use ID Token**
   - Extract and verify JWT
   - Check nonce claim matches sent value
   - Extract user claims from token

6. **Get More Info** (optional)
   ```bash
   curl -H "Authorization: Bearer ACCESS_TOKEN" \
     http://localhost:3000/userinfo
   ```

## Testing with JWT

```javascript
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

// 1. Get JWKS
const jwks = await fetch('http://localhost:3000/.well-known/jwks.json').then(r => r.json());
const key = jwks.keys[0];

// 2. Verify token
const decoded = jwt.verify(idToken, key, { algorithms: ['RS256'] });
console.log(decoded);

// 3. Check claims
console.assert(decoded.aud === clientId);
console.assert(decoded.nonce === originalNonce);
console.assert(decoded.exp > Date.now() / 1000);
```

## Troubleshooting

**Token Endpoint 500 Error**
- Check issuer configuration
- Verify client_id and secret
- Look at server logs

**Invalid Token at Userinfo**
- Ensure Bearer token is the access_token, not id_token
- Check token expiration
- Verify token format

**JWKS Endpoint 404**
- Confirm server started successfully
- Check server logs for key generation
- Verify URL: `/.well-known/jwks.json`

**Nonce Mismatch**
- Include nonce in /authorize request
- Verify returned in id_token
- Client-side validation required

## Resources

- Full docs: [docs/OIDC.md](docs/OIDC.md)
- Implementation: [OIDC_IMPLEMENTATION.md](OIDC_IMPLEMENTATION.md)
- Test examples: [test/integration/oidc.test.js](test/integration/oidc.test.js)
