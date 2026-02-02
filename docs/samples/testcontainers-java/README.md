# Testcontainers with ngauth/server - Java (Spring Boot) Example

This sample shows how to use **ngauth/server** with **Testcontainers for Java** to test OAuth 2.0/OIDC flows and a Spring Boot API protected by JWTs.

## Overview

- Spring Boot API with protected endpoints
- OAuth 2.0/OIDC integration tests using Testcontainers
- Uses **NGAUTH_PRESET=cognito** and OIDC discovery
- Java 21 + Maven

## Project Structure

```
testcontainers-java/
├── README.md
├── pom.xml
├── api/
│   ├── pom.xml
│   └── src/main/java/com/ngauth/sample/api/
│       ├── SampleApiApplication.java
│       ├── config/SecurityConfig.java
│       └── controller/SampleController.java
│   └── src/main/resources/application.yml
└── tests/
    ├── pom.xml
    └── src/test/java/com/ngauth/sample/tests/OAuthFlowsTests.java
```

## API Endpoints

| Endpoint | Method | Auth | Scope | Description |
|----------|--------|------|-------|-------------|
| /api/public | GET | No | - | Public endpoint |
| /api/protected | GET | Yes | - | Requires valid JWT |
| /api/data | GET | Yes | read | Requires `read` scope |
| /api/data | POST | Yes | write | Requires `write` scope |
| /api/userinfo | GET | Yes | - | Returns basic token claims |

## Prerequisites

- Java 21
- Maven 3.9+
- Docker

## Running the API

From this folder:

```bash
mvn -pl api spring-boot:run
```

The API listens on `http://localhost:8081` and expects the issuer at `http://localhost:3000` by default.

## Running the Tests

The tests start ngauth via Testcontainers and validate OAuth flows:

```bash
mvn -pl tests test
```

## What the Tests Cover

- Container startup + OIDC discovery
- Client credentials flow
- Authorization code flow
- JWKS signature verification
- Error handling for unsupported grant types

## Notes

- The tests set `NGAUTH_PRESET=cognito` to match common Java usage.
- OIDC discovery is performed via `/.well-known/openid-configuration` and used to resolve `authorization_endpoint`, `token_endpoint`, and `jwks_uri` dynamically.

## Resources

- [Testcontainers Java](https://testcontainers.com/guides/getting-started-with-testcontainers-for-java/)
- [Spring Security OAuth2 Resource Server](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/index.html)
- [ngauth/server](https://github.com/ngauth/server)
