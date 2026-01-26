#!/bin/bash

# OAuth Server + API Server Integration Test Script
# This script demonstrates the complete OAuth 2.0 flow

set -e

OAUTH_URL="http://localhost:3000"
API_URL="http://localhost:3001"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== OAuth Server + API Server Integration Test ===${NC}\n"

# 1. Check Services are Running
echo -e "${YELLOW}1. Checking if services are running...${NC}"
if ! curl -s "$OAUTH_URL/.well-known/oauth-authorization-server" > /dev/null; then
    echo "❌ OAuth server not responding on $OAUTH_URL"
    exit 1
fi
echo -e "${GREEN}✓ OAuth server is running${NC}"

if ! curl -s "$API_URL/health" > /dev/null; then
    echo "❌ API server not responding on $API_URL"
    exit 1
fi
echo -e "${GREEN}✓ API server is running${NC}\n"

# 2. Register Client Application
echo -e "${YELLOW}2. Registering OAuth client application...${NC}"
CLIENT_RESPONSE=$(curl -s -X POST "$OAUTH_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test API Client",
    "redirect_uris": ["http://localhost:3001/callback"],
    "grant_types": ["authorization_code", "client_credentials"]
  }')

CLIENT_ID=$(echo $CLIENT_RESPONSE | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
CLIENT_SECRET=$(echo $CLIENT_RESPONSE | grep -o '"client_secret":"[^"]*' | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "❌ Failed to register client"
    echo "Response: $CLIENT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Client registered${NC}"
echo "  Client ID: $CLIENT_ID"
echo "  Client Secret: ${CLIENT_SECRET:0:20}...${NC}\n"

# 3. Register Test User
echo -e "${YELLOW}3. Registering test user...${NC}"
USER_RESPONSE=$(curl -s -X POST "$OAUTH_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "testuser@example.com",
    "password": "SecurePass123!"
  }')

if echo "$USER_RESPONSE" | grep -q '"id"'; then
    echo -e "${GREEN}✓ User registered${NC}"
    USER_ID=$(echo $USER_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "  User ID: $USER_ID"
else
    echo -e "${YELLOW}⚠ User might already exist (that's OK)${NC}"
fi
echo ""

# 4. Test Client Credentials Grant (Service-to-Service)
echo -e "${YELLOW}4. Testing Client Credentials Grant...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST "$OAUTH_URL/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"grant_type\": \"client_credentials\",
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\",
    \"scope\": \"read write\"
  }")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to get access token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Access token obtained${NC}"
echo "  Token: ${ACCESS_TOKEN:0:30}...${NC}\n"

# 5. Test Protected Endpoint
echo -e "${YELLOW}5. Testing API server protected endpoint...${NC}"
API_RESPONSE=$(curl -s "$API_URL/api/protected" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$API_RESPONSE" | grep -q '"message"'; then
    echo -e "${GREEN}✓ Successfully accessed protected resource${NC}"
    echo "  Response: $API_RESPONSE" | head -c 100
    echo "...\n"
else
    echo "❌ Failed to access protected endpoint"
    echo "Response: $API_RESPONSE"
    exit 1
fi

# 6. Test OAuth Metadata
echo -e "${YELLOW}6. Testing OAuth server metadata endpoint...${NC}"
METADATA=$(curl -s "$API_URL/api/oauth-server-info")

if echo "$METADATA" | grep -q '"issuer"'; then
    echo -e "${GREEN}✓ OAuth metadata retrieved${NC}"
    echo "  Issuer: $(echo $METADATA | grep -o '"issuer":"[^"]*' | cut -d'"' -f4)"
else
    echo "❌ Failed to retrieve OAuth metadata"
fi
echo ""

# 7. Test with Invalid Token
echo -e "${YELLOW}7. Testing with invalid token (should fail)...${NC}"
INVALID_RESPONSE=$(curl -s "$API_URL/api/protected" \
  -H "Authorization: Bearer invalid_token")

if echo "$INVALID_RESPONSE" | grep -q '"error"'; then
    echo -e "${GREEN}✓ Correctly rejected invalid token${NC}"
else
    echo "❌ Should have rejected invalid token"
fi
echo ""

# 8. Test without Token
echo -e "${YELLOW}8. Testing without token (should fail)...${NC}"
NO_TOKEN_RESPONSE=$(curl -s "$API_URL/api/protected")

if echo "$NO_TOKEN_RESPONSE" | grep -q '"error"'; then
    echo -e "${GREEN}✓ Correctly rejected missing token${NC}"
else
    echo "❌ Should have rejected missing token"
fi
echo ""

echo -e "${GREEN}=== All tests passed! ===${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo "1. Visit http://localhost:3000/authorize to test authorization code flow"
echo "2. Modify api-server.js to add your custom API endpoints"
echo "3. Review README.md for more details"
