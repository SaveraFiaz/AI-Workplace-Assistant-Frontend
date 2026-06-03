from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db, User
from auth.utils import decode_access_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    # Single-session enforcement: token must match the one stored in DB.
    # If the same account logs in from another device, the old token is
    # overwritten so all previous sessions become invalid immediately.
    if user.active_token != token:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Your account was logged in elsewhere. Please log in again.",
        )

    return user
