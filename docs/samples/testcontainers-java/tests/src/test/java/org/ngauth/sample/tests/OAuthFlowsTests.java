package org.ngauth.sample.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OAuthFlowsTests {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String PRESET = "cognito";

  @Container
  static final GenericContainer<?> NGAUTH = new GenericContainer<>("ngauth/server:1.0.0-alpha")
    .withEnv("NGAUTH_PRESET", PRESET)
    .withExposedPorts(3000)
    .waitingFor(Wait.forHttp("/health/ready").forStatusCode(200))
    .withStartupTimeout(Duration.ofSeconds(60));

  private String baseUrl() {
    return "http://" + NGAUTH.getHost() + ":" + NGAUTH.getMappedPort(3000);
  }

  @Test
  void containerHealthCheck() throws Exception {
    Map<String, Object> discovery = discovery();
    String issuer = discovery.get("issuer").toString();
    assertTrue(
      issuer.equals(baseUrl()) || issuer.equals("http://localhost:3000"),
      "Unexpected issuer: " + issuer
    );
    assertNotNull(discovery.get("authorization_endpoint"));
    assertNotNull(discovery.get("token_endpoint"));
  }

  @Test
  void clientCredentialsFlow() throws Exception {
    Map<String, String> client = registerClient("Client Credentials", List.of("http://localhost/callback"));
    Map<String, Object> discovery = discovery();

    String tokenEndpoint = discovery.get("token_endpoint").toString();
    System.out.println("Token Endpoint: " + tokenEndpoint);
    String body = formBody(Map.of(
      "grant_type", "client_credentials",
      "scope", "read write openid"
    ));

    HttpResponse<String> response = postForm(tokenEndpoint, body, basicAuth(client));
    System.out.println("Token Response Status: " + response.statusCode());
    System.out.println("Token Response Body: " + response.body());
    assertEquals(200, response.statusCode());

    Map<String, Object> payload = json(response);
    assertNotNull(payload.get("access_token"));
    assertEquals("Bearer", payload.get("token_type"));
  }

  @Test
  void clientCredentialsWithScopes() throws Exception {
    Map<String, String> client = registerClient("Scoped Client", List.of("http://localhost/callback"));
    Map<String, Object> discovery = discovery();

    String tokenEndpoint = discovery.get("token_endpoint").toString();

    String body = formBody(Map.of(
      "grant_type", "client_credentials",
      "scope", "read write openid profile"
    ));

    HttpResponse<String> response = postForm(tokenEndpoint, body, basicAuth(client));
    assertEquals(200, response.statusCode());

    Map<String, Object> payload = json(response);
    assertNotNull(payload.get("access_token"));
    assertEquals("Bearer", payload.get("token_type"));
  }

  @Test
  void jwksTokenVerification() throws Exception {
    Map<String, String> client = registerClient("JWKS", List.of("http://localhost/callback"));
    Map<String, Object> discovery = discovery();

    String tokenEndpoint = discovery.get("token_endpoint").toString();
    String jwksUri = discovery.get("jwks_uri").toString();

    String body = formBody(Map.of(
      "grant_type", "client_credentials",
      "scope", "openid"
    ));

    HttpResponse<String> response = postForm(tokenEndpoint, body, basicAuth(client));
    Map<String, Object> payload = json(response);
    String accessToken = payload.get("access_token").toString();

    String jwksJson = get(jwksUri).body();
    JWKSet jwkSet = JWKSet.parse(jwksJson);
    SignedJWT signedJWT = SignedJWT.parse(accessToken);
    String kid = signedJWT.getHeader().getKeyID();

    JWK jwk = jwkSet.getKeyByKeyId(kid);
    RSAKey rsaKey = (RSAKey) jwk;
    JWSVerifier verifier = new RSASSAVerifier(rsaKey.toRSAPublicKey());

    assertTrue(signedJWT.verify(verifier));
    String issuer = signedJWT.getJWTClaimsSet().getIssuer();
    String normalizedIssuer = normalizeUrl(issuer);
    assertEquals(normalizedIssuer, baseUrl());
  }

  @Test
  void errorHandlingUnsupportedGrant() throws Exception {
    Map<String, String> client = registerClient("Errors", List.of("http://localhost/callback"));
    Map<String, Object> discovery = discovery();

    String tokenEndpoint = discovery.get("token_endpoint").toString();
    String body = formBody(Map.of(
      "grant_type", "password",
      "username", "test",
      "password", "test"
    ));

    HttpResponse<String> response = postForm(tokenEndpoint, body, basicAuth(client));
    assertEquals(400, response.statusCode());

    Map<String, Object> payload = json(response);
    assertEquals("unsupported_grant_type", payload.get("error"));
  }

  private Map<String, Object> discovery() throws Exception {
    HttpResponse<String> response = get(baseUrl() + "/.well-known/openid-configuration");
    assertEquals(200, response.statusCode());
    Map<String, Object> payload = new HashMap<>(json(response));

    payload.computeIfPresent("authorization_endpoint", (k, v) -> normalizeUrl(v.toString()));
    payload.computeIfPresent("token_endpoint", (k, v) -> normalizeUrl(v.toString()));
    payload.computeIfPresent("jwks_uri", (k, v) -> normalizeUrl(v.toString()));
    payload.computeIfPresent("issuer", (k, v) -> normalizeUrl(v.toString()));

    return payload;
  }

  private Map<String, String> registerClient(String name, List<String> redirectUris) throws Exception {
    Map<String, Object> body = Map.of(
      "client_name", name,
      "redirect_uris", redirectUris,
      "scope", "openid profile email read write"
    );

    HttpResponse<String> response = postJson(baseUrl() + "/register", MAPPER.writeValueAsString(body));
    assertEquals(201, response.statusCode());

    Map<String, Object> payload = json(response);
    return Map.of(
      "client_id", payload.get("client_id").toString(),
      "client_secret", payload.get("client_secret").toString()
    );
  }

  private HttpResponse<String> get(String url) throws Exception {
    HttpRequest request = HttpRequest.newBuilder(URI.create(url)).GET().build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> postJson(String url, String json) throws Exception {
    HttpRequest request = HttpRequest.newBuilder(URI.create(url))
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(json))
      .build();

    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> postForm(String url, String body, String authHeader) throws Exception {
    HttpRequest request = HttpRequest.newBuilder(URI.create(url))
      .header("Content-Type", "application/x-www-form-urlencoded")
      .header("Authorization", authHeader)
      .POST(HttpRequest.BodyPublishers.ofString(body))
      .build();

    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private Map<String, Object> json(HttpResponse<String> response) throws IOException {
    return MAPPER.readValue(response.body(), new TypeReference<Map<String, Object>>() {});
  }

  private String basicAuth(Map<String, String> client) {
    String credentials = client.get("client_id") + ":" + client.get("client_secret");
    String encoded = java.util.Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    return "Basic " + encoded;
  }

  private String formBody(Map<String, String> params) {
    StringBuilder body = new StringBuilder();
    for (Map.Entry<String, String> entry : params.entrySet()) {
      if (body.length() > 0) {
        body.append('&');
      }
      body.append(url(entry.getKey())).append('=').append(url(entry.getValue()));
    }
    return body.toString();
  }

  private String normalizeUrl(String value) {
    if (value.startsWith("http://localhost:3000")) {
      return value.replace("http://localhost:3000", baseUrl());
    }
    return value;
  }

  private String url(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
