# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-03

### 🎉 First Stable Release

ngauth reaches production-ready status with full OAuth 2.0 and OpenID Connect compliance!

### ✨ Features

#### Core OAuth 2.0 & OIDC
- **OAuth 2.0 Authorization Server** (RFC 6749)
  - Authorization Code Flow with PKCE support
  - Client Credentials Flow
  - Dynamic Client Registration (RFC 7591)
  - OAuth 2.0 Server Metadata (RFC 8414)
- **OpenID Connect 1.0 Core** (Full Compliance)
  - ID Token generation with RS256 signing
  - UserInfo endpoint with scope-based claims
  - OIDC Discovery (`.well-known/openid-configuration`)
  - JWKS endpoint (`.well-known/jwks.json`)
  - Standard claims: `sub`, `iss`, `aud`, `exp`, `iat`, `nonce`, `email`, `name`
  - Scopes: `openid`, `profile`, `email`, `offline_access`
  - Nonce parameter for replay protection

#### Security Features
- **JWT Token Security**
  - RS256 asymmetric signing with 2048-bit RSA keys
  - Automatic key generation and management
  - JWKS public key discovery
  - Token signature verification
- **Account Protection**
  - Rate limiting on sensitive endpoints (10 req/hour on `/authorize`, `/token`)
  - Account lockout after 5 failed login attempts (30-minute lockout)
  - Failed login attempt tracking
  - Password strength requirements
- **Web Security**
  - CSRF protection with csurf middleware
  - Secure session management with express-session
  - Security headers (Helmet.js)
  - HTTPS enforcement support
  - Cookie security (httpOnly, secure, sameSite)
- **Audit & Monitoring**
  - Comprehensive audit logging
  - Failed login tracking
  - Account lockout events
  - Security event monitoring

#### Developer Experience
- **Health Check Endpoints**
  - `/health/live` - Liveness probe
  - `/health/ready` - Readiness probe (checks DB connectivity)
  - `/health/startup` - Startup probe
- **Zero Configuration**
  - Works out-of-the-box with sensible defaults
  - Automatic RSA key generation
  - In-memory or file-based storage
  - Fast startup (~2-3 seconds)
- **Docker Support**
  - Official Docker image: `ngauth/server`
  - Alpine-based image (~171MB)
  - Multi-arch support (linux/amd64, linux/arm64)
  - Non-root user execution
  - Health checks built-in

#### Testing & Integration
- **Testcontainers Support**
  - First-class Testcontainers integration
  - Examples in 5 languages:
    - **Java** with JUnit 5 (4/4 tests passing)
    - **.NET** with xUnit (4/4 tests passing)
    - **Python** with pytest (all tests passing)
    - **Go** with standard testing (all tests passing)
    - **Node.js** with Jest (16/16 tests passing)
  - Complete OAuth flows demonstrated
  - JWT verification examples
  - Error handling patterns

### 🔒 Security

- **Input Validation**
  - URI format validation for redirect URIs
  - Client name length validation (max 255 chars)
  - Email format validation
  - Username/password validation
  - Type checking for all inputs
- **Error Handling**
  - Secure error messages (no sensitive data leakage)
  - Proper HTTP status codes
  - OIDC-compliant error responses
  - JSON parsing error handling
- **Data Protection**
  - Password hashing with bcrypt (10 rounds)
  - Secure session secrets
  - Private key file permissions
  - Sensitive data excluded from logs

### 📚 Documentation

- **Comprehensive Guides**
  - Quick Start guide in README
  - Full OIDC implementation documentation
  - Security best practices guide
  - Deployment guide with examples
  - API reference documentation
- **Community**
  - Contributing guidelines (CONTRIBUTING.md)
  - Code of Conduct (Contributor Covenant)
  - Issue templates (bug, feature, question)
  - Pull request template
  - Security policy (SECURITY.md)
- **Examples & Tutorials**
  - Docker Compose examples
  - Testcontainers integration examples
  - OAuth flow demonstrations
  - JWT verification samples
  - Multi-language client examples

### 🧪 Testing

- **Test Coverage**
  - 174 automated tests (100% passing)
  - 12 test suites covering all functionality
  - Unit tests for all modules
  - Integration tests for all endpoints
  - OIDC compliance tests
  - Security feature tests
- **Test Types**
  - Authorization flow tests
  - Token generation and verification
  - Client registration validation
  - Error handling scenarios
  - Rate limiting behavior
  - Account lockout mechanisms
  - Health check endpoints

### 🏗️ Infrastructure

- **Docker Image**
  - Base: Node.js 24 Alpine
  - Size: ~171MB optimized
  - OCI labels for metadata
  - Security: runs as non-root user
  - Volumes: `/data` for persistence
  - Exposed port: 3000
- **Data Persistence**
  - File-based storage in `NGAUTH_DATA` directory
  - JSON format for easy inspection
  - Automatic directory creation
  - Graceful degradation to memory storage

### 🔧 Configuration

Environment variables for customization:
- `PORT` - Server port (default: 3000)
- `NGAUTH_DATA` - Data directory path (default: ./data)
- `SESSION_SECRET` - Session encryption key (auto-generated)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Logging verbosity

### 📦 Dependencies

Production dependencies:
- `express` ^4.18.2 - Web framework
- `bcrypt` ^6.0.0 - Password hashing
- `jsonwebtoken` ^9.0.2 - JWT handling
- `express-rate-limit` ^7.1.5 - Rate limiting
- `helmet` ^7.1.0 - Security headers
- `cookie-parser` ^1.4.6 - Cookie handling
- `express-session` ^1.17.3 - Session management
- `csurf` ^1.2.2 - CSRF protection

### 🎯 Target Use Cases

- **Integration Testing** - Test OAuth/OIDC clients in CI/CD pipelines
- **Development** - Local OAuth server for app development
- **Testing** - Automated testing with Testcontainers
- **Learning** - Study OAuth 2.0 and OIDC implementations
- **Prototyping** - Quick OAuth server for demos and POCs

### 📈 Performance

- **Startup Time**: 2-3 seconds
- **Memory Usage**: ~50MB base
- **Docker Pull**: < 1 minute
- **Response Time**: < 10ms for token operations

### 🔄 Migration from Alpha

If upgrading from `1.0.0-alpha`:

1. **Version Update**: Pull new Docker image
   ```bash
   docker pull ngauth/server:1.0.0
   ```

2. **Data Compatibility**: Fully backward compatible
   - No database migration needed
   - Existing users and clients work as-is

3. **API Compatibility**: No breaking changes
   - All endpoints remain the same
   - Response formats unchanged
   - Client libraries still compatible

4. **Configuration**: No changes required
   - Same environment variables
   - Same volume mounts
   - Same port mappings

### 🐛 Bug Fixes

- Fixed `getUserById()` usage in userinfo and token endpoints
- Fixed token type validation for backward compatibility
- Fixed failed login tracking and account lockout enforcement
- Fixed JSON parsing error handling for corrupted data
- Fixed authorization code cleanup to prevent memory leaks
- Fixed URI validation in client registration
- Fixed health endpoint paths in examples
- Fixed API endpoint paths in all Testcontainers examples
- Fixed field naming to use snake_case throughout
- Fixed JWT verification variable conflicts in tests
- Fixed rate limiting handling in test suites

### ⚠️ Known Limitations

- **Single Instance Only**: No clustering support (by design for testing)
- **File-based Storage**: Not suitable for high-load production (use proper DB for that)
- **No Refresh Tokens**: Authorization code flow doesn't issue refresh tokens yet
- **HTTP Only**: Requires reverse proxy for HTTPS in production
- **Memory Storage**: Restarts clear in-memory data if not using file storage

### 🚀 What's Next?

Future enhancements under consideration:
- Refresh token flow support
- Token introspection endpoint (RFC 7662)
- Token revocation endpoint (RFC 7009)
- Device authorization flow (RFC 8628)
- Additional language examples (Ruby, PHP, Rust)
- Performance optimizations for larger datasets
- Admin API for user/client management

### 📝 Notes

- This is the first stable release of ngauth
- Production-ready for testing and development environments
- Not recommended for high-scale production authentication (use Keycloak, Auth0, etc.)
- Perfect for integration testing with Testcontainers
- Actively maintained with community contributions welcome

### 🙏 Acknowledgments

- OpenID Foundation for OIDC specifications
- Testcontainers community for inspiration
- All contributors and early adopters

---

## [1.0.0-alpha] - 2026-01-20

### Initial Alpha Release

- Basic OAuth 2.0 server implementation
- Docker container support
- Initial documentation
- Proof of concept for Testcontainers integration

---

For more information, see the [README](README.md) and [documentation](docs/).

**Full Changelog**: https://github.com/ngauth/server/commits/v1.0.0
