package org.ngauth.sample.api.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SampleController {
  @GetMapping("/public")
  public Map<String, Object> publicEndpoint() {
    return Map.of("message", "public");
  }

  @GetMapping("/protected")
  public Map<String, Object> protectedEndpoint() {
    return Map.of("message", "protected");
  }

  @GetMapping("/data")
  public Map<String, Object> readData() {
    return Map.of("data", List.of("alpha", "beta", "gamma"));
  }

  @PostMapping("/data")
  public ResponseEntity<Map<String, Object>> writeData() {
    return ResponseEntity.status(HttpStatus.CREATED)
      .body(Map.of("id", UUID.randomUUID().toString()));
  }

  @GetMapping("/userinfo")
  public Map<String, Object> userInfo(@AuthenticationPrincipal Jwt jwt) {
    String scope = jwt.getClaimAsString("scope");
    if (scope == null) {
      Object scp = jwt.getClaims().get("scp");
      if (scp != null) {
        scope = scp.toString();
      }
    }

    return Map.of(
      "sub", jwt.getSubject(),
      "email", jwt.getClaimAsString("email"),
      "scope", scope
    );
  }
}
