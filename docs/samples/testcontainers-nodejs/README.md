# Testcontainers with ngauth/server - Node.js Example

This example demonstrates how to use ngauth/server as a Testcontainers module for integration testing OAuth 2.0 flows in Node.js applications.

## Overview

This example shows:
- Starting ngauth/server container programmatically
- Registering OAuth clients dynamically
- Testing authorization code flow
- Testing client credentials flow
- Verifying JWT tokens with JWKS
- Integration with Jest test framework

## Prerequisites

- Node.js 18+ installed
- Docker installed and running
- Basic understanding of OAuth 2.0 flows

## Installation

```bash
npm install --save-dev testcontainers jest node-fetch
```

## Project Structure

```
testcontainers-nodejs/
├── README.md
├── package.json
├── oauth.test.js          # Integration tests
├── app.js                 # Sample application to test
└── docker-compose.yml     # Alternative: manual container setup
```

## Usage

### Running Tests

```bash
# Run all tests
npm test

# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test oauth.test.js
```

### Test Examples

The `oauth.test.js` file includes:

1. **Container Lifecycle Management**
   - Starting ngauth container before tests
   - Stopping container after tests
   - Automatic cleanup

2. **Client Credentials Flow Testing**
   - Dynamic client registration
   - Token request with client authentication
   - Token validation

3. **Authorization Code Flow Testing**
   - Client registration
   - Authorization request
   - Code exchange for tokens
   - State parameter validation

4. **JWKS Token Verification**
   - Fetching public keys
   - JWT signature verification
   - Token claims validation

## Key Concepts

### GenericContainer Usage

```javascript
const { GenericContainer } = require('testcontainers');

const container = await new GenericContainer('ngauth/server:latest')
  .withExposedPorts(3000)
  .withWaitStrategy(Wait.forHttp('/.well-known/oauth-authorization-server', 3000))
  .start();
```

### Getting Container URL

```javascript
const host = container.getHost();
const port = container.getMappedPort(3000);
const baseUrl = `http://${host}:${port}`;
```

### Dynamic Client Registration

```javascript
const response = await fetch(`${baseUrl}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'My Application',
    redirect_uris: ['http://localhost:3000/callback'],
    grant_types: ['authorization_code', 'client_credentials'],
    scope: 'openid profile email'
  })
});

const client = await response.json();
console.log('Client ID:', client.client_id);
console.log('Client Secret:', client.client_secret);
```

### Client Credentials Flow

```javascript
const params = new URLSearchParams({
  grant_type: 'client_credentials',
  client_id: client.client_id,
  client_secret: client.client_secret,
  scope: 'read write'
});

const response = await fetch(`${baseUrl}/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params
});

const tokenData = await response.json();
const accessToken = tokenData.access_token;
```

```javascript
const response = await fetch(`${baseUrl}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'Test Client',
    redirect_uris: ['http://localhost:3001/callback']
  })
});
const client = await response.json();
// Returns: { client_id, client_secret, redirect_uris, ... }
```

### Client Credentials Flow

```javascript
const tokenResponse = await fetch(`${baseUrl}/token`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'grant_type=client_credentials&scope=openid profile'
});
const { access_token, token_type, expires_in } = await tokenResponse.json();
```

## Benefits of This Approach

### 1. **No Mocking Required**
- Test against a real OAuth server
- Verify actual JWT tokens
- Validate complete OAuth flows

### 2. **Isolated Tests**
- Each test run gets a fresh container
- No shared state between tests
- Consistent, repeatable results

### 3. **Fast Execution**
- ngauth starts in 2-3 seconds
- Lightweight container (~50 MB)
- Suitable for CI/CD pipelines

### 4. **Realistic Testing**
- Same behavior as production OAuth servers
- RFC-compliant error responses
- Proper JWT signing and verification

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm test
```

Testcontainers automatically:
- Detects Docker environment
- Starts containers as needed
- Cleans up after tests

### GitLab CI

```yaml
test:
  image: node:20
  services:
    - docker:dind
  variables:
    DOCKER_HOST: tcp://docker:2375
  script:
    - npm ci
    - npm test
```

## Advanced Usage

### Custom Configuration

```javascript
const container = await new GenericContainer('ngauth/server:latest')
  .withExposedPorts(3000)
  .withEnvironment({
    'OAUTH_ISSUER': 'http://test-issuer.local',
    'DATA_DIR': '/app/data'
  })
  .withTmpFs({ '/app/data': 'rw' })  // Faster storage for tests
  .start();
```

### Health Checks

```javascript
const { Wait } = require('testcontainers');

const container = await new GenericContainer('ngauth/server:latest')
  .withExposedPorts(3000)
  .withWaitStrategy(
    Wait.forHttp('/.well-known/oauth-authorization-server', 3000)
      .forStatusCode(200)
      .withStartupTimeout(Duration.seconds(30))
  )
  .start();
```

### Debugging

```javascript
const container = await new GenericContainer('ngauth/server:latest')
  .withExposedPorts(3000)
  .withLogConsumer(stream => {
    stream.on('data', line => console.log(line));
    stream.on('err', line => console.error(line));
  })
  .start();
```

## Common Patterns

### Test Fixture Setup

```javascript
class OAuthTestHelper {
  constructor(container) {
    this.baseUrl = `http://${container.getHost()}:${container.getMappedPort(3000)}`;
  }

  async registerClient(name, redirectUris = ['http://localhost/callback']) {
    const response = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: name, redirect_uris: redirectUris })
    });
    return response.json();
  }

  async getClientCredentialsToken(clientId, clientSecret, scope = 'openid') {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=client_credentials&scope=${scope}`
    });
    return response.json();
  }

  async getJwks() {
    const response = await fetch(`${this.baseUrl}/.well-known/jwks.json`);
    return response.json();
  }
}

// Usage in tests
let helper;
beforeAll(async () => {
  const container = await new GenericContainer('ngauth/server:latest')
    .withExposedPorts(3000)
    .start();
  helper = new OAuthTestHelper(container);
});
```

## Troubleshooting

### Container Won't Start

**Problem:** Timeout waiting for container

**Solutions:**
- Check Docker is running: `docker ps`
- Verify image exists: `docker pull ngauth/server:latest`
- Increase timeout: `.withStartupTimeout(Duration.seconds(60))`

### Port Conflicts

**Problem:** Port 3000 already in use

**Solution:** Testcontainers automatically maps to random host ports
```javascript
const mappedPort = container.getMappedPort(3000);  // Random port like 32768
```

### Slow Tests in CI

**Problem:** Container startup slows down CI pipeline

**Solutions:**
- Use Docker layer caching
- Pull image in separate CI step
- Consider using tmpfs for data directory

### Token Verification Fails

**Problem:** JWT verification returns invalid signature

**Checks:**
- Ensure using JWKS from same container instance
- Verify token hasn't expired
- Check clock synchronization in CI environment

## Additional Resources

- [ngauth/server Documentation](../../server/README.md)
- [ngauth Features](../FEATURES.md)
- [Testcontainers Node.js Docs](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)

## License

This example is provided under the same MIT License as ngauth/server.
