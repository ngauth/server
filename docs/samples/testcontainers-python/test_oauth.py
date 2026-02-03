"""
Simplified integration tests for ngauth OAuth server using Testcontainers.
Tests OAuth flows without needing to run the sample API.
"""
import pytest
import httpx
from testcontainers.core.container import DockerContainer
import time


@pytest.fixture(scope="module")
def ngauth_container():
    """
    Start ngauth OAuth server container
    """
    container = DockerContainer("aronworks/ngauth:latest")
    container.with_exposed_ports(3000)
    container.with_env("NODE_ENV", "development")
    container.with_env("JWT_SECRET", "test-secret-key-min-32-chars-long!")
    container.with_env("SESSION_SECRET", "test-session-secret-min-32-chars!")
    container.with_env("ADMIN_USERNAME", "admin")
    container.with_env("ADMIN_PASSWORD", "admin123")
    
    container.start()
    
    # Wait for container to be ready
    time.sleep(3)
    
    # Get the mapped port
    port = container.get_exposed_port(3000)
    base_url = f"http://localhost:{port}"
    
    # Verify the server is ready
    max_retries = 30
    for _ in range(max_retries):
        try:
            response = httpx.get(f"{base_url}/health/live", timeout=2.0)
            if response.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)
    
    yield base_url
    
    container.stop()


def test_health_check(ngauth_container):
    """Test health check endpoint"""
    response = httpx.get(f"{ngauth_container}/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_oidc_discovery(ngauth_container):
    """Test OIDC Discovery endpoint"""
    response = httpx.get(f"{ngauth_container}/.well-known/openid-configuration")
    assert response.status_code == 200
    data = response.json()
    assert "issuer" in data
    assert "authorization_endpoint" in data
    assert "token_endpoint" in data
    assert "jwks_uri" in data


def test_jwks_endpoint(ngauth_container):
    """Test JWKS endpoint returns public keys"""
    response = httpx.get(f"{ngauth_container}/.well-known/jwks.json")
    assert response.status_code == 200
    data = response.json()
    assert "keys" in data
    assert len(data["keys"]) > 0
    assert data["keys"][0]["kty"] == "RSA"


def test_register_client(ngauth_container):
    """Test dynamic client registration"""
    response = httpx.post(
        f"{ngauth_container}/register",
        json={
            "client_name": "Test Client",
            "redirect_uris": ["http://localhost:8000/callback"],
            "grant_types": ["authorization_code", "client_credentials"],
            "scope": "openid profile email read write"
        }
    )
    assert response.status_code == 201
    client = response.json()
    assert "client_id" in client
    assert "client_secret" in client
    assert client["client_name"] == "Test Client"


def test_client_credentials_grant(ngauth_container):
    """Test client credentials grant flow"""
    # Register client first
    register_response = httpx.post(
        f"{ngauth_container}/api/register",
        json={
            "client_name": "Test Client",
            "redirect_uris": ["http://localhost:8000/callback"],
            "grant_types": ["client_credentials"],
            "scope": "read write"
        }
    )
    assert register_response.status_code == 201
    client = register_response.json()
    
    # Get access token
    token_response = httpx.post(
        f"{ngauth_container}/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
            "scope": "read write"
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert token_response.status_code == 200
    token_data = token_response.json()
    assert "access_token" in token_data
    assert "token_type" in token_data
    assert token_data["token_type"] == "Bearer"


def test_jwt_token_validation(ngauth_container):
    """Test JWT token can be validated"""
    import jwt
    from jwt import PyJWKClient
    
    # Register client and get token
    register_response = httpx.post(
        f"{ngauth_container}/api/register",
        json={
            "client_name": "Test Client",
            "redirect_uris": ["http://localhost:8000/callback"],
            "grant_types": ["client_credentials"],
            "scope": "read"
        }
    )
    client = register_response.json()
    
    token_response = httpx.post(
        f"{ngauth_container}/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
            "scope": "read"
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    access_token = token_response.json()["access_token"]
    
    # Validate token using JWKS
    jwks_url = f"{ngauth_container}/.well-known/jwks.json"
    jwks_client = PyJWKClient(jwks_url)
    signing_key = jwks_client.get_signing_key_from_jwt(access_token)
    
    decoded = jwt.decode(
        access_token,
        signing_key.key,
        algorithms=["RS256"],
        options={"verify_aud": False}
    )
    
    assert "client_id" in decoded
    assert "scope" in decoded
    assert "read" in decoded["scope"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
