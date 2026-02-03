from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import jwt
from jwt import PyJWKClient
import os
import uuid

app = FastAPI(title="Sample API", version="1.0.0")
security = HTTPBearer()

# Configuration
ISSUER_URL = os.getenv("OAUTH_ISSUER", "http://localhost:3000")
JWKS_URL = f"{ISSUER_URL}/.well-known/jwks.json"

# JWT validation
jwks_client = PyJWKClient(JWKS_URL)


class DataItem(BaseModel):
    name: str


class TokenData(BaseModel):
    sub: str
    scope: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify JWT token and return decoded claims
    """
    try:
        token = credentials.credentials
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=None,  # ngauth doesn't enforce audience by default
            options={"verify_aud": False}
        )
        
        return decoded
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_scope(required_scope: str):
    """
    Dependency to check if token has required scope
    """
    def scope_checker(token_data: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
        token_scope = token_data.get("scope", "")
        scopes = token_scope.split() if token_scope else []
        
        if required_scope not in scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient scope. Required: {required_scope}",
            )
        return token_data
    return scope_checker


# Public endpoint - no authentication required
@app.get("/api/public")
async def get_public():
    """Public endpoint accessible without authentication"""
    return {"message": "This is a public endpoint"}


# Protected endpoint - requires authentication
@app.get("/api/protected")
async def get_protected(token_data: Dict[str, Any] = Depends(verify_token)):
    """Protected endpoint requiring valid JWT"""
    return {"message": "This endpoint requires authentication"}


# Scope-protected endpoint - requires 'read' scope
@app.get("/api/data")
async def get_data(token_data: Dict[str, Any] = Depends(require_scope("read"))):
    """Get data - requires 'read' scope"""
    return {"data": ["item1", "item2", "item3"]}


# Scope-protected endpoint - requires 'write' scope
@app.post("/api/data", status_code=status.HTTP_201_CREATED)
async def create_data(
    item: DataItem,
    token_data: Dict[str, Any] = Depends(require_scope("write"))
):
    """Create data - requires 'write' scope"""
    return {
        "message": f"Created item: {item.name}",
        "id": str(uuid.uuid4())
    }


# User info endpoint - returns claims from the authenticated user
@app.get("/api/userinfo")
async def get_userinfo(token_data: Dict[str, Any] = Depends(verify_token)):
    """Get user information from JWT claims"""
    return {
        "userId": token_data.get("sub"),
        "username": token_data.get("name") or token_data.get("username"),
        "email": token_data.get("email"),
        "claims": token_data
    }


# Health check
@app.get("/health/live")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
