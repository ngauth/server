package main

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
)

var (
	issuerURL string
	jwksCache jwk.Set
)

type DataItem struct {
	Name string `json:"name" binding:"required"`
}

type CreateResponse struct {
	Message string `json:"message"`
	ID      string `json:"id"`
}

type UserInfo struct {
	UserID   string                 `json:"userId"`
	Username string                 `json:"username,omitempty"`
	Email    string                 `json:"email,omitempty"`
	Claims   map[string]interface{} `json:"claims"`
}

func init() {
	issuerURL = os.Getenv("OAUTH_ISSUER")
	if issuerURL == "" {
		issuerURL = "http://localhost:3000"
	}
}

// fetchJWKS fetches the JWKS from the OAuth server
func fetchJWKS() (jwk.Set, error) {
	jwksURL := fmt.Sprintf("%s/.well-known/jwks.json", issuerURL)
	resp, err := http.Get(jwksURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return jwk.Parse(resp.Body)
}

// verifyToken validates the JWT token and returns the claims
func verifyToken(tokenString string) (jwt.MapClaims, error) {
	// Fetch JWKS if not cached
	if jwksCache == nil {
		var err error
		jwksCache, err = fetchJWKS()
		if err != nil {
			return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
		}
	}

	// Parse token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		// Get key ID from token header
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("kid not found in token header")
		}

		// Find the key in JWKS
		key, found := jwksCache.LookupKeyID(kid)
		if !found {
			// Refresh JWKS cache and try again
			jwksCache, err = fetchJWKS()
			if err != nil {
				return nil, fmt.Errorf("failed to refresh JWKS: %w", err)
			}
			key, found = jwksCache.LookupKeyID(kid)
			if !found {
				return nil, fmt.Errorf("key %s not found in JWKS", kid)
			}
		}

		// Convert JWK to RSA public key
		var rawKey interface{}
		if err := key.Raw(&rawKey); err != nil {
			return nil, fmt.Errorf("failed to get raw key: %w", err)
		}

		rsaKey, ok := rawKey.(*rsa.PublicKey)
		if !ok {
			return nil, fmt.Errorf("key is not RSA public key")
		}

		return rsaKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("failed to parse claims")
	}

	return claims, nil
}

// AuthMiddleware validates JWT tokens
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := verifyToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("Invalid token: %v", err)})
			c.Abort()
			return
		}

		// Store claims in context
		c.Set("claims", claims)
		c.Next()
	}
}

// RequireScope checks if the token has the required scope
func RequireScope(requiredScope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claimsInterface, exists := c.Get("claims")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No claims found"})
			c.Abort()
			return
		}

		claims := claimsInterface.(jwt.MapClaims)
		scope, ok := claims["scope"].(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "No scope claim found"})
			c.Abort()
			return
		}

		scopes := strings.Split(scope, " ")
		hasScope := false
		for _, s := range scopes {
			if s == requiredScope {
				hasScope = true
				break
			}
		}

		if !hasScope {
			c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Insufficient scope. Required: %s", requiredScope)})
			c.Abort()
			return
		}

		c.Next()
	}
}

func main() {
	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	api := r.Group("/api")
	{
		// Public endpoint - no authentication
		api.GET("/public", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "This is a public endpoint"})
		})

		// Protected endpoint - requires authentication
		api.GET("/protected", AuthMiddleware(), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "This endpoint requires authentication"})
		})

		// Data endpoints - require specific scopes
		api.GET("/data", AuthMiddleware(), RequireScope("read"), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"data": []string{"item1", "item2", "item3"}})
		})

		api.POST("/data", AuthMiddleware(), RequireScope("write"), func(c *gin.Context) {
			var item DataItem
			if err := c.ShouldBindJSON(&item); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Generate a simple ID
			id := fmt.Sprintf("%d", len(item.Name)*1000+int(item.Name[0]))

			c.JSON(http.StatusCreated, CreateResponse{
				Message: fmt.Sprintf("Created item: %s", item.Name),
				ID:      id,
			})
		})

		// User info endpoint
		api.GET("/userinfo", AuthMiddleware(), func(c *gin.Context) {
			claimsInterface, _ := c.Get("claims")
			claims := claimsInterface.(jwt.MapClaims)

			sub, _ := claims["sub"].(string)
			email, _ := claims["email"].(string)
			username, _ := claims["name"].(string)
			if username == "" {
				username, _ = claims["username"].(string)
			}

			c.JSON(http.StatusOK, UserInfo{
				UserID:   sub,
				Username: username,
				Email:    email,
				Claims:   claims,
			})
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	r.Run(fmt.Sprintf(":%s", port))
}
