# ngauth Samples

This directory contains sample configurations and integration examples for the ngauth OAuth 2.0 server.

## Samples Available

### 1. Docker Compose Test Setup

**Location:** `docker-compose-test/`

A complete Docker Compose setup demonstrating how to:
- Run the ngauth OAuth server
- Run an example API server that requires OAuth authentication
- Test OAuth 2.0 flows (client credentials, authorization code)
- Validate protected endpoints with tokens
- Implement scope-based access control

**Quick Start:**
```bash
cd docker-compose-test
docker-compose up
bash test-requests.sh  # In another terminal
```

**What you'll learn:**
- How to integrate ngauth with your API server
- OAuth 2.0 client registration flow
- User authentication and authorization
- Token-based API access control
- Scope-based access restrictions

**Includes:**
- `docker-compose.yml` - Complete service configuration
- `api-server.js` - Example Node.js API server
- `test-requests.sh` - Automated test script
- `README.md` - Detailed documentation
- `.env.example` - Configuration template

For detailed instructions, see [docker-compose-test/README.md](docker-compose-test/README.md)

## More Examples Coming

Additional samples will be added for:
- Python API server with OAuth integration
- Go/Gin API server examples
- Kubernetes deployment manifests
- Production deployment guides
- Mobile app authentication examples

## Getting Help

- Check the README in each sample directory
- Review the ngauth documentation
- See the main project README for architecture overview
- Check troubleshooting sections in sample READMEs

## Contributing

To add a new sample:
1. Create a new directory in `docs/samples/`
2. Add your complete working example
3. Include a comprehensive README
4. Add test/verification scripts if applicable
5. Update this index file

## Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/rfc6819)
- [JWT/JWKS Standards](https://tools.ietf.org/html/rfc7517)
- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)
