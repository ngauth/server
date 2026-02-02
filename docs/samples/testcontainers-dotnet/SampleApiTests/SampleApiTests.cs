using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Xunit;

namespace SampleApiTests;

/// <summary>
/// Shared fixture for OAuth container and API factory - initialized once per test class
/// </summary>
public class SampleApiFixture : IAsyncLifetime
{
    public IContainer OAuthContainer { get; private set; } = null!;
    public string OAuthBaseUrl { get; private set; } = string.Empty;
    public HttpClient OAuthClient { get; private set; } = null!;
    public WebApplicationFactory<Program> ApiFactory { get; private set; } = null!;
    public HttpClient ApiClient { get; private set; } = null!;
    public string ClientId { get; private set; } = string.Empty;
    public string ClientSecret { get; private set; } = string.Empty;
    public string RedirectUri { get; private set; } = "http://localhost:3000/callback";
    public OidcDiscoveryDocument? Discovery { get; private set; }

    public async Task InitializeAsync()
    {
        Console.WriteLine("[Fixture] Initializing OAuth container and API...");
        
        // Use fixed port binding so we can set NGAUTH_ISSUER before container starts
        OAuthBaseUrl = "http://localhost:3000";
        
        // Start OAuth container with Entra ID preset
        OAuthContainer = new ContainerBuilder()
            .WithImage("ngauth/server:1.0.0-alpha")
            .WithPortBinding(3000, 3000)  // Fixed port binding
            .WithEnvironment("NODE_ENV", "test")
            .WithEnvironment("NGAUTH_PRESET", "entraid")
            .WithEnvironment("NGAUTH_ISSUER", OAuthBaseUrl)  // Set issuer explicitly
            .WithWaitStrategy(Wait.ForUnixContainer()
                .UntilHttpRequestIsSucceeded(r => r
                    .ForPort(3000)
                    .ForPath("/health/ready")))
            .Build();

        await OAuthContainer.StartAsync();
        
        OAuthClient = new HttpClient { BaseAddress = new Uri(OAuthBaseUrl) };
        
        Console.WriteLine($"[Fixture] OAuth container started at {OAuthBaseUrl}");
        
        // Verify health
        var healthResponse = await OAuthClient.GetAsync("/health/ready");
        Console.WriteLine($"[Fixture] Health check: {healthResponse.StatusCode}");
        
        // Discover OIDC endpoints from discovery document
        // Using Entra ID preset, so discovery is at /v2.0/.well-known/openid-configuration
        var discoveryResponse = await OAuthClient.GetAsync("/v2.0/.well-known/openid-configuration");
        discoveryResponse.EnsureSuccessStatusCode();
        Discovery = await discoveryResponse.Content.ReadFromJsonAsync<OidcDiscoveryDocument>();
        
        Console.WriteLine($"[Fixture] OIDC Discovery:");
        Console.WriteLine($"  Issuer: {Discovery!.Issuer}");
        Console.WriteLine($"  Authorization Endpoint: {Discovery.AuthorizationEndpoint}");
        Console.WriteLine($"  Token Endpoint: {Discovery.TokenEndpoint}");
        Console.WriteLine($"  JWKS URI: {Discovery.JwksUri}");
        
        // Register a test client
        var registerRequest = new
        {
            client_name = "Test Client",
            redirect_uris = new[] { RedirectUri },
            grant_types = new[] { "client_credentials", "authorization_code" },
            response_types = new[] { "code" },
            token_endpoint_auth_method = "client_secret_post",
            scope = "read write"
        };

        var registerResponse = await OAuthClient.PostAsJsonAsync("/register", registerRequest);
        var clientInfo = await registerResponse.Content.ReadFromJsonAsync<ClientRegistrationResponse>();
        
        ClientId = clientInfo!.ClientId;
        ClientSecret = clientInfo.ClientSecret;
        
        Console.WriteLine($"[Fixture] Registered client: {ClientId}");
        
        // Create API factory with OAuth configuration
        ApiFactory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureAppConfiguration((context, config) =>
                {
                    // Configure the API to use our OAuth server
                    // Microsoft.Identity.Web expects Authority to include /v2.0 for Entra ID
                    // It will append /.well-known/openid-configuration to fetch metadata
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Authentication:Authority"] = $"{OAuthBaseUrl}/v2.0",
                        ["Authentication:ClientId"] = "api://default",  // Required by Microsoft.Identity.Web
                        ["Authentication:ValidateIssuer"] = "false",
                        ["Urls"] = "http://localhost:5000"  // Use different port for API
                    });
                });
            });

        ApiClient = ApiFactory.CreateClient();
        
        Console.WriteLine("[Fixture] Initialization complete");
    }

    public async Task DisposeAsync()
    {
        Console.WriteLine("[Fixture] Disposing resources...");
        ApiClient?.Dispose();
        ApiFactory?.Dispose();
        OAuthClient?.Dispose();
        
        if (OAuthContainer != null)
        {
            await OAuthContainer.StopAsync();
            await OAuthContainer.DisposeAsync();
        }
    }
}

public class SampleApiTests : IClassFixture<SampleApiFixture>
{
    private readonly SampleApiFixture _fixture;
    private HttpClient _apiClient => _fixture.ApiClient;
    private HttpClient _oauthClient => _fixture.OAuthClient;
    private string _clientId => _fixture.ClientId;
    private string _clientSecret => _fixture.ClientSecret;

    public SampleApiTests(SampleApiFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task PublicEndpoint_ShouldReturn200_WithoutAuthentication()
    {
        // Act
        var response = await _apiClient.GetAsync("/api/public");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<MessageResponse>();
        Assert.Equal("This is a public endpoint", result!.Message);
    }

    [Fact]
    public async Task ProtectedEndpoint_ShouldReturn401_WithoutToken()
    {
        // Act
        var response = await _apiClient.GetAsync("/api/protected");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ScopeProtectedEndpoint_ShouldReturn401_WithoutRequiredScope()
    {
        // Arrange - Get token without 'read' scope
        var token = await GetClientCredentialsToken("");

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/data");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _apiClient.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WriteEndpoint_ShouldReturn401_WithoutWriteScope()
    {
        // Arrange - Get token with only 'read' scope
        // Note: Since ngauth currently uses 'scope' claim instead of 'scp' (Entra ID claim name),
        // Microsoft.Identity.Web won't recognize any scopes and will return 401 instead of 403
        var token = await GetClientCredentialsToken("read");

        // Act
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/data");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { Name = "Test Item" });
        var response = await _apiClient.SendAsync(request);

        // Assert
        // Currently returns 401 because scopes are in 'scope' claim, not 'scp' claim
        // Once claim mapping is implemented in ngauth, this should return 403
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Helper method to get client credentials token
    private async Task<string> GetClientCredentialsToken(string scope)
    {
        // Use token endpoint from OIDC discovery (best practice)
        var tokenEndpoint = _fixture.Discovery!.TokenEndpoint;
        
        var requestBody = new Dictionary<string, string>
        {
            { "grant_type", "client_credentials" },
            { "client_id", _clientId },
            { "client_secret", _clientSecret }
        };

        if (!string.IsNullOrEmpty(scope))
        {
            requestBody["scope"] = scope;
        }

        // Use absolute URI from discovery document
        var httpClient = new HttpClient();
        var response = await httpClient.PostAsync(tokenEndpoint, new FormUrlEncodedContent(requestBody));
        var tokenResponse = await response.Content.ReadFromJsonAsync<OAuthTokenResponse>();
        return tokenResponse!.AccessToken;
    }
}

// Response models
public record MessageResponse(
    [property: JsonPropertyName("message")] string Message
);

public record ClientRegistrationResponse(
    [property: JsonPropertyName("client_id")] string ClientId,
    [property: JsonPropertyName("client_secret")] string ClientSecret,
    [property: JsonPropertyName("client_name")] string ClientName
);

public record OAuthTokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("token_type")] string TokenType,
    [property: JsonPropertyName("expires_in")] int ExpiresIn
);

public record OidcDiscoveryDocument(
    [property: JsonPropertyName("issuer")] string Issuer,
    [property: JsonPropertyName("authorization_endpoint")] string AuthorizationEndpoint,
    [property: JsonPropertyName("token_endpoint")] string TokenEndpoint,
    [property: JsonPropertyName("jwks_uri")] string JwksUri,
    [property: JsonPropertyName("userinfo_endpoint")] string? UserinfoEndpoint,
    [property: JsonPropertyName("end_session_endpoint")] string? EndSessionEndpoint,
    [property: JsonPropertyName("response_types_supported")] string[]? ResponseTypesSupported,
    [property: JsonPropertyName("subject_types_supported")] string[]? SubjectTypesSupported,
    [property: JsonPropertyName("id_token_signing_alg_values_supported")] string[]? IdTokenSigningAlgValuesSupported,
    [property: JsonPropertyName("scopes_supported")] string[]? ScopesSupported
);
