# ngauth Testcontainers Guide

Complete guide for using **ngauth** with [Testcontainers](https://testcontainers.com/) for integration testing across multiple programming languages.

---

## Table of Contents

- [Overview](#overview)
- [Why Use Testcontainers with ngauth?](#why-use-testcontainers-with-ngauth)
- [Language Examples](#language-examples)
  - [Node.js / JavaScript / TypeScript](#nodejs--javascript--typescript)
  - [Java](#java)
  - [Python](#python)
  - [Go](#go)
  - [.NET / C#](#net--c)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

Testcontainers is a library that provides lightweight, throwaway instances of Docker containers for integration testing. Combined with **ngauth**, you get a fully functional OAuth 2.0 / OpenID Connect server that:

- ✅ Starts fresh for each test suite
- ✅ Runs in complete isolation
- ✅ Provides predictable, consistent behavior
- ✅ Cleans up automatically after tests
- ✅ Works in CI/CD environments
- ✅ Requires zero manual setup

---

## Why Use Testcontainers with ngauth?

### Traditional Approach Problems
- **Shared Test Server**: State pollution between test runs
- **Manual Setup**: Requires developers to run services locally
- **CI/CD Complexity**: Need to configure external services
- **Flaky Tests**: Shared state causes intermittent failures
- **Slow Feedback**: Waiting for shared resources

### Testcontainers + ngauth Solution
- **Isolated Tests**: Each test suite gets fresh container
- **Zero Setup**: Developers just run tests, containers start automatically
- **CI/CD Ready**: Works anywhere Docker is available
- **Reliable**: Clean state guarantees consistent results
- **Fast**: Containers start in < 3 seconds

---

## Language Examples

### Node.js / JavaScript / TypeScript

#### Installation

```bash
npm install --save-dev testcontainers
# or
yarn add --dev testcontainers
```

#### Basic Example (Jest)

```javascript
const { GenericContainer } = require('testcontainers');
const axios = require('axios');

describe('OAuth Integration Tests', () => {
  let container;
  let serverUrl;

  beforeAll(async () => {
    // Start ngauth container
    container = await new GenericContainer('ngauth/server:latest')
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp('/health', 3000))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3000);
    serverUrl = `http://${host}:${port}`;
  }, 60000); // Timeout for container startup

  afterAll(async () => {
    await container.stop();
  });

  test('should obtain access token using client credentials', async () => {
    const response = await axios.post(`${serverUrl}/token`, 
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'test-client',
        client_secret: 'test-secret'
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('access_token');
    expect(response.data.token_type).toBe('Bearer');
  });

  test('should get user info with valid token', async () => {
    // First get a token
    const tokenResponse = await axios.post(`${serverUrl}/token`, 
      new URLSearchParams({
        grant_type: 'password',
        username: 'testuser',
        password: 'password123',
        client_id: 'test-client',
        client_secret: 'test-secret'
      })
    );

    const accessToken = tokenResponse.data.access_token;

    // Then get user info
    const userInfoResponse = await axios.get(`${serverUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    expect(userInfoResponse.status).toBe(200);
    expect(userInfoResponse.data).toHaveProperty('sub');
    expect(userInfoResponse.data).toHaveProperty('email');
  });
});
```

#### TypeScript Example

```typescript
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import axios from 'axios';

describe('OAuth Integration Tests', () => {
  let container: StartedTestContainer;
  let serverUrl: string;

  beforeAll(async () => {
    container = await new GenericContainer('ngauth/server:latest')
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp('/health', 3000))
      .start();

    serverUrl = `http://${container.getHost()}:${container.getMappedPort(3000)}`;
  }, 60000);

  afterAll(async () => {
    await container.stop();
  });

  it('should verify OIDC discovery endpoint', async () => {
    const response = await axios.get(`${serverUrl}/.well-known/openid-configuration`);
    
    expect(response.status).toBe(200);
    expect(response.data.issuer).toBe(serverUrl);
    expect(response.data.authorization_endpoint).toBe(`${serverUrl}/authorize`);
    expect(response.data.token_endpoint).toBe(`${serverUrl}/token`);
    expect(response.data.jwks_uri).toBe(`${serverUrl}/.well-known/jwks.json`);
  });
});
```

---

### Java

#### Installation (Maven)

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers</artifactId>
    <version>1.19.3</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>1.19.3</version>
    <scope>test</scope>
</dependency>
```

#### Installation (Gradle)

```gradle
testImplementation 'org.testcontainers:testcontainers:1.19.3'
testImplementation 'org.testcontainers:junit-jupiter:1.19.3'
```

#### Example Test (JUnit 5)

```java
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class OAuthIntegrationTest {

    @Container
    private static final GenericContainer<?> ngauthContainer = new GenericContainer<>("ngauth/server:latest")
            .withExposedPorts(3000)
            .waitingFor(Wait.forHttp("/health").forPort(3000));

    private String getServerUrl() {
        return "http://" + ngauthContainer.getHost() + ":" + ngauthContainer.getMappedPort(3000);
    }

    @Test
    void shouldObtainAccessTokenWithClientCredentials() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        
        String requestBody = "grant_type=client_credentials" +
                "&client_id=test-client" +
                "&client_secret=test-secret";
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(getServerUrl() + "/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
        
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("access_token"));
        assertTrue(response.body().contains("token_type"));
    }

    @Test
    void shouldVerifyOIDCDiscovery() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(getServerUrl() + "/.well-known/openid-configuration"))
                .GET()
                .build();
        
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("authorization_endpoint"));
        assertTrue(response.body().contains("token_endpoint"));
        assertTrue(response.body().contains("jwks_uri"));
    }
}
```

---

### Python

#### Installation

```bash
pip install testcontainers requests pytest
```

#### Example Test (pytest)

```python
import pytest
import requests
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

@pytest.fixture(scope="module")
def ngauth_container():
    """Fixture to start ngauth container for tests."""
    container = DockerContainer("ngauth/server:latest")
    container.with_exposed_ports(3000)
    container.start()
    
    # Wait for container to be ready
    wait_for_logs(container, "Server running", timeout=30)
    
    yield container
    
    container.stop()

@pytest.fixture(scope="module")
def server_url(ngauth_container):
    """Get the server URL from container."""
    host = ngauth_container.get_container_host_ip()
    port = ngauth_container.get_exposed_port(3000)
    return f"http://{host}:{port}"

def test_client_credentials_flow(server_url):
    """Test OAuth 2.0 client credentials flow."""
    response = requests.post(
        f"{server_url}/token",
        data={
            "grant_type": "client_credentials",
            "client_id": "test-client",
            "client_secret": "test-secret"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "Bearer"
    assert "expires_in" in data

def test_password_grant_flow(server_url):
    """Test OAuth 2.0 password grant flow."""
    response = requests.post(
        f"{server_url}/token",
        data={
            "grant_type": "password",
            "username": "testuser",
            "password": "password123",
            "client_id": "test-client",
            "client_secret": "test-secret"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_userinfo_endpoint(server_url):
    """Test OIDC UserInfo endpoint."""
    # First get a token
    token_response = requests.post(
        f"{server_url}/token",
        data={
            "grant_type": "password",
            "username": "testuser",
            "password": "password123",
            "client_id": "test-client",
            "client_secret": "test-secret"
        }
    )
    access_token = token_response.json()["access_token"]
    
    # Then get user info
    userinfo_response = requests.get(
        f"{server_url}/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    assert userinfo_response.status_code == 200
    data = userinfo_response.json()
    assert "sub" in data
    assert "email" in data

def test_oidc_discovery(server_url):
    """Test OIDC discovery endpoint."""
    response = requests.get(f"{server_url}/.well-known/openid-configuration")
    
    assert response.status_code == 200
    data = response.json()
    assert data["issuer"] == server_url
    assert "authorization_endpoint" in data
    assert "token_endpoint" in data
    assert "jwks_uri" in data
```

---

### Go

#### Installation

```bash
go get github.com/testcontainers/testcontainers-go
```

#### Example Test

```go
package oauth_test

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "strings"
    "testing"
    "time"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/wait"
)

func setupNgauthContainer(t *testing.T) (string, func()) {
    ctx := context.Background()
    
    req := testcontainers.ContainerRequest{
        Image:        "ngauth/server:latest",
        ExposedPorts: []string{"3000/tcp"},
        WaitingFor:   wait.ForHTTP("/health").WithPort("3000/tcp"),
    }
    
    container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: req,
        Started:          true,
    })
    if err != nil {
        t.Fatal(err)
    }
    
    host, err := container.Host(ctx)
    if err != nil {
        t.Fatal(err)
    }
    
    port, err := container.MappedPort(ctx, "3000")
    if err != nil {
        t.Fatal(err)
    }
    
    serverURL := fmt.Sprintf("http://%s:%s", host, port.Port())
    
    cleanup := func() {
        container.Terminate(ctx)
    }
    
    return serverURL, cleanup
}

func TestClientCredentialsFlow(t *testing.T) {
    serverURL, cleanup := setupNgauthContainer(t)
    defer cleanup()
    
    data := url.Values{}
    data.Set("grant_type", "client_credentials")
    data.Set("client_id", "test-client")
    data.Set("client_secret", "test-secret")
    
    resp, err := http.Post(
        serverURL+"/token",
        "application/x-www-form-urlencoded",
        strings.NewReader(data.Encode()),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        t.Fatalf("Expected 200, got %d", resp.StatusCode)
    }
    
    var result map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        t.Fatal(err)
    }
    
    if _, ok := result["access_token"]; !ok {
        t.Error("Expected access_token in response")
    }
    
    if tokenType, ok := result["token_type"].(string); !ok || tokenType != "Bearer" {
        t.Error("Expected token_type to be Bearer")
    }
}

func TestOIDCDiscovery(t *testing.T) {
    serverURL, cleanup := setupNgauthContainer(t)
    defer cleanup()
    
    resp, err := http.Get(serverURL + "/.well-known/openid-configuration")
    if err != nil {
        t.Fatal(err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        t.Fatalf("Expected 200, got %d", resp.StatusCode)
    }
    
    var discovery map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&discovery); err != nil {
        t.Fatal(err)
    }
    
    if discovery["issuer"] != serverURL {
        t.Errorf("Expected issuer %s, got %s", serverURL, discovery["issuer"])
    }
    
    requiredFields := []string{"authorization_endpoint", "token_endpoint", "jwks_uri"}
    for _, field := range requiredFields {
        if _, ok := discovery[field]; !ok {
            t.Errorf("Missing required field: %s", field)
        }
    }
}
```

---

### .NET / C#

#### Installation

```bash
dotnet add package Testcontainers --version 3.6.0
```

#### Example Test (xUnit)

```csharp
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Xunit;

namespace OAuthIntegrationTests
{
    public class NgauthTests : IAsyncLifetime
    {
        private IContainer _container;
        private HttpClient _httpClient;
        private string _serverUrl;

        public async Task InitializeAsync()
        {
            _container = new ContainerBuilder()
                .WithImage("ngauth/server:latest")
                .WithPortBinding(3000, true)
                .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(3000).ForPath("/health")))
                .Build();

            await _container.StartAsync();

            var host = _container.Hostname;
            var port = _container.GetMappedPublicPort(3000);
            _serverUrl = $"http://{host}:{port}";

            _httpClient = new HttpClient();
        }

        public async Task DisposeAsync()
        {
            _httpClient?.Dispose();
            await _container.StopAsync();
        }

        [Fact]
        public async Task ShouldObtainAccessTokenWithClientCredentials()
        {
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "client_credentials"),
                new KeyValuePair<string, string>("client_id", "test-client"),
                new KeyValuePair<string, string>("client_secret", "test-secret")
            });

            var response = await _httpClient.PostAsync($"{_serverUrl}/token", content);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();
            var tokenResponse = JsonSerializer.Deserialize<TokenResponse>(responseBody);

            Assert.NotNull(tokenResponse.AccessToken);
            Assert.Equal("Bearer", tokenResponse.TokenType);
        }

        [Fact]
        public async Task ShouldVerifyOIDCDiscovery()
        {
            var response = await _httpClient.GetAsync($"{_serverUrl}/.well-known/openid-configuration");
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();
            var discovery = JsonSerializer.Deserialize<DiscoveryDocument>(responseBody);

            Assert.Equal(_serverUrl, discovery.Issuer);
            Assert.NotNull(discovery.AuthorizationEndpoint);
            Assert.NotNull(discovery.TokenEndpoint);
            Assert.NotNull(discovery.JwksUri);
        }

        private class TokenResponse
        {
            [JsonPropertyName("access_token")]
            public string AccessToken { get; set; }

            [JsonPropertyName("token_type")]
            public string TokenType { get; set; }

            [JsonPropertyName("expires_in")]
            public int ExpiresIn { get; set; }
        }

        private class DiscoveryDocument
        {
            [JsonPropertyName("issuer")]
            public string Issuer { get; set; }

            [JsonPropertyName("authorization_endpoint")]
            public string AuthorizationEndpoint { get; set; }

            [JsonPropertyName("token_endpoint")]
            public string TokenEndpoint { get; set; }

            [JsonPropertyName("jwks_uri")]
            public string JwksUri { get; set; }
        }
    }
}
```

---

## Common Patterns

### Pattern 1: Reusable Container Fixture

Instead of starting a container for every test, start once per test suite:

```javascript
// Node.js example
let globalContainer;
let globalServerUrl;

beforeAll(async () => {
  globalContainer = await new GenericContainer('ngauth/server')
    .withExposedPorts(3000)
    .start();
  globalServerUrl = `http://${globalContainer.getHost()}:${globalContainer.getMappedPort(3000)}`;
}, 60000);

afterAll(async () => {
  await globalContainer.stop();
});
```

### Pattern 2: Custom Test Data

Override default data by mounting custom files:

```javascript
const container = await new GenericContainer('ngauth/server')
  .withExposedPorts(3000)
  .withBindMounts([{
    source: path.join(__dirname, 'fixtures/custom-users.json'),
    target: '/app/data/users.json'
  }])
  .start();
```

### Pattern 3: Network Integration

Test with multiple containers (e.g., your app + ngauth):

```javascript
const network = await new Network().start();

const ngauth = await new GenericContainer('ngauth/server')
  .withNetwork(network)
  .withNetworkAliases('oauth')
  .withExposedPorts(3000)
  .start();

const myApp = await new GenericContainer('my-app')
  .withNetwork(network)
  .withEnvironment({
    OAUTH_URL: 'http://oauth:3000'
  })
  .start();
```

### Pattern 4: Wait for Health

Ensure container is ready before tests:

```javascript
const container = await new GenericContainer('ngauth/server')
  .withExposedPorts(3000)
  .withWaitStrategy(Wait.forHealthCheck())
  // or
  .withWaitStrategy(Wait.forHttp('/health', 3000))
  .start();
```

---

## Troubleshooting

### Container Fails to Start

**Problem:** Container exits immediately or fails health check

**Solutions:**
1. Check Docker daemon is running: `docker ps`
2. Verify image is available: `docker pull ngauth/server:latest`
3. Check port conflicts: `lsof -i :3000`
4. Increase timeout in test configuration
5. Check container logs: `container.logs()`

### Tests are Slow

**Problem:** Tests take too long to run

**Solutions:**
1. Reuse container across tests (use `beforeAll`/`afterAll`)
2. Pull image before running tests: `docker pull ngauth/server:latest`
3. Use smaller timeout values where appropriate
4. Run tests in parallel (be careful with shared state)

### Port Binding Issues

**Problem:** "Port already in use" error

**Solutions:**
1. Don't specify host port, let Testcontainers assign random port:
   ```javascript
   .withExposedPorts(3000) // Good
   // NOT: .withPortBindings(3000, 3000) // Bad - fixed port
   ```
2. Use `getMappedPort()` to get the assigned port
3. Clean up containers from previous test runs

### CI/CD Issues

**Problem:** Tests fail in CI but work locally

**Solutions:**
1. Ensure Docker-in-Docker or Docker socket is available
2. Pull images explicitly in CI pipeline
3. Increase timeouts for slower CI environments
4. Check CI has sufficient resources (memory, disk)
5. Verify network access to Docker Hub

### Network Issues

**Problem:** Cannot connect to container from tests

**Solutions:**
1. Use `container.getHost()` and `container.getMappedPort()` instead of hardcoded values
2. Wait for container to be fully ready before running tests
3. Check firewall rules in CI/CD environment
4. Verify Docker network mode (bridge vs host)

---

## FAQ

### Q: How long does it take to start ngauth container?

**A:** Typically 2-3 seconds after image is pulled. First pull takes ~30 seconds depending on connection.

### Q: Can I use this in CI/CD?

**A:** Yes! Works great in GitHub Actions, GitLab CI, Jenkins, etc. Just ensure Docker is available.

### Q: Do I need to clean up containers manually?

**A:** No, Testcontainers automatically removes containers after tests complete.

### Q: Can I run multiple containers in parallel?

**A:** Yes, Testcontainers assigns random ports to avoid conflicts. Perfect for parallel test execution.

### Q: How do I customize test users/clients?

**A:** Mount custom JSON files as volumes, or use the `/users` and `/register` endpoints to create data programmatically.

### Q: Does this work offline?

**A:** Yes, once the image is pulled (`docker pull ngauth/server:latest`), it works completely offline.

### Q: What's the difference between GenericContainer and a custom module?

**A:** GenericContainer works for any Docker image. Custom modules provide language-specific helpers. ngauth works great with GenericContainer.

### Q: How do I debug container issues?

**A:** Use `container.logs()` to view container logs, or `docker ps -a` to inspect container state.

### Q: Can I use this for load testing?

**A:** ngauth is optimized for functional testing, not load testing. For load tests, use a production OAuth server.

### Q: What if I need a specific version?

**A:** Specify version in image tag: `new GenericContainer('ngauth/server:1.0.0')`

---

## Additional Resources

- [Testcontainers Official Documentation](https://testcontainers.com/)
- [ngauth GitHub Repository](https://github.com/ngauth/server)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

---

## Need Help?

- 📫 [Open an issue](https://github.com/ngauth/server/issues)
- 💬 [GitHub Discussions](https://github.com/ngauth/server/discussions)
- 📖 [Full Documentation](../README.md)

---

<div align="center">

**Happy Testing!** 🧪

</div>
