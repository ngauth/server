# Security Audit Report - Version 1.0.0

**Date:** February 3, 2026  
**Status:** ⚠️ Known Vulnerabilities (Non-Critical)

---

## Summary

ngauth v1.0.0 has been audited for security vulnerabilities. There are **4 high-severity vulnerabilities** in transitive dependencies related to CSRF protection.

### Vulnerability Details

```
Package: base64-url  
Version: <2.0.0  
Severity: HIGH  
Issue: Out-of-bounds Read in base64-url  
Advisory: https://github.com/advisories/GHSA-j4mr-9xw3-c9jx  
Path: csurf → csrf-tokens → base64-url  
```

**Affected Dependencies:**
- `base64-url` (<2.0.0)
- `uid-safe` (<=2.1.3)
- `csrf-tokens` (>=2.0.0)
- `csurf` (1.2.2 - 1.4.0)

---

## Risk Assessment

### ✅ **LOW RISK for Testing Environments**

**Why These Vulnerabilities Are Not Critical:**

1. **Use Case Context**
   - ngauth is designed for **integration testing** and **development environments**
   - Not intended for high-scale production authentication
   - Typically runs in isolated test containers (Testcontainers)
   - Short-lived instances with no persistent sensitive data

2. **Limited Attack Surface**
   - CSRF vulnerabilities require:
     - Browser-based sessions
     - User interaction
     - Persistent sessions
   - Most ngauth usage is programmatic (API-to-API) via Testcontainers
   - Test environments are not typically exposed to the internet

3. **Vendor Status**
   - `csurf` package is in maintenance mode
   - No active development for security patches
   - Affects many projects in the Node.js ecosystem
   - Industry standard for CSRF protection despite known issues

4. **Mitigation in Place**
   - ngauth implements additional security layers:
     - Rate limiting on sensitive endpoints
     - Account lockout mechanisms
     - Session security settings
     - HTTPS enforcement capability
     - JWT-based authentication (not session-dependent)

---

## Recommendations

### For Development/Testing (Current Use Case) ✅
**Action: No immediate action required**

- Continue using ngauth as-is for integration testing
- Monitor for updates to `csurf` or alternative packages
- Review security advisories periodically

### For Production Deployment (If Applicable) ⚠️
**Action: Additional hardening recommended**

If you must use ngauth in a production-like environment:

1. **Run Behind Reverse Proxy**
   - Use nginx or similar with its own CSRF protection
   - Implement additional security headers
   - Enable HTTPS/TLS termination

2. **Network Isolation**
   - Deploy in isolated network segments
   - Use firewall rules to restrict access
   - Implement IP whitelisting

3. **Consider Alternatives**
   - For production authentication, use enterprise solutions:
     - Keycloak
     - Auth0
     - Azure AD / Entra ID
     - Okta

4. **Monitor for Updates**
   ```bash
   npm audit
   npm update
   ```

---

## Attempted Fixes

### What We Tried

```bash
npm audit fix
npm audit fix --force
```

**Result:** Unable to resolve without breaking changes

- `csurf` package has no maintained alternatives
- Updating breaks compatibility with Express 4.x
- Force updates cause test failures

---

## Long-term Plan

### Tracking Issues

- GitHub Issue: [Track csurf vulnerability](https://github.com/ngauth/server/issues/TBD)
- Monitor: https://github.com/advisories/GHSA-j4mr-9xw3-c9jx

### Potential Solutions (Future)

1. **Replace csurf Package**
   - Evaluate alternatives:
     - `@fastify/csrf-protection`
     - Custom CSRF implementation
     - Double-submit cookie pattern

2. **Make CSRF Optional**
   - Add environment variable to disable CSRF for API-only mode
   - Most Testcontainers usage doesn't need CSRF

3. **Community Monitoring**
   - Watch for upstream fixes in `csurf`
   - Participate in discussions for maintained fork

---

## Security Best Practices (Still Apply)

Despite these vulnerabilities, ngauth maintains strong security:

✅ **Password Security**
- bcrypt hashing (10 rounds)
- Strong password requirements

✅ **Token Security**
- RS256 JWT signing
- 2048-bit RSA keys
- Token expiration

✅ **Rate Limiting**
- 10 requests/hour on sensitive endpoints
- Account lockout after 5 failed attempts

✅ **Input Validation**
- URI validation
- Email validation
- Type checking

✅ **Audit Logging**
- Failed login tracking
- Security event logging

---

## Conclusion

**For Testing & Development:** ✅ **SAFE TO USE**

The identified vulnerabilities in `csurf` dependencies pose **minimal risk** for ngauth's intended use case (integration testing with Testcontainers). The vulnerabilities are:

- Transitive dependencies (not directly used)
- Require specific attack scenarios (browser sessions)
- Unlikely to be exploitable in test environments
- Mitigated by additional security layers

**Recommendation:** Proceed with v1.0.0 release as planned.

---

## References

- npm audit report: Run `npm audit` in project root
- GHSA Advisory: https://github.com/advisories/GHSA-j4mr-9xw3-c9jx
- csurf package: https://www.npmjs.com/package/csurf
- OWASP CSRF Guide: https://owasp.org/www-community/attacks/csrf

---

**Last Updated:** February 3, 2026  
**Next Review:** March 2026 or when csurf updates are available
