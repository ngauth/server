<div align="center">
  <img src="docs/logo.png" alt="ngauth logo" width="200"/>
  
  # ngauth
  
  **Lightweight OAuth 2.0 & OpenID Connect Server**
  
  Perfect for testing and development environments
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  ![Node.js Version](https://img.shields.io/badge/node-%3E%3D14-brightgreen)
  [![GitHub stars](https://img.shields.io/github/stars/ngauth/server?style=social)](https://github.com/ngauth/server)
  [![Docker Pulls](https://img.shields.io/docker/pulls/ngauth/server)](https://hub.docker.com/r/ngauth/server)
  [![GitHub release](https://img.shields.io/github/v/release/ngauth/server)](https://github.com/ngauth/server/releases)
  [![Testcontainers Ready](https://img.shields.io/badge/Testcontainers-Ready-orange)](https://testcontainers.com/)
  
</div>

---

## 🚀 Quick Start

Get ngauth running in seconds with Docker:

```bash
# Pull and run the container
docker run -d -p 3000:3000 ngauth/server

# Or use Docker Compose
docker-compose up -d
```

**That's it!** Your OAuth 2.0 server is now running at `http://localhost:3000`

For testing with Testcontainers (recommended for integration tests):

```javascript
// Node.js example
const { GenericContainer } = require('testcontainers');

const container = await new GenericContainer('ngauth/server')
  .withExposedPorts(3000)
  .start();

const serverUrl = `http://${container.getHost()}:${container.getMappedPort(3000)}`;
// Start testing!
```

📖 [See full Testcontainers guide](docs/TESTCONTAINERS.md)

---

## 💡 Why ngauth?

**ngauth** is designed specifically for **development and testing** environments where you need a real OAuth 2.0/OIDC server without the complexity of production-grade solutions.

### Key Benefits

✅ **Zero Configuration** - Works out of the box with sensible defaults  
✅ **Lightweight** - Docker image < 100MB, starts in seconds  
✅ **Standards Compliant** - Implements OAuth 2.0 (RFC 6749) and OpenID Connect Core  
✅ **Test-Friendly** - Built for Testcontainers and automated testing  
✅ **No External Dependencies** - Fully self-contained, no database required  
✅ **Predictable Data** - Pre-seeded with test users and clients  
✅ **Developer Experience** - Simple API, clear documentation, easy debugging  

### Comparison

| Feature | ngauth | Keycloak | WireMock |
|---------|--------|----------|----------|
| **Purpose** | OAuth testing | Production IAM | HTTP mocking |
| **Startup Time** | < 3 seconds | 30-60 seconds | < 1 second |
| **Memory Usage** | ~50 MB | ~1 GB | ~100 MB |
| **Configuration** | Zero config | Complex | Manual setup |
| **OAuth 2.0 Support** | ✅ Full | ✅ Full | ⚠️ Manual mocks |
| **OIDC Support** | ✅ Full | ✅ Full | ⚠️ Manual mocks |
| **Docker Image Size** | ~80 MB | ~600 MB | ~150 MB |
| **Testcontainers** | ✅ Optimized | ✅ Slow | ❌ Not designed |
| **Learning Curve** | Minimal | Steep | Medium |
| **Best For** | Testing/Dev | Production | Generic mocking |

---

## 🎯 Use Cases

### Integration Testing
Perfect for testing applications that integrate with OAuth providers:
- Verify OAuth flows (authorization code, client credentials, etc.)
- Test token validation and JWT verification
- Validate error handling and edge cases
- No need for external services or API keys

### CI/CD Pipelines
Ideal for automated testing in CI environments:
- Fast startup times don't slow down builds
- Deterministic behavior ensures reliable tests
- No external dependencies or rate limits
- Works offline once image is cached

### Local Development
Great for developing OAuth-integrated applications:
- No internet connection required
- Consistent test data across team members
- Easy debugging with predictable responses
- Faster than hitting real OAuth providers

### Training & Education
Excellent for learning OAuth 2.0 and OIDC:
- See real OAuth flows in action
- Experiment without production concerns
- Clear, understandable codebase
- Standard-compliant implementation

---

## 📚 Documentation

- [Quick Start Guide (OIDC)](docs/QUICKSTART_OIDC.md) - Get started with OpenID Connect
- [OpenID Connect Details](docs/OIDC.md) - Complete OIDC implementation guide
- [Testcontainers Usage](docs/TESTCONTAINERS.md) - Integration testing examples
- [Branding Guidelines](docs/BRANDING.md) - Logo and visual assets
- [Sample Applications](docs/samples/README.md) - Example implementations

---

## 🐳 Docker Usage

### Pull from Docker Hub

```bash
docker pull ngauth/server:latest
```

### Run with Custom Configuration

```bash
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  ngauth/server
```

### Docker Compose

```yaml
version: '3.8'
services:
  ngauth:
    image: ngauth/server:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./data:/app/data
```

---

## 🧪 Testing with Testcontainers

ngauth is optimized for use with [Testcontainers](https://testcontainers.com/), making it perfect for integration testing in any language.

**Supported Languages:**
- ✅ Node.js / JavaScript / TypeScript
- ✅ Java / Kotlin
- ✅ Python
- ✅ Go
- ✅ .NET / C#

See the [Testcontainers Guide](docs/TESTCONTAINERS.md) for complete examples.

---

## 🔧 Features

### OAuth 2.0 Support
- Authorization Code Flow
- Client Credentials Flow
- Implicit Flow (legacy support)
- Token refresh
- Token revocation

### OpenID Connect Support
- ID Tokens with JWT
- UserInfo endpoint
- Discovery endpoint (/.well-known/openid-configuration)
- JWKS endpoint for public key distribution
- Standard claims (sub, email, name, etc.)

### Security Features
- JWT token signing (RS256)
- Token validation
- Client authentication
- Rate limiting
- CSRF protection
- Audit logging

### Developer Features
- Health check endpoint
- Pre-seeded test data
- Clear error messages
- Request/response logging
- Configurable token lifetimes

---

## 📦 Installation

### Option 1: Docker (Recommended)

```bash
docker pull ngauth/server:latest
docker run -p 3000:3000 ngauth/server
```

### Option 2: From Source

```bash
git clone https://github.com/ngauth/server.git
cd server
npm install
npm start
```

---

## 🔑 Pre-configured Test Data

ngauth comes with pre-seeded data for immediate testing:

### Test Users
- **Username:** `testuser` / **Password:** `password123`
- **Username:** `alice` / **Password:** `alice123`
- **Username:** `bob` / **Password:** `bob123`

### Test Clients
- **Client ID:** `test-client`
- **Client Secret:** `test-secret`
- **Redirect URI:** `http://localhost:3000/callback`

---

## 🛠️ Configuration

ngauth works with zero configuration but can be customized:

### Environment Variables

```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment mode
JWT_EXPIRATION=3600          # Access token lifetime (seconds)
REFRESH_EXPIRATION=86400     # Refresh token lifetime (seconds)
```

### Data Persistence

By default, data is stored in JSON files in `/app/data`:
- `users.json` - User accounts
- `clients.json` - OAuth clients
- `codes.json` - Authorization codes (temporary)

Mount a volume to persist data:

```bash
docker run -v ./my-data:/app/data ngauth/server
```

---

## 📖 API Endpoints

### OAuth 2.0 / OIDC Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /authorize` | Authorization endpoint |
| `POST /token` | Token endpoint |
| `GET /userinfo` | UserInfo endpoint (OIDC) |
| `GET /.well-known/openid-configuration` | OIDC Discovery |
| `GET /.well-known/jwks.json` | JWKS public keys |

### Management Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /users` | Create user (testing only) |
| `POST /register` | Register OAuth client |

See [full API documentation](docs/OIDC.md) for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌟 Star History

If you find ngauth useful, please consider giving it a star on GitHub!

---

## 📞 Support

- 📫 [Open an issue](https://github.com/ngauth/server/issues)
- 💬 [Discussions](https://github.com/ngauth/server/discussions)
- 📖 [Documentation](docs/)

---

<div align="center">
  
**Built for developers, by developers** 🚀

[GitHub](https://github.com/ngauth/server) • [Docker Hub](https://hub.docker.com/r/ngauth/server) • [Testcontainers](https://testcontainers.com/)

</div>
