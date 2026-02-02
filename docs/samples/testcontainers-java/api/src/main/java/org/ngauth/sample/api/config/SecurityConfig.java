package org.ngauth.sample.api.config;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
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

    http.oauth2ResourceServer(oauth2 -> oauth2
      .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
    );

    return http.build();
  }

  @Bean
  public Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(new FlexibleScopeAuthoritiesConverter());
    return converter;
  }

  static class FlexibleScopeAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {
    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
      List<GrantedAuthority> authorities = new ArrayList<>();
      
      Object scopeClaim = jwt.getClaims().get("scope");
      if (scopeClaim == null) {
        scopeClaim = jwt.getClaims().get("scp");
      }

      if (scopeClaim instanceof String scopeString) {
        for (String scope : scopeString.split(" ")) {
          if (!scope.isBlank()) {
            authorities.add(new SimpleGrantedAuthority("SCOPE_" + scope));
          }
        }
      } else if (scopeClaim instanceof Collection<?> scopeList) {
        for (Object scope : scopeList) {
          if (scope != null) {
            String value = scope.toString().trim();
            if (!value.isBlank()) {
              authorities.add(new SimpleGrantedAuthority("SCOPE_" + value));
            }
          }
        }
      }

      return authorities;
    }
  }
}
