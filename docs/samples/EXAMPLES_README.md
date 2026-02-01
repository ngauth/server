# ngauth/server Examples

This directory contains practical examples demonstrating how to use ngauth/server in various scenarios.

## Available Examples

### [testcontainers-nodejs](./testcontainers-nodejs/)

Complete example of using ngauth/server with Testcontainers for OAuth 2.0 integration testing in Node.js applications.

**What's Included:**
- Jest integration tests
- Client credentials flow testing
- Authorization code flow testing
- JWT token verification with JWKS
- Docker Compose alternative setup
- CI/CD configuration examples

**Use Cases:**
- Testing OAuth client applications
- Integration testing microservices
- Automated API testing with OAuth
- Learning OAuth 2.0 flows

**Quick Start:**
```bash
cd testcontainers-nodejs
npm install
npm test
```

## Future Examples

### Coming Soon

- **testcontainers-java** - Java/Spring Boot integration testing
- **testcontainers-python** - Python FastAPI/Flask integration testing
- **testcontainers-go** - Go integration testing
- **testcontainers-dotnet** - .NET/C# integration testing
- **playwright-e2e** - End-to-end OAuth flow testing with Playwright
- **cypress-e2e** - Frontend OAuth testing with Cypress
- **microservices** - Multi-service architecture with shared OAuth

## Contributing

Have an example to share? Please submit a pull request!

Examples should:
- Be well-documented with README
- Include working code and tests
- Follow best practices
- Be easy to run and understand

## License

All examples are provided under the MIT License, same as ngauth/server.
