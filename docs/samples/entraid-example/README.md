# Microsoft Entra ID Example

This example demonstrates how to use the `entraid` preset to test applications that integrate with Microsoft Entra ID (formerly Azure AD).

## Quick Start

```bash
# Start ngauth with Entra ID preset
docker run -e NGAUTH_PRESET=entraid -p 3000:3000 ngauth/server
```

## Test the Endpoints

### 1. Check OpenID Configuration

```bash
curl http://localhost:3000/v2.0/.well-known/openid-configuration | jq
```

You should see:
```json
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/oauth2/v2.0/authorize",
  "token_endpoint": "http://localhost:3000/oauth2/v2.0/token",
  "jwks_uri": "http://localhost:3000/discovery/v2.0/keys",
  "userinfo_endpoint": "http://localhost:3000/oidc/userinfo",
  "end_session_endpoint": "http://localhost:3000/oauth2/v2.0/logout",
  ...
}
```

### 2. Get JWKS (Public Keys)

```bash
curl http://localhost:3000/discovery/v2.0/keys | jq
```

### 3. Authorize and Get Tokens

#### Step 1: Get Authorization Code

Open in browser:
```
http://localhost:3000/oauth2/v2.0/authorize?client_id=test-client&response_type=code&redirect_uri=http://localhost:8080/callback&scope=openid%20profile%20email&state=random-state&nonce=random-nonce
```

You'll be redirected to a login page. Use credentials from `/data/users.json`:
- Username: `alice`
- Password: `alice123`

After login, you'll be redirected to:
```
http://localhost:8080/callback?code=AUTHORIZATION_CODE&state=random-state
```

#### Step 2: Exchange Code for Tokens

```bash
curl -X POST http://localhost:3000/oauth2/v2.0/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=http://localhost:8080/callback" | jq
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "openid profile email"
}
```

### 4. Decode Token to See Claims

The access token will contain Entra ID-specific claims:

```json
{
  "sub": "alice",
  "scp": "openid profile email",
  "roles": ["admin", "user"],
  "groups": ["engineering", "management"],
  "name": "Alice Smith",
  "email": "alice@example.com",
  "preferred_username": "alice",
  "iss": "http://localhost:3000",
  "aud": "test-client",
  "exp": 1234567890,
  "iat": 1234564290
}
```

**Note:** The `scp` claim contains scopes as a space-separated string, which matches Microsoft Entra ID's format.

### 5. Get User Info

```bash
curl http://localhost:3000/oidc/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN" | jq
```

### 6. Refresh Token

```bash
curl -X POST http://localhost:3000/oauth2/v2.0/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret" \
  -d "refresh_token=REFRESH_TOKEN" | jq
```

### 7. Logout

```bash
curl "http://localhost:3000/oauth2/v2.0/logout?post_logout_redirect_uri=http://localhost:8080"
```

## Integration Testing Example

### Node.js with Testcontainers

```javascript
const { GenericContainer } = require('testcontainers');
const axios = require('axios');
const jwt = require('jsonwebtoken');

describe('Microsoft Entra ID Integration', () => {
  let container;
  let baseUrl;

  beforeAll(async () => {
    container = await new GenericContainer('ngauth/server')
      .withExposedPorts(3000)
      .withEnvironment('NGAUTH_PRESET', 'entraid')
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3000);
    baseUrl = `http://${host}:${port}`;
  }, 60000);

  afterAll(async () => {
    await container.stop();
  });

  test('should have Entra ID v2.0 endpoints', async () => {
    const response = await axios.get(`${baseUrl}/v2.0/.well-known/openid-configuration`);
    
    expect(response.data.authorization_endpoint).toBe(`${baseUrl}/oauth2/v2.0/authorize`);
    expect(response.data.token_endpoint).toBe(`${baseUrl}/oauth2/v2.0/token`);
    expect(response.data.jwks_uri).toBe(`${baseUrl}/discovery/v2.0/keys`);
    expect(response.data.userinfo_endpoint).toBe(`${baseUrl}/oidc/userinfo`);
  });

  test('should issue token with scp claim', async () => {
    // Use client credentials flow for simplicity
    const response = await axios.post(
      `${baseUrl}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'test-client',
        client_secret: 'test-secret',
        scope: 'openid profile email'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    expect(response.data).toHaveProperty('access_token');
    
    const decoded = jwt.decode(response.data.access_token);
    
    // Verify Entra ID specific claims
    expect(decoded).toHaveProperty('scp');
    expect(typeof decoded.scp).toBe('string');
    expect(decoded.scp).toContain('openid');
  });

  test('should include roles and groups as arrays', async () => {
    // This test would require getting a token for a user with roles/groups
    // You can modify test data in /data/users.json to add these claims
  });
});
```

### .NET with Testcontainers

See [testcontainers-dotnet example](../samples/testcontainers-dotnet/README.md) and configure it to use the Entra ID preset:

```csharp
var container = new ContainerBuilder()
    .WithImage("ngauth/server")
    .WithPortBinding(3000, true)
    .WithEnvironment("NGAUTH_PRESET", "entraid")
    .Build();

await container.StartAsync();
```

## Testing MSAL.js

If you're using Microsoft Authentication Library (MSAL), you can point it to ngauth:

```javascript
import * as msal from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'test-client',
    authority: 'http://localhost:3000',  // ngauth with entraid preset
    redirectUri: 'http://localhost:8080/callback',
    knownAuthorities: ['localhost:3000']  // Required for local testing
  },
  cache: {
    cacheLocation: 'sessionStorage'
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// Use MSAL as normal
const loginRequest = {
  scopes: ['openid', 'profile', 'email']
};

msalInstance.loginPopup(loginRequest)
  .then(response => {
    console.log('Login successful:', response);
    const account = response.account;
    console.log('Account:', account);
  })
  .catch(error => {
    console.error('Login failed:', error);
  });
```

## Customizing Claims

You can customize user claims by editing `/data/users.json`:

```json
{
  "users": [
    {
      "id": "alice",
      "username": "alice",
      "password": "alice123",
      "email": "alice@contoso.com",
      "email_verified": true,
      "name": "Alice Smith",
      "roles": ["GlobalAdmin", "User"],
      "groups": ["engineering", "architects", "security-team"],
      "custom_claims": {
        "department": "Engineering",
        "employee_id": "E12345",
        "oid": "00000000-0000-0000-0000-000000000001"
      }
    }
  ]
}
```

Mount the custom data file:

```bash
docker run \
  -e NGAUTH_PRESET=entraid \
  -v $(pwd)/custom-users.json:/app/data/users.json \
  -p 3000:3000 \
  ngauth/server
```

## Differences from Real Entra ID

While this preset mimics Entra ID behavior, keep in mind:

1. **No actual Azure tenant** - This is a standalone server
2. **Simplified authentication** - No MFA, conditional access, or Azure-specific features
3. **No Microsoft Graph** - The `/oidc/userinfo` endpoint returns user data but doesn't connect to Microsoft Graph
4. **Static configuration** - Real Entra ID has dynamic app registrations and permissions
5. **Token validation** - Your app should validate tokens against ngauth's JWKS, not Microsoft's

## Next Steps

- Review [Entra ID Preset Documentation](../../docs/ENTRAID_PRESET.md)
- Check [OIDC Guide](../../docs/OIDC.md) for OpenID Connect details
- See [Testcontainers Guide](../../docs/TESTCONTAINERS.md) for more testing patterns

## Support

For issues or questions, see the main [README](../../README.md).
