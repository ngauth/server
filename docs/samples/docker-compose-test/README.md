# OAuth Server + API Server Docker Compose Test Setup

This directory contains a complete Docker Compose setup for testing the ngauth OAuth server with an example API server that requires OAuth authentication.

## Overview

The setup includes:

- **OAuth Server** (`ngauth`) - Running on port 3000
  - Provides OAuth 2.0 authorization and token endpoints
  - Issues JWT access tokens
  - Serves JWKS (JSON Web Key Set) for token verification

- **API Server** - Running on port 3001
  - Example Express.js server that requires OAuth tokens
  - Protected endpoints that validate tokens
  - Scope-based access control demo

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- curl or similar HTTP client for testing

### Start the Services

```bash
docker-compose up
```

This will:
1. Build the ngauth OAuth server
2. Build the example API server
3. Start both services
4. Ensure OAuth server is ready before starting the API server

### Verify Services are Running

```bash
# Check OAuth server
curl http://localhost:3000/.well-known/oauth-authorization-server

# Check API server
curl http://localhost:3001/health
```

## Testing OAuth Flow

### 1. Register a Client Application

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test Client",
    "redirect_uris": ["http://localhost:3001/callback"],
    "grant_types": ["authorization_code", "client_credentials"]
  }'
```

Response will include `client_id` and `client_secret`.

### 2. Create a Test User

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Get Authorization Code (Open in Browser)

```
http://localhost:3000/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3001/callback&response_type=code&scope=read
```

This will show a login form. Log in with the test user credentials.

### 4. Exchange Authorization Code for Token

After authorization, you'll be redirected with a code parameter. Extract it and use:

```bash
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE_HERE",
    "redirect_uri": "http://localhost:3001/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }'
```

Response will include an `access_token`.

### 5. Use Token to Access Protected API

```bash
curl http://localhost:3001/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response:
```json
{
  "message": "This is a protected resource",
  "user": {
    "sub": "user_id",
    "username": "testuser",
    "email": "test@example.com",
    "scope": "read",
    ...
  },
  "timestamp": "2026-01-26T18:30:00.000Z"
}
```

## Testing Different Scopes

### Client Credentials Grant (Service-to-Service)

```bash
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "scope": "read write"
  }'
```

### Access Admin Endpoint

To test scope-based access control:

```bash
# This will fail (requires admin scope)
curl http://localhost:3001/api/admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Create a token with admin scope using client_credentials
# then try again
```

## API Server Endpoints

### Public Endpoints

- `GET /health` - Health check, returns server status
- `GET /api/oauth-server-info` - Returns OAuth server metadata

### Protected Endpoints

- `GET /api/protected` - Requires valid access token
- `GET /api/admin` - Requires valid access token with `admin` scope

## File Structure

```
docker-compose-test/
├── docker-compose.yml           # Docker Compose configuration
├── api-server.js                # Example API server source
├── api-server.Dockerfile        # API server Dockerfile
├── README.md                     # This file
└── test-requests.sh             # Optional: shell script with test commands
```

## Environment Variables

### OAuth Server
- `NODE_ENV` - Set to `development`
- `PORT` - Default 3000
- `NGAUTH_DATA` - Data directory for persistence (mounted as volume)

### API Server
- `PORT` - Default 3001
- `OAUTH_SERVER_URL` - URL to OAuth server (http://oauth-server:3000)
- `NODE_ENV` - Set to `development`

## Stopping Services

```bash
docker-compose down
```

To also remove persisted data:

```bash
docker-compose down -v
```

## Troubleshooting

### OAuth server not ready
If you see connection errors, the OAuth server may still be starting up. Wait a few seconds and retry.

### Token verification fails
- Ensure the OAuth server is running
- Check that the token hasn't expired (default: 1 hour)
- Verify the Authorization header format: `Authorization: Bearer TOKEN`

### API server can't reach OAuth server
This is a DNS/network issue. Ensure:
- Both services are running: `docker-compose ps`
- Using correct service name: `http://oauth-server:3000` (not localhost)

## Production Considerations

This setup is for testing and development only. For production:

1. **Token Verification**: Implement proper JWT signature verification using the public keys from JWKS endpoint
2. **HTTPS**: Use TLS/SSL for all communications
3. **Security**: 
   - Store secrets in environment variables
   - Use strong client secrets
   - Implement rate limiting
   - Enable audit logging
4. **Caching**: Cache JWKS keys to reduce latency
5. **Error Handling**: Don't expose internal error details
6. **Scopes**: Define and enforce appropriate scopes for your application

## Next Steps

- Modify `api-server.js` to implement your actual API logic
- Add more protected endpoints with specific scope requirements
- Implement proper JWT signature verification
- Add database integration for users and tokens
- Set up reverse proxy with HTTPS

## Additional Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [JWKS RFC](https://tools.ietf.org/html/rfc7517)
- [Express.js Documentation](https://expressjs.com/)
