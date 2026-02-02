package org.ngauth.sample.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable());

    http.authorizeHttpRequests(auth -> auth
      .requestMatchers(HttpMethod.GET, "/api/public").permitAll()
      .requestMatchers(HttpMethod.GET, "/api/data").hasAuthority("SCOPE_read")
      .requestMatchers(HttpMethod.POST, "/api/data").hasAuthority("SCOPE_write")
      .requestMatchers("/api/protected", "/api/userinfo").authenticated()
      .anyRequest().authenticated()
    );

    http.oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> {}));

    return http.build();
  }
}
