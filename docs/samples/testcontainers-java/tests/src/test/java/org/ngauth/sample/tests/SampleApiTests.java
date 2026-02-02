package org.ngauth.sample.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.FixedHostPortGenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@SpringBootTest(
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
  classes = org.ngauth.sample.api.SampleApiApplication.class
)
@AutoConfigureMockMvc
class SampleApiTests {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String PRESET = "cognito";

  @Container
  static final FixedHostPortGenericContainer<?> NGAUTH = new FixedHostPortGenericContainer<>("ngauth/server:1.0.0-alpha")
    .withEnv("NGAUTH_PRESET", PRESET)
    .withFixedExposedPort(3000, 3000)
    .waitingFor(Wait.forHttp("/health/ready").forStatusCode(200).forPort(3000))
    .withStartupTimeout(Duration.ofSeconds(60));

  @DynamicPropertySource
  static void dynamicProperties(DynamicPropertyRegistry registry) {
    registry.add(
      "spring.security.oauth2.resourceserver.jwt.issuer-uri",
      () -> "http://localhost:3000"
    );
  }

  @Autowired
  private MockMvc mockMvc;

  private String clientId;
  private String clientSecret;

  private String oauthBaseUrl() {
    return "http://localhost:3000";
  }

  @BeforeAll
  void setUp() throws Exception {
    Map<String, Object> registerRequest = Map.of(
      "client_name", "Test Client",
      "redirect_uris", List.of("http://localhost/callback"),
      "scope", "read write openid profile email"
    );

    HttpResponse<String> registerResponse = httpPostJson(oauthBaseUrl() + "/register", MAPPER.writeValueAsString(registerRequest));
    assertEquals(201, registerResponse.statusCode());
    
    Map<String, Object> clientInfo = json(registerResponse);
    this.clientId = clientInfo.get("client_id").toString();
    this.clientSecret = clientInfo.get("client_secret").toString();
  }

  @Test
  void publicEndpoint_shouldReturn200_withoutAuthentication() throws Exception {
    mockMvc.perform(get("/api/public")).andExpect(status().isOk());
  }

  @Test
  void protectedEndpoint_shouldReturn401_withoutToken() throws Exception {
    mockMvc.perform(get("/api/protected")).andExpect(status().isUnauthorized());
  }

  @Test
  void scopeProtectedEndpoint_shouldReturn401_withoutRequiredScope() throws Exception {
    String token = getClientCredentialsToken("");
    mockMvc.perform(get("/api/data").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void writeEndpoint_shouldReturn401_withoutWriteScope() throws Exception {
    String token = getClientCredentialsToken("read");
    mockMvc
      .perform(post("/api/data").header("Authorization", "Bearer " + token).header("Content-Type", "application/json").content("{\"name\":\"Test Item\"}"))
      .andExpect(status().isForbidden());
  }

  private String getClientCredentialsToken(String scope) throws Exception {
    Map<String, Object> discovery = discovery();
    String tokenEndpoint = discovery.get("token_endpoint").toString();

    Map<String, String> params = new HashMap<>();
    params.put("grant_type", "client_credentials");
    params.put("client_id", clientId);
    params.put("client_secret", clientSecret);
    if (!scope.isEmpty()) {
      params.put("scope", scope);
    }

    String body = formBody(params);
    HttpResponse<String> response = httpPostForm(tokenEndpoint, body, basicAuth(clientId, clientSecret));
    assertEquals(200, response.statusCode());
    
    Map<String, Object> tokenResponse = json(response);
    return tokenResponse.get("access_token").toString();
  }

  private Map<String, Object> discovery() throws Exception {
    HttpResponse<String> response = httpGet(oauthBaseUrl() + "/.well-known/openid-configuration");
    assertEquals(200, response.statusCode());

    Map<String, Object> payload = new HashMap<>(json(response));
    payload.computeIfPresent("authorization_endpoint", (k, v) -> normalizeUrl(v.toString()));
    payload.computeIfPresent("token_endpoint", (k, v) -> normalizeUrl(v.toString()));
    payload.computeIfPresent("jwks_uri", (k, v) -> normalizeUrl(v.toString()));
    payload.computeIfPresent("issuer", (k, v) -> normalizeUrl(v.toString()));

    return payload;
  }

  private HttpResponse<String> httpGet(String url) throws Exception {
    HttpRequest request = HttpRequest.newBuilder(URI.create(url)).GET().build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> httpPostJson(String url, String jsonBody) throws Exception {
    HttpRequest request = HttpRequest.newBuilder(URI.create(url))
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
      .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> httpPostForm(String url, String body, String authHeader) throws Exception {
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

  private String basicAuth(String clientId, String clientSecret) {
    String credentials = clientId + ":" + clientSecret;
    String encoded = java.util.Base64.getEncoder().encodeToString(credentials.getBytes());
    return "Basic " + encoded;
  }

  private String formBody(Map<String, String> params) {
    StringBuilder body = new StringBuilder();
    for (Map.Entry<String, String> entry : params.entrySet()) {
      if (body.length() > 0) {
        body.append('&');
      }
      body
        .append(java.net.URLEncoder.encode(entry.getKey(), java.nio.charset.StandardCharsets.UTF_8))
        .append('=')
        .append(java.net.URLEncoder.encode(entry.getValue(), java.nio.charset.StandardCharsets.UTF_8));
    }
    return body.toString();
  }

  private String normalizeUrl(String value) {
    if (value.startsWith("http://localhost:3000")) {
      return value.replace("http://localhost:3000", oauthBaseUrl());
    }
    return value;
  }
}
