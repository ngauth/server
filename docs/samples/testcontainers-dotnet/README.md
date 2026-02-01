# ngauth Testcontainers .NET Example

This example demonstrates how to use [ngauth](https://github.com/ngauth/server) OAuth 2.0 server with [Testcontainers for .NET](https://dotnet.testcontainers.org/) to test a protected ASP.NET Core Web API.

## Overview

ngauth is a lightweight OAuth 2.0 and OpenID Connect (OIDC) server designed specifically for integration testing. This example shows a **realistic testing scenario**:

- A sample ASP.NET Core Web API (`SampleApi`) with JWT Bearer authentication
- Protected endpoints requiring authentication
- Scope-based authorization (endpoints requiring specific OAuth scopes)
- Integration tests using Testcontainers to spin up ngauth OAuth server
- Tests validating that the API correctly enforces authentication and authorization

This demonstrates how to test your API's security implementation in an automated, isolated way.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (or Docker Engine on Linux)
- Basic understanding of OAuth 2.0 and ASP.NET Core authentication

## Project Structure

```
testcontainers-dotnet/
├── SampleApi/
│   ├── SampleApi.csproj     # Web API project
│   └── Program.cs           # API with protected endpoints
├── NgAuthTests.csproj       # Test project
├── ProtectedApiTests.cs     # Integration tests for protected API
├── NgAuthTests.cs           # Direct OAuth/OIDC flow tests (legacy)
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

Run a specific test class:
```bash
dotnet test --filter "FullyQualifiedName~ProtectedApiTests"
```

Run a specific test:
```bash
dotnet test --filter "FullyQualifiedName~ScopeProtectedEndpoint_ShouldReturn200_WithRequiredScope"
```

## The Sample API

The `SampleApi` project demonstrates a typical ASP.NET Core Web API with OAuth 2.0 JWT Bearer authentication:

### Endpoints

| Endpoint | Method | Auth Required | Scope Required | Description |
|----------|--------|---------------|----------------|-------------|
| `/api/public` | GET | ❌ No | - | Public endpoint, no authentication |
| `/api/protected` | GET | ✅ Yes | - | Requires valid JWT token |
| `/api/data` | GET | ✅ Yes | `read` | Requires token with 'read' scope |
| `/api/data` | POST | ✅ Yes | `write` | Requires token with 'write' scope |
| `/api/userinfo` | GET | ✅ Yes | - | Returns user claims from token |

### Authentication Configuration

The API uses Microsoft's `Microsoft.AspNetCore.Authentication.JwtBearer` package:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "http://localhost:3000"; // ngauth URL
        options.RequireHttpsMetadata = false; // Allow HTTP for testing
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });
```

### Authorization Policies

Scope-based policies are defined using claims:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireReadScope", policy =>
        policy.RequireClaim("scope", "read"));
    
    options.AddPolicy("RequireWriteScope", policy =>
        policy.RequireClaim("scope", "write"));
});
```

## Test Scenarios

### ProtectedApiTests (Realistic API Testing)

These tests demonstrate testing a real ASP.NET Core API with OAuth 2.0 protection:

#### 1. Public Endpoint Access
```csharp
[Fact]
public async Task PublicEndpoint_ShouldBeAccessible_WithoutAuthentication()
```
Verifies that public endpoints work without authentication.

#### 2. Protected Endpoint - No Token
```csharp
[Fact]
public async Task ProtectedEndpoint_ShouldReturn401_WithoutToken()
```
Ensures protected endpoints return HTTP 401 Unauthorized when no token is provided.

#### 3. Protected Endpoint - Valid Token
```csharp
[Fact]
public async Task ProtectedEndpoint_ShouldReturn200_WithValidToken()
```
Tests that endpoints protected with `[Authorize]` accept valid JWT tokens from ngauth.

#### 4. Scope Protection - Missing Scope
```csharp
[Fact]
public async Task ScopeProtectedEndpoint_ShouldReturn403_WithoutRequiredScope()
```
Verifies that endpoints requiring specific scopes return HTTP 403 Forbidden when the token lacks the required scope.

#### 5. Scope Protection - With Required Scope
```csharp
[Fact]
public async Task ScopeProtectedEndpoint_ShouldReturn200_WithRequiredScope()
```
Tests successful access when the token contains the required scope claim.

#### 6. Write Operations - Scope Enforcement
```csharp
[Fact]
public async Task WriteEndpoint_ShouldReturn403_WithoutWriteScope()
public async Task WriteEndpoint_ShouldReturn200_WithWriteScope()
```
Demonstrates testing write operations that require specific permissions.

#### 7. User Claims Propagation
```csharp
[Fact]
public async Task UserInfoEndpoint_ShouldReturnClaims_WithValidToken()
```
Verifies that user claims from the OAuth token are correctly available in the API.

### NgAuthTests (Direct OAuth Flow Testing)

These tests demonstrate direct OAuth 2.0 flow testing:

#### 1. Container Health Check
Verifies that the ngauth container starts successfully.

#### 2. OIDC Discovery
Tests the `/.well-known/openid-configuration` endpoint.

#### 3. Client Credentials Flow
Tests OAuth 2.0 client credentials grant for service-to-service authentication.

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

### Test Project
- **Testcontainers** (3.7.0): Container orchestration for tests
- **xUnit** (2.6.6): Testing framework
- **System.IdentityModel.Tokens.Jwt** (7.3.1): JWT token handling and validation
- **Microsoft.IdentityModel.Protocols.OpenIdConnect** (7.3.1): OIDC protocol support
- **Microsoft.AspNetCore.Mvc.Testing** (8.0.1): In-memory API testing

### API Project
- **Microsoft.AspNetCore.Authentication.JwtBearer** (8.0.1): JWT Bearer authentication for ASP.NET Core

## How It Works

### Test Setup Flow

1. **Start ngauth OAuth Container**
   ```csharp
   _oauthContainer = new ContainerBuilder()
       .WithImage("ngauth/server:latest")
       .WithPortBinding(3000, true)
       .Build();
   await _oauthContainer.StartAsync();
   ```

2. **Configure API to Use ngauth**
   ```csharp
   _apiFactory = new WebApplicationFactory<Program>()
       .WithWebHostBuilder(builder =>
       {
           builder.ConfigureAppConfiguration((context, config) =>
           {
               config.AddInMemoryCollection(new Dictionary<string, string?>
               {
                   ["Authentication:Authority"] = oauthContainerUrl
               });
           });
       });
   ```

3. **Run Tests Against Protected API**
   - Get token from ngauth OAuth container
   - Call API endpoints with token
   - Verify authorization behavior

### Default Credentials

ngauth comes with default test credentials:

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

### 1. Testing a Protected API

The key pattern is using `WebApplicationFactory` to test your API with ngauth:

```csharp
public class ProtectedApiTests : IAsyncLifetime
{
    private IContainer? _oauthContainer;
    private WebApplicationFactory<Program>? _apiFactory;
    private HttpClient? _apiClient;

    public async Task InitializeAsync()
    {
        // Start ngauth OAuth container
        _oauthContainer = new ContainerBuilder()
            .WithImage("ngauth/server:latest")
            .WithPortBinding(3000, true)
            .Build();
        await _oauthContainer.StartAsync();
        
        var oauthUrl = $"http://localhost:{_oauthContainer.GetMappedPublicPort(3000)}";

        // Start API with OAuth authority pointing to ngauth
        _apiFactory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((context, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Authentication:Authority"] = oauthUrl
                    });
                });
            });

        _apiClient = _apiFactory.CreateClient();
    }
}
```

### 2. Getting OAuth Tokens

Helper method to get tokens with specific scopes:

```csharp
private async Task<string> GetClientCredentialsToken(string scope)
{
    var requestBody = new Dictionary<string, string>
    {
        { "grant_type", "client_credentials" },
        { "client_id", "test-client" },
        { "client_secret", "test-secret" },
        { "scope", scope }
    };

    var response = await _oauthClient.PostAsync("/token", 
        new FormUrlEncodedContent(requestBody));
    var tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>();
    return tokenResponse!.AccessToken;
}
```

### 3. Testing Protected Endpoints

Test that authorization is enforced:

```csharp
[Fact]
public async Task ProtectedEndpoint_ShouldReturn401_WithoutToken()
{
    // No Authorization header
    var response = await _apiClient.GetAsync("/api/protected");
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}

[Fact]
public async Task ProtectedEndpoint_ShouldReturn200_WithValidToken()
{
    var token = await GetClientCredentialsToken("openid profile");
    
    var request = new HttpRequestMessage(HttpMethod.Get, "/api/protected");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    var response = await _apiClient.SendAsync(request);
    
    Assert.True(response.IsSuccessStatusCode);
}
```

### 4. Testing Scope-Based Authorization

Verify scope requirements are enforced:

```csharp
[Fact]
public async Task ScopeProtectedEndpoint_ShouldReturn403_WithoutRequiredScope()
{
    var token = await GetClientCredentialsToken("openid"); // Missing 'read' scope
    
    var request = new HttpRequestMessage(HttpMethod.Get, "/api/data");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    var response = await _apiClient.SendAsync(request);
    
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
}

[Fact]
public async Task ScopeProtectedEndpoint_ShouldReturn200_WithRequiredScope()
{
    var token = await GetClientCredentialsToken("read"); // Has required scope
    
    var request = new HttpRequestMessage(HttpMethod.Get, "/api/data");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    var response = await _apiClient.SendAsync(request);
    
    Assert.True(response.IsSuccessStatusCode);
}
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
