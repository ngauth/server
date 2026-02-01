using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace NgAuthTests;

public class NgAuthOAuthTests : IAsyncLifetime
{
    private IContainer? _container;
    private HttpClient? _httpClient;
    private string _baseUrl = string.Empty;
    private const string ClientId = "test-client";
    private const string ClientSecret = "test-secret";
    private const string RedirectUri = "http://localhost:3000/callback";

    public async Task InitializeAsync()
    {
        // Build and start the ngauth container
        _container = new ContainerBuilder()
            .WithImage("ngauth/server:latest")
            .WithPortBinding(3000, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(3000)))
            .Build();

        await _container.StartAsync();

        var port = _container.GetMappedPublicPort(3000);
        _baseUrl = $"http://localhost:{port}";
        _httpClient = new HttpClient { BaseAddress = new Uri(_baseUrl) };
    }

    public async Task DisposeAsync()
    {
        _httpClient?.Dispose();
        if (_container != null)
        {
            await _container.StopAsync();
            await _container.DisposeAsync();
        }
    }

    [Fact]
    public async Task Container_ShouldStart_AndBeHealthy()
    {
        // Arrange & Act
        var response = await _httpClient!.GetAsync("/health");

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var health = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(health);
        Assert.Equal("ok", health.Status);
    }

    [Fact]
    public async Task OidcDiscovery_ShouldReturn_WellKnownConfiguration()
    {
        // Arrange & Act
        var response = await _httpClient!.GetAsync("/.well-known/openid-configuration");

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var config = await response.Content.ReadFromJsonAsync<OidcConfiguration>();
        Assert.NotNull(config);
        Assert.Equal($"{_baseUrl}", config.Issuer);
        Assert.Equal($"{_baseUrl}/authorize", config.AuthorizationEndpoint);
        Assert.Equal($"{_baseUrl}/token", config.TokenEndpoint);
        Assert.Contains("authorization_code", config.GrantTypesSupported);
        Assert.Contains("client_credentials", config.GrantTypesSupported);
    }

    [Fact]
    public async Task ClientCredentialsFlow_ShouldReturn_ValidAccessToken()
    {
        // Arrange
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", ClientId },
            { "client_secret", ClientSecret },
            { "scope", "read write" }
        };

        // Act
        var response = await _httpClient!.PostAsync("/token", new FormUrlEncodedContent(requestBody));

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>();
        Assert.NotNull(tokenResponse);
        Assert.NotNull(tokenResponse.AccessToken);
        Assert.Equal("Bearer", tokenResponse.TokenType);
        Assert.True(tokenResponse.ExpiresIn > 0);

        // Verify token structure
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(tokenResponse.AccessToken);
        Assert.NotNull(token);
        Assert.Equal(ClientId, token.Claims.FirstOrDefault(c => c.Type == "client_id")?.Value);
    }

    [Fact]
    public async Task AuthorizationCodeFlow_ShouldReturn_AuthorizationCode()
    {
        // Arrange
        var state = Guid.NewGuid().ToString();
        var authUrl = $"/authorize?response_type=code&client_id={ClientId}&redirect_uri={Uri.EscapeDataString(RedirectUri)}&scope=openid profile&state={state}";

        // Act
        var response = await _httpClient!.GetAsync(authUrl);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var content = await response.Content.ReadAsStringAsync();
        
        // The response should contain a redirect with an authorization code
        Assert.Contains("code=", content);
        Assert.Contains(state, content);
    }

    [Fact]
    public async Task AuthorizationCodeExchange_ShouldReturn_AccessAndIdTokens()
    {
        // Arrange - First get an authorization code
        var state = Guid.NewGuid().ToString();
        var authUrl = $"/authorize?response_type=code&client_id={ClientId}&redirect_uri={Uri.EscapeDataString(RedirectUri)}&scope=openid profile email&state={state}";
        var authResponse = await _httpClient!.GetAsync(authUrl);
        var authContent = await authResponse.Content.ReadAsStringAsync();
        
        // Extract code from response (simplified - in real scenario you'd parse the redirect)
        var codeStart = authContent.IndexOf("code=") + 5;
        var codeEnd = authContent.IndexOf("&", codeStart);
        if (codeEnd == -1) codeEnd = authContent.IndexOf("\"", codeStart);
        var code = authContent.Substring(codeStart, codeEnd - codeStart);

        var tokenRequest = new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "code", code },
            { "client_id", ClientId },
            { "client_secret", ClientSecret },
            { "redirect_uri", RedirectUri }
        };

        // Act
        var tokenResponse = await _httpClient.PostAsync("/token", new FormUrlEncodedContent(tokenRequest));

        // Assert
        Assert.True(tokenResponse.IsSuccessStatusCode);
        var tokens = await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>();
        Assert.NotNull(tokens);
        Assert.NotNull(tokens.AccessToken);
        Assert.NotNull(tokens.IdToken);
        Assert.Equal("Bearer", tokens.TokenType);

        // Verify ID token structure
        var handler = new JwtSecurityTokenHandler();
        var idToken = handler.ReadJwtToken(tokens.IdToken);
        Assert.NotNull(idToken);
        Assert.Equal(_baseUrl, idToken.Issuer);
        Assert.Contains(idToken.Claims, c => c.Type == "sub");
    }

    [Fact]
    public async Task JwtVerification_ShouldValidate_TokenSignature()
    {
        // Arrange - Get an access token
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", ClientId },
            { "client_secret", ClientSecret }
        };

        var response = await _httpClient!.PostAsync("/token", new FormUrlEncodedContent(requestBody));
        var tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>();
        Assert.NotNull(tokenResponse?.AccessToken);

        // Get JWKS to verify signature
        var jwksResponse = await _httpClient.GetAsync("/.well-known/jwks.json");
        var jwksJson = await jwksResponse.Content.ReadAsStringAsync();
        var jwks = JsonSerializer.Deserialize<JsonWebKeySet>(jwksJson);
        Assert.NotNull(jwks);

        // Act - Validate token
        var handler = new JwtSecurityTokenHandler();
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _baseUrl,
            ValidateAudience = false, // ngauth doesn't set audience by default
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = jwks.Keys
        };

        // Assert
        var principal = handler.ValidateToken(tokenResponse.AccessToken, validationParameters, out var validatedToken);
        Assert.NotNull(principal);
        Assert.NotNull(validatedToken);
        Assert.IsType<JwtSecurityToken>(validatedToken);
    }

    [Fact]
    public async Task UserInfo_ShouldReturn_UserClaims()
    {
        // Arrange - Get access token with openid scope
        var authUrl = $"/authorize?response_type=code&client_id={ClientId}&redirect_uri={Uri.EscapeDataString(RedirectUri)}&scope=openid profile email&state=test";
        var authResponse = await _httpClient!.GetAsync(authUrl);
        var authContent = await authResponse.Content.ReadAsStringAsync();
        
        var codeStart = authContent.IndexOf("code=") + 5;
        var codeEnd = authContent.IndexOf("&", codeStart);
        if (codeEnd == -1) codeEnd = authContent.IndexOf("\"", codeStart);
        var code = authContent.Substring(codeStart, codeEnd - codeStart);

        var tokenRequest = new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "code", code },
            { "client_id", ClientId },
            { "client_secret", ClientSecret },
            { "redirect_uri", RedirectUri }
        };

        var tokenResponse = await _httpClient.PostAsync("/token", new FormUrlEncodedContent(tokenRequest));
        var tokens = await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>();
        Assert.NotNull(tokens?.AccessToken);

        // Act - Call userinfo endpoint
        var request = new HttpRequestMessage(HttpMethod.Get, "/userinfo");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        var userInfoResponse = await _httpClient.SendAsync(request);

        // Assert
        Assert.True(userInfoResponse.IsSuccessStatusCode);
        var userInfo = await userInfoResponse.Content.ReadFromJsonAsync<UserInfoResponse>();
        Assert.NotNull(userInfo);
        Assert.NotNull(userInfo.Sub);
    }

    [Fact]
    public async Task InvalidClientCredentials_ShouldReturn_Unauthorized()
    {
        // Arrange
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", "invalid-client" },
            { "client_secret", "invalid-secret" }
        };

        // Act
        var response = await _httpClient!.PostAsync("/token", new FormUrlEncodedContent(requestBody));

        // Assert
        Assert.False(response.IsSuccessStatusCode);
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredToken_ShouldFail_Validation()
    {
        // This test demonstrates how to handle token expiration
        // In a real scenario, you'd wait for expiration or manipulate the token
        
        // Arrange - Create a mock expired token (for demonstration)
        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("this-is-a-test-key-that-is-long-enough"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _baseUrl,
            claims: new[] { new Claim("sub", "test-user") },
            expires: DateTime.UtcNow.AddSeconds(-1), // Already expired
            signingCredentials: credentials
        );

        var expiredToken = handler.WriteToken(token);

        // Act & Assert
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _baseUrl,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key
        };

        await Assert.ThrowsAsync<SecurityTokenExpiredException>(async () =>
        {
            await Task.Run(() => handler.ValidateToken(expiredToken, validationParameters, out _));
        });
    }
}

// Response models
public record HealthResponse(string Status);

public record OidcConfiguration(
    string Issuer,
    string AuthorizationEndpoint,
    string TokenEndpoint,
    string? UserinfoEndpoint,
    string JwksUri,
    string[] ResponseTypesSupported,
    string[] GrantTypesSupported,
    string[] SubjectTypesSupported,
    string[] IdTokenSigningAlgValuesSupported,
    string[] ScopesSupported,
    string[] TokenEndpointAuthMethodsSupported,
    string[] ClaimsSupported
);

public record TokenResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    string? RefreshToken = null,
    string? IdToken = null,
    string? Scope = null
);

public record UserInfoResponse(
    string Sub,
    string? Name = null,
    string? Email = null,
    bool? EmailVerified = null,
    string? Picture = null
);
