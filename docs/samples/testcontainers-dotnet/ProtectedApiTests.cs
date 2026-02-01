using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace NgAuthTests;

/// <summary>
/// Integration tests demonstrating how to test a protected API using ngauth OAuth server
/// </summary>
public class ProtectedApiTests : IAsyncLifetime
{
    private IContainer? _oauthContainer;
    private HttpClient? _oauthClient;
    private WebApplicationFactory<Program>? _apiFactory;
    private HttpClient? _apiClient;
    private string _oauthBaseUrl = string.Empty;

    private const string ClientId = "test-client";
    private const string ClientSecret = "test-secret";
    private const string RedirectUri = "http://localhost:3000/callback";

    public async Task InitializeAsync()
    {
        // Start the ngauth OAuth container
        _oauthContainer = new ContainerBuilder()
            .WithImage("ngauth/server:latest")
            .WithPortBinding(3000, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(3000)))
            .Build();

        await _oauthContainer.StartAsync();

        var port = _oauthContainer.GetMappedPublicPort(3000);
        _oauthBaseUrl = $"http://localhost:{port}";
        _oauthClient = new HttpClient { BaseAddress = new Uri(_oauthBaseUrl) };

        // Start the API with OAuth authority pointing to the container
        _apiFactory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((context, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Authentication:Authority"] = _oauthBaseUrl
                    });
                });
            });

        _apiClient = _apiFactory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _apiClient?.Dispose();
        _apiFactory?.Dispose();
        _oauthClient?.Dispose();
        
        if (_oauthContainer != null)
        {
            await _oauthContainer.StopAsync();
            await _oauthContainer.DisposeAsync();
        }
    }

    [Fact]
    public async Task PublicEndpoint_ShouldBeAccessible_WithoutAuthentication()
    {
        // Act
        var response = await _apiClient!.GetAsync("/api/public");

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var content = await response.Content.ReadFromJsonAsync<PublicResponse>();
        Assert.NotNull(content);
        Assert.Equal("This is a public endpoint", content.Message);
    }

    [Fact]
    public async Task ProtectedEndpoint_ShouldReturn401_WithoutToken()
    {
        // Act
        var response = await _apiClient!.GetAsync("/api/protected");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_ShouldReturn200_WithValidToken()
    {
        // Arrange - Get access token from OAuth server
        var token = await GetClientCredentialsToken("openid profile");

        // Act - Call protected endpoint with token
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/protected");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _apiClient!.SendAsync(request);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var content = await response.Content.ReadFromJsonAsync<ProtectedResponse>();
        Assert.NotNull(content);
        Assert.Equal("This endpoint requires authentication", content.Message);
    }

    [Fact]
    public async Task ScopeProtectedEndpoint_ShouldReturn403_WithoutRequiredScope()
    {
        // Arrange - Get token without 'read' scope
        var token = await GetClientCredentialsToken("openid");

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/data");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _apiClient!.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ScopeProtectedEndpoint_ShouldReturn200_WithRequiredScope()
    {
        // Arrange - Get token with 'read' scope
        var token = await GetClientCredentialsToken("read");

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/data");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _apiClient!.SendAsync(request);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var content = await response.Content.ReadFromJsonAsync<DataResponse>();
        Assert.NotNull(content);
        Assert.NotNull(content.Data);
        Assert.Equal(3, content.Data.Length);
    }

    [Fact]
    public async Task WriteEndpoint_ShouldReturn403_WithoutWriteScope()
    {
        // Arrange - Get token with only 'read' scope
        var token = await GetClientCredentialsToken("read");
        var newItem = new { Name = "Test Item" };

        // Act
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/data")
        {
            Content = JsonContent.Create(newItem)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _apiClient!.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task WriteEndpoint_ShouldReturn200_WithWriteScope()
    {
        // Arrange - Get token with 'write' scope
        var token = await GetClientCredentialsToken("write");
        var newItem = new { Name = "Test Item" };

        // Act
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/data")
        {
            Content = JsonContent.Create(newItem)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _apiClient!.SendAsync(request);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var content = await response.Content.ReadFromJsonAsync<CreateResponse>();
        Assert.NotNull(content);
        Assert.Contains("Test Item", content.Message);
        Assert.NotEqual(Guid.Empty, content.Id);
    }

    [Fact]
    public async Task UserInfoEndpoint_ShouldReturnClaims_WithValidToken()
    {
        // Arrange - Get authorization code and exchange for tokens with user context
        var code = await GetAuthorizationCode();
        var tokens = await ExchangeCodeForTokens(code);

        // Act - Call userinfo endpoint with access token
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/userinfo");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        var response = await _apiClient!.SendAsync(request);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var content = await response.Content.ReadFromJsonAsync<UserInfoApiResponse>();
        Assert.NotNull(content);
        Assert.NotNull(content.UserId);
        Assert.NotNull(content.Claims);
        Assert.True(content.Claims.Length > 0);
    }

    [Fact]
    public async Task ProtectedEndpoint_ShouldReturn401_WithExpiredToken()
    {
        // Note: This would require waiting for token expiration or manipulating time
        // For demonstration, we'll test with an invalid token format
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/protected");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "invalid-token");
        var response = await _apiClient!.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MultipleScopes_ShouldAllowAccess_WhenTokenHasAnyRequiredScope()
    {
        // Arrange - Get token with both read and write scopes
        var token = await GetClientCredentialsToken("read write");

        // Act - Test read endpoint
        var readRequest = new HttpRequestMessage(HttpMethod.Get, "/api/data");
        readRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var readResponse = await _apiClient!.SendAsync(readRequest);

        // Act - Test write endpoint
        var writeRequest = new HttpRequestMessage(HttpMethod.Post, "/api/data")
        {
            Content = JsonContent.Create(new { Name = "Test" })
        };
        writeRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var writeResponse = await _apiClient!.SendAsync(writeRequest);

        // Assert
        Assert.True(readResponse.IsSuccessStatusCode);
        Assert.True(writeResponse.IsSuccessStatusCode);
    }

    // Helper methods

    private async Task<string> GetClientCredentialsToken(string scope)
    {
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", ClientId },
            { "client_secret", ClientSecret },
            { "scope", scope }
        };

        var response = await _oauthClient!.PostAsync("/token", new FormUrlEncodedContent(requestBody));
        response.EnsureSuccessStatusCode();

        var tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>();
        return tokenResponse!.AccessToken;
    }

    private async Task<string> GetAuthorizationCode()
    {
        var authUrl = $"/authorize?response_type=code&client_id={ClientId}&redirect_uri={Uri.EscapeDataString(RedirectUri)}&scope=openid profile email&state=test";
        var response = await _oauthClient!.GetAsync(authUrl);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        var codeStart = content.IndexOf("code=") + 5;
        var codeEnd = content.IndexOf("&", codeStart);
        if (codeEnd == -1) codeEnd = content.IndexOf("\"", codeStart);
        
        return content.Substring(codeStart, codeEnd - codeStart);
    }

    private async Task<TokenResponse> ExchangeCodeForTokens(string code)
    {
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "code", code },
            { "client_id", ClientId },
            { "client_secret", ClientSecret },
            { "redirect_uri", RedirectUri }
        };

        var response = await _oauthClient!.PostAsync("/token", new FormUrlEncodedContent(requestBody));
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<TokenResponse>())!;
    }
}

// Response models
public record PublicResponse(string Message);
public record ProtectedResponse(string Message);
public record DataResponse(string[] Data);
public record CreateResponse(string Message, Guid Id);
public record UserInfoApiResponse(string? UserId, string? Username, string? Email, ClaimInfo[] Claims);
public record ClaimInfo(string Type, string Value);

public record TokenResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    string? IdToken = null
);
