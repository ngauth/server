package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	ngauthContainer testcontainers.Container
	oauthBaseURL    string
	apiBaseURL      string
	clientID        string
	clientSecret    string
	accessToken     string
)

type OAuthClient struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	ClientName   string   `json:"client_name"`
	RedirectURIs []string `json:"redirect_uris"`
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
}

type OIDCDiscovery struct {
	Issuer                string   `json:"issuer"`
	AuthorizationEndpoint string   `json:"authorization_endpoint"`
	TokenEndpoint         string   `json:"token_endpoint"`
	JWKSURI               string   `json:"jwks_uri"`
	UserinfoEndpoint      string   `json:"userinfo_endpoint"`
	GrantTypesSupported   []string `json:"grant_types_supported"`
}

type JWKSResponse struct {
	Keys []map[string]interface{} `json:"keys"`
}

func setupContainers(t *testing.T) {
	ctx := context.Background()

	// Start ngauth OAuth server
	req := testcontainers.ContainerRequest{
		Image:        "aronworks/ngauth:latest",
		ExposedPorts: []string{"3000/tcp"},
		Env: map[string]string{
			"NODE_ENV":       "development",
			"JWT_SECRET":     "test-secret-key-min-32-chars-long!",
			"SESSION_SECRET": "test-session-secret-min-32-chars!",
			"ADMIN_USERNAME": "admin",
			"ADMIN_PASSWORD": "admin123",
			// Note: NGAUTH_ISSUER defaults to http://localhost:3000
		},
		WaitingFor: wait.ForHTTP("/health/live").WithPort("3000/tcp").WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	require.NoError(t, err)

	ngauthContainer = container

	// Get mapped port
	mappedPort, err := container.MappedPort(ctx, "3000")
	require.NoError(t, err)

	host, err := container.Host(ctx)
	require.NoError(t, err)

	oauthBaseURL = fmt.Sprintf("http://%s:%s", host, mappedPort.Port())
	t.Logf("OAuth server running at: %s", oauthBaseURL)

	// Wait for server to be fully ready
	time.Sleep(2 * time.Second)

	// Register OAuth client
	client := registerClient(t)
	clientID = client.ClientID
	clientSecret = client.ClientSecret

	// Get access token
	accessToken = getAccessToken(t, "read write")

	// Set API base URL (in real tests, this would be another container)
	apiBaseURL = "http://localhost:8000"
}

func teardownContainers(t *testing.T) {
	if ngauthContainer != nil {
		ctx := context.Background()
		err := ngauthContainer.Terminate(ctx)
		if err != nil {
			t.Logf("Failed to terminate container: %v", err)
		}
	}
}

func registerClient(t *testing.T) OAuthClient {
	payload := map[string]interface{}{
		"clientName":   "Test Client",
		"redirectUris": []string{"http://localhost:8000/callback"},
		"grantTypes":   []string{"authorization_code", "client_credentials"},
		"scope":        "openid profile email read write",
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/register", oauthBaseURL),
		"application/json",
		strings.NewReader(string(body)),
	)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var client OAuthClient
	err = json.NewDecoder(resp.Body).Decode(&client)
	require.NoError(t, err)

	return client
}

func getAccessToken(t *testing.T, scope string) string {
	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("scope", scope)

	resp, err := http.Post(
		fmt.Sprintf("%s/oauth/token", oauthBaseURL),
		"application/x-www-form-urlencoded",
		strings.NewReader(data.Encode()),
	)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode)

	var tokenResp TokenResponse
	err = json.NewDecoder(resp.Body).Decode(&tokenResp)
	require.NoError(t, err)

	return tokenResp.AccessToken
}

func TestMain(m *testing.M) {
	// Note: Container setup is done in each test for better isolation
	// In production, you might want to set up once for all tests
	m.Run()
}

func TestPublicEndpoint(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	resp, err := http.Get(fmt.Sprintf("%s/api/public", apiBaseURL))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Equal(t, "This is a public endpoint", result["message"])
}

func TestProtectedEndpointWithoutAuth(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	resp, err := http.Get(fmt.Sprintf("%s/api/protected", apiBaseURL))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestProtectedEndpointWithAuth(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/protected", apiBaseURL), nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Contains(t, result, "message")
}

func TestDataGetRequiresReadScope(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/data", apiBaseURL), nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Contains(t, result, "data")
}

func TestDataPostRequiresWriteScope(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	payload := map[string]string{"name": "Test Item"}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/data", apiBaseURL), strings.NewReader(string(body)))
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Contains(t, result, "message")
	assert.Contains(t, result, "id")
}

func TestDataGetWithoutReadScope(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	// Get token with only write scope
	token := getAccessToken(t, "write")

	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/data", apiBaseURL), nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestUserinfoEndpoint(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/userinfo", apiBaseURL), nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Contains(t, result, "userId")
	assert.Contains(t, result, "claims")
}

func TestOIDCDiscovery(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	resp, err := http.Get(fmt.Sprintf("%s/.well-known/openid-configuration", oauthBaseURL))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var discovery OIDCDiscovery
	err = json.NewDecoder(resp.Body).Decode(&discovery)
	require.NoError(t, err)

	assert.Equal(t, oauthBaseURL, discovery.Issuer)
	assert.NotEmpty(t, discovery.AuthorizationEndpoint)
	assert.NotEmpty(t, discovery.TokenEndpoint)
	assert.NotEmpty(t, discovery.JWKSURI)
}

func TestJWKSEndpoint(t *testing.T) {
	setupContainers(t)
	defer teardownContainers(t)

	resp, err := http.Get(fmt.Sprintf("%s/.well-known/jwks.json", oauthBaseURL))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var jwks JWKSResponse
	err = json.Unmarshal(bodyBytes, &jwks)
	require.NoError(t, err)

	assert.NotEmpty(t, jwks.Keys)
	assert.Equal(t, "RSA", jwks.Keys[0]["kty"])
}
