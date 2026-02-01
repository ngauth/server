# ngauth Testcontainers .NET Example

This example demonstrates how to use [ngauth](https://github.com/ngauth/server) OAuth 2.0 server with [Testcontainers for .NET](https://dotnet.testcontainers.org/) for integration testing.

## Overview

ngauth is a lightweight OAuth 2.0 and OpenID Connect (OIDC) server designed specifically for integration testing. This example shows how to:

- Start an ngauth container using Testcontainers .NET
- Test OAuth 2.0 client credentials flow
- Test OAuth 2.0 authorization code flow
- Verify JWT token signatures using JWKS
- Test the OIDC UserInfo endpoint
- Handle error scenarios and token expiration

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (or Docker Engine on Linux)
- Basic understanding of OAuth 2.0 and OIDC concepts

## Project Structure

```
testcontainers-dotnet/
├── NgAuthTests.csproj       # Project file with dependencies
├── NgAuthTests.cs           # Test suite with OAuth/OIDC tests
└── README.md               # This file
```

## Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/ngauth/server.git
   cd server/docs/samples/testcontainers-dotnet
   ```

2. **Restore dependencies**:
   ```bash
   dotnet restore
   ```

3. **Ensure Docker is running**:
   ```bash
   docker ps
   ```

## Running the Tests

Run all tests:
```bash
dotnet test
```

Run tests with detailed output:
```bash
dotnet test --logger "console;verbosity=detailed"
```

Run a specific test:
```bash
dotnet test --filter "FullyQualifiedName~ClientCredentialsFlow"
```

Run tests in parallel (default behavior):
```bash
dotnet test --parallel
```

## Test Scenarios

### 1. Container Health Check
```csharp
[Fact]
public async Task Container_ShouldStart_AndBeHealthy()
```
Verifies that the ngauth container starts successfully and responds to health checks.

### 2. OIDC Discovery
```csharp
[Fact]
public async Task OidcDiscovery_ShouldReturn_WellKnownConfiguration()
```
Tests the `/.well-known/openid-configuration` endpoint to ensure proper OIDC discovery metadata.

### 3. Client Credentials Flow
```csharp
[Fact]
public async Task ClientCredentialsFlow_ShouldReturn_ValidAccessToken()
```
Tests the OAuth 2.0 client credentials grant type, commonly used for server-to-server authentication.

**Request:**
```http
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=test-client
&client_secret=test-secret
&scope=read write
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 4. Authorization Code Flow
```csharp
[Fact]
public async Task AuthorizationCodeFlow_ShouldReturn_AuthorizationCode()
```
Tests the OAuth 2.0 authorization code flow, used for user authentication in web applications.

### 5. Authorization Code Exchange
```csharp
[Fact]
public async Task AuthorizationCodeExchange_ShouldReturn_AccessAndIdTokens()
```
Demonstrates the complete authorization code flow including exchanging the code for access and ID tokens.

### 6. JWT Signature Verification
```csharp
[Fact]
public async Task JwtVerification_ShouldValidate_TokenSignature()
```
Retrieves the JWKS (JSON Web Key Set) and validates JWT token signatures using `System.IdentityModel.Tokens.Jwt`.

### 7. UserInfo Endpoint
```csharp
[Fact]
public async Task UserInfo_ShouldReturn_UserClaims()
```
Tests the OIDC `/userinfo` endpoint to retrieve user claims using an access token.

### 8. Error Handling
```csharp
[Fact]
public async Task InvalidClientCredentials_ShouldReturn_Unauthorized()
```
Verifies proper error handling for invalid credentials.

### 9. Token Expiration
```csharp
[Fact]
public async Task ExpiredToken_ShouldFail_Validation()
```
Demonstrates handling of expired tokens and validation errors.

## Key Dependencies

This project uses the following NuGet packages:

- **Testcontainers** (3.7.0): Container orchestration for tests
- **xUnit** (2.6.6): Testing framework
- **System.IdentityModel.Tokens.Jwt** (7.3.1): JWT token handling and validation
- **Microsoft.IdentityModel.Protocols.OpenIdConnect** (7.3.1): OIDC protocol support

## Configuration

### Container Configuration

The ngauth container is configured in the test setup:

```csharp
_container = new ContainerBuilder()
    .WithImage("ngauth/server:latest")
    .WithPortBinding(3000, true)  // Map container port 3000 to random host port
    .WithWaitStrategy(Wait.ForUnixContainer()
        .UntilHttpRequestIsSucceeded(r => r.ForPort(3000)))
    .Build();
```

### Default Credentials

ngauth comes with default test credentials (automatically configured):

- **Client ID**: `test-client`
- **Client Secret**: `test-secret`
- **Redirect URI**: `http://localhost:3000/callback`
- **Test User**: `testuser` / `password`

### Customizing Configuration

You can customize ngauth behavior using environment variables:

```csharp
_container = new ContainerBuilder()
    .WithImage("ngauth/server:latest")
    .WithPortBinding(3000, true)
    .WithEnvironment("ISSUER", "https://custom-issuer.com")
    .WithEnvironment("TOKEN_EXPIRATION", "7200")
    .WithWaitStrategy(Wait.ForUnixContainer()
        .UntilHttpRequestIsSucceeded(r => r.ForPort(3000)))
    .Build();
```

Available environment variables:
- `ISSUER`: Custom issuer URL (default: `http://localhost:3000`)
- `TOKEN_EXPIRATION`: Access token lifetime in seconds (default: 3600)
- `PORT`: Internal container port (default: 3000)
- `DATA_DIR`: Directory for persistent data (default: `/app/data`)

## Code Walkthrough

### 1. Test Lifecycle Management

The `IAsyncLifetime` interface provides setup and teardown hooks:

```csharp
public class NgAuthOAuthTests : IAsyncLifetime
{
    public async Task InitializeAsync()
    {
        // Start container before each test class
        await _container.StartAsync();
        _baseUrl = $"http://localhost:{_container.GetMappedPublicPort(3000)}";
    }

    public async Task DisposeAsync()
    {
        // Clean up after all tests complete
        await _container.StopAsync();
        await _container.DisposeAsync();
    }
}
```

### 2. Making OAuth Requests

Client credentials flow example:

```csharp
var requestBody = new Dictionary<string, string>
{
    { "grant_type", "client_credentials" },
    { "client_id", ClientId },
    { "client_secret", ClientSecret },
    { "scope", "read write" }
};

var response = await _httpClient.PostAsync("/token", 
    new FormUrlEncodedContent(requestBody));
var tokenResponse = await response.Content
    .ReadFromJsonAsync<TokenResponse>();
```

### 3. JWT Validation

Validating tokens using JWKS:

```csharp
var jwksResponse = await _httpClient.GetAsync("/.well-known/jwks.json");
var jwks = JsonSerializer.Deserialize<JsonWebKeySet>(
    await jwksResponse.Content.ReadAsStringAsync());

var validationParameters = new TokenValidationParameters
{
    ValidateIssuer = true,
    ValidIssuer = _baseUrl,
    ValidateLifetime = true,
    IssuerSigningKeys = jwks.Keys
};

var principal = handler.ValidateToken(token, validationParameters, 
    out var validatedToken);
```

## Troubleshooting

### Docker Connection Issues

**Error**: `Docker daemon is not running`

**Solution**:
```bash
# macOS/Windows
# Start Docker Desktop

# Linux
sudo systemctl start docker
```

### Port Conflicts

**Error**: `Port 3000 is already in use`

**Solution**: Testcontainers automatically maps to random ports, but if you've hardcoded ports:
```csharp
.WithPortBinding(3000, true)  // true = assign random host port
```

### Container Won't Start

**Error**: `Container failed to start`

**Solution**:
```bash
# Pull the latest ngauth image
docker pull ngauth/server:latest

# Check Docker logs
docker logs <container-id>
```

### Test Failures

**Error**: `Assert.True() Failure`

**Solution**:
- Ensure Docker is running
- Check that the ngauth image is available: `docker images | grep ngauth`
- Increase wait timeout if needed:
  ```csharp
  .WithWaitStrategy(Wait.ForUnixContainer()
      .UntilHttpRequestIsSucceeded(r => r
          .ForPort(3000)
          .WithTimeout(TimeSpan.FromSeconds(60))))
  ```

### HTTPS/SSL Issues

If testing HTTPS locally:
```csharp
var handler = new HttpClientHandler
{
    ServerCertificateCustomValidationCallback = 
        HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
};
_httpClient = new HttpClient(handler);
```

⚠️ **Warning**: Only use this in tests, never in production!

## Best Practices

### 1. Resource Cleanup

Always implement `IAsyncLifetime` to ensure containers are stopped:

```csharp
public async Task DisposeAsync()
{
    _httpClient?.Dispose();
    if (_container != null)
    {
        await _container.StopAsync();
        await _container.DisposeAsync();
    }
}
```

### 2. Test Isolation

Each test should be independent:
- Use unique state parameters
- Don't rely on test execution order
- Clean up any created resources

### 3. Async/Await Patterns

Use async/await consistently for better performance:

```csharp
[Fact]
public async Task MyTest()
{
    var result = await _httpClient.GetAsync("/endpoint");
    // Test assertions
}
```

### 4. Error Handling

Test both success and failure scenarios:

```csharp
[Fact]
public async Task InvalidRequest_ShouldReturn_BadRequest()
{
    var response = await _httpClient.PostAsync("/token", null);
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

### 5. Performance

Reuse containers across tests when possible using class fixtures or `IAsyncLifetime`.

## Integration with CI/CD

### GitHub Actions

```yaml
name: .NET Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: '8.0.x'
    
    - name: Restore dependencies
      run: dotnet restore
    
    - name: Run tests
      run: dotnet test --no-restore --verbosity normal
```

### Azure DevOps

```yaml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: UseDotNet@2
  inputs:
    version: '8.0.x'

- script: dotnet restore
  displayName: 'Restore dependencies'

- script: dotnet test --logger trx
  displayName: 'Run tests'

- task: PublishTestResults@2
  inputs:
    testResultsFormat: 'VSTest'
    testResultsFiles: '**/*.trx'
```

## Advanced Usage

### Custom OAuth Scopes

```csharp
var requestBody = new Dictionary<string, string>
{
    { "grant_type", "client_credentials" },
    { "client_id", ClientId },
    { "client_secret", ClientSecret },
    { "scope", "custom:scope1 custom:scope2" }
};
```

### Testing Multiple Clients

```csharp
[Theory]
[InlineData("client1", "secret1")]
[InlineData("client2", "secret2")]
public async Task MultipleClients_ShouldAuthenticate(string clientId, string secret)
{
    // Test multiple client configurations
}
```

### Parallel Test Execution

xUnit runs tests in parallel by default. To disable for specific tests:

```csharp
[Collection("Sequential")]
public class NgAuthOAuthTests
{
    // Tests run sequentially
}
```

## Additional Resources

- **ngauth GitHub**: https://github.com/ngauth/server
- **ngauth Documentation**: https://github.com/ngauth/server#readme
- **Testcontainers .NET**: https://dotnet.testcontainers.org/
- **OAuth 2.0 Specification**: https://oauth.net/2/
- **OpenID Connect Specification**: https://openid.net/connect/
- **JWT.io Debugger**: https://jwt.io/

## Support

- **Issues**: https://github.com/ngauth/server/issues
- **Discussions**: https://github.com/ngauth/server/discussions

## License

This example is provided under the MIT License. See the [LICENSE](../../../LICENSE) file for details.

---

**Happy Testing! 🎉**
