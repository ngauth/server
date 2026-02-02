package org.ngauth.sample.api.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SampleController {

  // Public endpoint - no authentication required
  @GetMapping("/public")
  public Map<String, String> getPublic() {
    return Map.of("message", "This is a public endpoint");
  }

  // Protected endpoint - requires authentication
  @GetMapping("/protected")
  public Map<String, String> getProtected(@AuthenticationPrincipal Jwt jwt) {
    return Map.of("message", "This endpoint requires authentication");
  }

  // Scope-protected endpoint - requires 'read' scope
  @GetMapping("/data")
  public Map<String, Object> getData(@AuthenticationPrincipal Jwt jwt) {
    return Map.of("data", List.of("item1", "item2", "item3"));
  }

  // Scope-protected endpoint - requires 'write' scope
  @PostMapping("/data")
  public ResponseEntity<Map<String, Object>> createData(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody DataItem item) {
    Map<String, Object> response = new HashMap<>();
    response.put("message", "Created item: " + item.getName());
    response.put("id", UUID.randomUUID());
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  // User info endpoint - returns claims from the authenticated user
  @GetMapping("/userinfo")
  public Map<String, Object> getUserInfo(@AuthenticationPrincipal Jwt jwt) {
    Map<String, Object> response = new HashMap<>();
    response.put("userId", jwt.getSubject());
    response.put("username", jwt.getClaimAsString("name"));
    response.put("email", jwt.getClaimAsString("email"));
    
    Map<String, Object> claims = new HashMap<>();
    jwt.getClaims().forEach((key, value) -> {
      claims.put(key, value);
    });
    response.put("claims", claims);
    
    return response;
  }

  public static class DataItem {
    private String name;

    public DataItem() {}

    public DataItem(String name) {
      this.name = name;
    }

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }
  }
}
