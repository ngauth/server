# Security Guide

This document outlines security considerations and best practices for deploying the ngauth OAuth 2.0 server.

## Table of Contents

1. [Critical Requirements](#critical-requirements)
2. [Security Features](#security-features)
3. [Configuration](#configuration)
4. [Deployment Checklist](#deployment-checklist)
5. [Incident Response](#incident-response)
6. [Compliance](#compliance)

---

## Critical Requirements

### HTTPS/TLS is Mandatory

**The server MUST be deployed behind a TLS-terminating reverse proxy.** OAuth 2.0 RFC 6749 requires TLS for all authorization and token endpoints.

The server does NOT enforce TLS directly because:
- This is a minimalistic server suitable for containerized deployment
- TLS termination at the edge (reverse proxy, load balancer) is the standard practice
- The `x-forwarded-proto` header is checked in production mode for HTTPS enforcement

**Minimum Requirements:**
- TLS 1.2 or higher
- Strong cipher suites (no SSLv3, TLS 1.0, TLS 1.1)
- Valid certificate (self-signed acceptable for testing only)
- Certificate must match the hostname

**Example nginx Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name oauth.example.com;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    
    ssl_certificate /etc/ssl/certs/oauth.crt;
    ssl_certificate_key /etc/ssl/private/oauth.key;
    
    # HSTS header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Host $host;
    }
}
```

---

## Security Features

### 1. Password Security

Passwords are hashed using bcrypt with 10 salt rounds.

**Password Requirements:**
- Minimum 8 characters
- Must contain at least 3 of: uppercase letters, lowercase letters, numbers, special characters
- Passwords are never logged or exposed in API responses
- Password hashes use bcrypt (industry standard)

### 2. Authentication & Authorization

**JWT Tokens:**
- Algorithm: RS256 (RSA with SHA-256)
- Expiration: 1 hour (configurable via `expiresIn` parameter)
- Claims include: `sub` (user ID), `username`, `email`, `scope`
- Tokens are signed with a private RSA key (2048-bit minimum)

**Scopes:**
- `user:read` - Read user information
- `user:write` - Update own user profile
- `user:admin` - Administrative operations

### 3. Rate Limiting

Protects against brute force and DoS attacks:

**Login Endpoint (`POST /users/login`):**
- 5 attempts per 15 minutes per IP address
- Progressive lockout after failed attempts

**Registration Endpoint (`POST /users`):**
- 10 registrations per hour per IP address

**Account Lockout:**
- After 5 failed login attempts, account locks for 15 minutes
- Lock is automatic and expires after the lockout period
- System logs all failed attempts

### 4. Input Validation

All user inputs are validated:

**Username:**
- 3-64 characters
- Alphanumeric characters and underscores only
- Must be unique

**Email:**
- Valid email format (RFC 5322)
- Maximum 254 characters (RFC 5321)
- Local part: maximum 64 characters
- Must be unique

**Password:**
- Minimum 8 characters
- Complexity requirement: 3 of 4 categories

### 5. Security Headers

The server implements security headers via Helmet.js:

- **Strict-Transport-Security (HSTS)**: 1 year, includes subdomains, preload enabled
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Content-Security-Policy**: Configured for API security

### 6. CSRF Protection

CSRF tokens are implemented for:
- Authorization forms
- Any state-changing operations on HTML forms
- API routes use Bearer token authentication (immune to CSRF)

### 7. Audit Logging

All security events are logged to `NGAUTH_DATA/audit.log`:

```json
{
  "timestamp": "2026-01-26T12:34:56.000Z",
  "type": "AUTH_FAILED",
  "method": "POST",
  "path": "/users/login",
  "ip": "192.168.1.100",
  "statusCode": 401
}
```

**Logged Events:**
- Failed authentication attempts
- Account lockouts
- User CRUD operations (create, update, delete)
- Invalid token attempts
- Insufficient scope errors

### 8. Session Security

Session cookies are configured securely:

- **httpOnly**: Prevents JavaScript access to cookies
- **sameSite**: strict (prevents CSRF)
- **secure**: Enabled in production (requires HTTPS)
- **maxAge**: Configured per deployment

---

## Configuration

### Environment Variables

```bash
# Server
PORT=3000                          # Port to listen on (default: 3000)
NODE_ENV=production               # Set to 'production' for HTTPS enforcement

# Security
SESSION_SECRET=<random-string>    # Session encryption key (32+ random chars)
NGAUTH_KEY=<private-key-pem>     # Optional: RSA private key as environment variable

# Storage
NGAUTH_DATA=/data                 # Directory for persistent data
```

### SESSION_SECRET Generation

```bash
# Generate a strong SESSION_SECRET
openssl rand -hex 32
# Output example: a7f3e2d9c1b4a6f8e3d2c1b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0
```

### Private Key Management

**Option 1: File-based (default)**
```bash
# Key is auto-generated and stored in NGAUTH_DATA/private-key.pem
# Set permissions to 600:
chmod 600 /data/private-key.pem
```

**Option 2: Environment variable**
```bash
export NGAUTH_KEY="$(cat /secure/private-key.pem)"
```

**Option 3: External key management (recommended for production)**
- Use AWS KMS or similar
- Keep private key never stored on disk
- Rotate keys regularly

### Key Rotation

For production deployments, implement key rotation:

1. Generate new RSA key pair
2. Deploy with both old and new keys
3. Sign new tokens with new key
4. Accept verification with both keys for transition period
5. Monitor token issuance
6. Retire old key

---

## Deployment Checklist

### Pre-Deployment

- [ ] Generate strong `SESSION_SECRET` (32+ random bytes)
- [ ] Generate or obtain valid TLS certificate
- [ ] Configure reverse proxy with HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Test HTTPS enforcement works
- [ ] Configure `NGAUTH_DATA` directory
- [ ] Secure private key file permissions (chmod 600)
- [ ] Set up audit log monitoring
- [ ] Configure backup strategy for `NGAUTH_DATA`
- [ ] Run full test suite: `npm test`

### Runtime

- [ ] Monitor failed login attempts (audit log)
- [ ] Monitor application errors (logs)
- [ ] Verify HTTPS is in use (check headers)
- [ ] Verify security headers are present
- [ ] Monitor rate limiting effectiveness
- [ ] Check for unauthorized access patterns

### Hardening

- [ ] Use WAF (Web Application Firewall) in front of server
- [ ] Implement DDoS protection
- [ ] Enable logging and centralized log aggregation
- [ ] Set up alerts for security events
- [ ] Regular security updates to Node.js and dependencies
- [ ] Regular scanning for vulnerabilities: `npm audit`
- [ ] Implement IP whitelisting if applicable
- [ ] Use secrets management system (Vault, Secrets Manager)

---

## Incident Response

### Account Lockout

If a user reports being locked out:

1. Verify the lockout timestamp in audit log
2. Lockout expires automatically after 15 minutes
3. To force unlock: Delete user's `lockedUntil` and `failedLoginAttempts` fields from `users.json`
4. Document the incident

### Suspected Compromise

If private key may be compromised:

1. Immediately:
   - Rotate the private key
   - Invalidate all active tokens (require re-authentication)
   - Review audit logs for unauthorized access
   
2. Actions:
   - Generate new RSA key pair
   - Update `NGAUTH_DATA/private-key.pem`
   - Notify all users to re-authenticate
   - Audit all user operations from compromise period

3. Prevention:
   - Implement key rotation schedule
   - Improve key storage/access controls
   - Audit who has access to keys

### Database Compromise

If `users.json` is compromised:

1. All user data and password hashes are exposed
2. Users must reset passwords
3. Implement additional authentication measures
4. Review and revoke any suspicious tokens

---

## Compliance

### OAuth 2.0 RFC 6749 Compliance

This server implements:
- ✅ Authorization Code Grant flow
- ✅ Client authentication
- ✅ TLS requirement (via reverse proxy)
- ✅ Token endpoint security
- ✅ Error responses with error codes
- ✅ Access token responses
- ✅ Redirect URI validation
- ✅ Authorization code single-use
- ✅ Short-lived authorization codes (10 minutes max)
- ✅ State parameter validation
- ✅ Metadata endpoint

### Security Best Practices

Implements OWASP Top 10 mitigation:
- ✅ A01: Broken Access Control (scopes, authorization)
- ✅ A02: Cryptographic Failures (bcrypt, JWT RS256)
- ✅ A03: Injection (input validation)
- ✅ A04: Insecure Design (security by design)
- ✅ A05: Security Misconfiguration (security headers)
- ✅ A06: Vulnerable Components (regular updates)
- ✅ A07: Authentication Failures (strong passwords, rate limiting)
- ✅ A08: Software and Data Integrity (verified npm packages)
- ✅ A09: Logging & Monitoring (audit logs)
- ✅ A10: SSRF (input validation)

---

## Support & Reporting

For security issues:
- Do NOT open public issues for security vulnerabilities
- Email security team with details
- Include reproduction steps if possible
- Allow reasonable time for fixes before disclosure

## Additional Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
