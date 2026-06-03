"""
auth/utils.py
-------------
Helper functions for:
- Hashing passwords with bcrypt
- Verifying passwords
- Creating and decoding JWT tokens
"""
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
from core.config import settings


def hash_password(password: str) -> str:
    """Hashes password using bcrypt directly — avoids passlib/bcrypt version conflicts."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verifies plain password against stored bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    """
    Creates a signed JWT token containing user info.
    Token expires after ACCESS_TOKEN_EXPIRE_MINUTES (default 24h).
    """
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """
    Decodes a JWT token and returns the payload.
    Returns None if the token is invalid or expired.
    """
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
