import pytest
import httpx
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_strategies import Wait
import time
import json
from urllib.parse import urlencode, parse_qs, urlparse


@pytest.fixture(scope="session")
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
    # Note: NGAUTH_ISSUER defaults to http://localhost:3000, which is expected
    
    # Wait for healthcheck
    container.with_command("sh -c 'node src/index.js'")
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


@pytest.fixture(scope="session")
def oauth_client(ngauth_container):
    """
    Register an OAuth client with appropriate scopes
    """
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
    return response.json()


@pytest.fixture(scope="session")
def client_credentials_token(ngauth_container, oauth_client):
    """
    Get access token using client credentials grant
    """
    response = httpx.post(
        f"{ngauth_container}/token",
        data={
            "grant_type": "client_credentials",
            "client_id": oauth_client["client_id"],
            "client_secret": oauth_client["client_secret"],
            "scope": "read write"
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def api_container(ngauth_container):
    """
    Start the API container
    """
    import subprocess
    import os
    
    # Build and start API container
    api_dir = "/workspaces/ngauth/server/docs/samples/testcontainers-python"
    
    # Create a simple Dockerfile for the API
    dockerfile_content = """FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api.py .
EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
"""
    
    with open(f"{api_dir}/Dockerfile", "w") as f:
        f.write(dockerfile_content)
    
    # Start API container using Docker
    container = DockerContainer("python:3.11-slim")
    container.with_bind_ports(8000, 8000)
    container.with_volume_mapping(api_dir, "/app", "rw")
    container.with_env("OAUTH_ISSUER", ngauth_container)
    container.with_command(
        "sh -c 'pip install -q -r /app/requirements.txt && uvicorn api:app --host 0.0.0.0 --port 8000 --app-dir /app'"
    )
    container.start()
    
    # Wait for API to be ready
    time.sleep(5)
    max_retries = 20
    for _ in range(max_retries):
        try:
            response = httpx.get("http://localhost:8000/health/live", timeout=2.0)
            if response.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)
    
    yield "http://localhost:8000"
    
    container.stop()


def test_public_endpoint_no_auth(api_container):
    """
    Test that public endpoint works without authentication
    """
    response = httpx.get(f"{api_container}/api/public")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["message"] == "This is a public endpoint"


def test_protected_endpoint_no_auth(api_container):
    """
    Test that protected endpoint rejects requests without authentication
    """
    response = httpx.get(f"{api_container}/api/protected")
    assert response.status_code == 403  # FastAPI returns 403 when no credentials


def test_protected_endpoint_with_token(api_container, client_credentials_token):
    """
    Test that protected endpoint accepts valid JWT token
    """
    headers = {"Authorization": f"Bearer {client_credentials_token}"}
    response = httpx.get(f"{api_container}/api/protected", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data


def test_data_get_requires_read_scope(api_container, client_credentials_token):
    """
    Test that GET /api/data requires 'read' scope
    """
    headers = {"Authorization": f"Bearer {client_credentials_token}"}
    response = httpx.get(f"{api_container}/api/data", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert isinstance(data["data"], list)


def test_data_post_requires_write_scope(api_container, client_credentials_token):
    """
    Test that POST /api/data requires 'write' scope
    """
    headers = {"Authorization": f"Bearer {client_credentials_token}"}
    payload = {"name": "Test Item"}
    response = httpx.post(f"{api_container}/api/data", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert "message" in data
    assert "id" in data


def test_data_get_without_scope(ngauth_container, oauth_client, api_container):
    """
    Test that GET /api/data rejects token without 'read' scope
    """
    # Get token without read scope
    response = httpx.post(
        f"{ngauth_container}/token",
        data={
            "grant_type": "client_credentials",
            "client_id": oauth_client["client_id"],
            "client_secret": oauth_client["client_secret"],
            "scope": "write"  # Only write, no read
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    token = response.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    response = httpx.get(f"{api_container}/api/data", headers=headers)
    assert response.status_code == 403


def test_userinfo_endpoint(api_container, client_credentials_token):
    """
    Test that /api/userinfo returns JWT claims
    """
    headers = {"Authorization": f"Bearer {client_credentials_token}"}
    response = httpx.get(f"{api_container}/api/userinfo", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "userId" in data
    assert "claims" in data


def test_oidc_discovery(ngauth_container):
    """
    Test OIDC Discovery endpoint
    """
    response = httpx.get(f"{ngauth_container}/.well-known/openid-configuration")
    assert response.status_code == 200
    data = response.json()
    assert data["issuer"] == ngauth_container
    assert "authorization_endpoint" in data
    assert "token_endpoint" in data
    assert "jwks_uri" in data


def test_jwks_endpoint(ngauth_container):
    """
    Test JWKS endpoint returns public keys
    """
    response = httpx.get(f"{ngauth_container}/.well-known/jwks.json")
    assert response.status_code == 200
    data = response.json()
    assert "keys" in data
    assert len(data["keys"]) > 0
    assert data["keys"][0]["kty"] == "RSA"
