from datetime import datetime, timedelta, timezone
import os
import secrets
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
import database, models

# Enforce secure SECRET_KEY from environment
_ENV_SECRET = os.getenv("SECRET_KEY", "").strip()
IS_PRODUCTION = bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID"))

if IS_PRODUCTION:
    if not _ENV_SECRET or _ENV_SECRET in [
        "CAMPUSLINK_SUPER_SECRET_KEY_CHANGE_IN_PRODUCTION",
        "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION",
        "campuslink_dev_secret_key_2026",
        "campuslink_super_secret_jwt_key_2026"
    ]:
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: A dedicated SECRET_KEY environment variable "
            "must be configured in production on Render. Refusing to boot with insecure key."
        )
    SECRET_KEY = _ENV_SECRET
else:
    SECRET_KEY = _ENV_SECRET or "campuslink_local_dev_secret_only_change_in_prod"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 Hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="api/login", auto_error=False)

def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with a random salt."""
    if not password:
        raise ValueError("Password cannot be empty.")
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Strictly verifies plaintext password against bcrypt hash.
    No development backdoors or bypasses are permitted.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

class TokenData:
    def __init__(self, user_id: str, role: Optional[str] = None):
        self.user_id = user_id
        self.role = role

def verify_token(token: str) -> Optional[TokenData]:
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return TokenData(user_id=str(user_id), role=payload.get("role"))

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired or invalid authentication credentials. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = verify_token(token)
    if not token_data:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.user_id == token_data.user_id).first()
    if user is None:
        raise credentials_exception

    user_status = (getattr(user, "status", "active") or "active").lower().strip()
    if user_status in ["suspended", "banned"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account has been {user_status} by platform administration. Access revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(database.get_db)) -> Optional[models.User]:
    if not token:
        return None
    token_data = verify_token(token)
    if not token_data:
        return None
    user = db.query(models.User).filter(models.User.user_id == token_data.user_id).first()
    if user and (getattr(user, "status", "active") or "active").lower().strip() in ["suspended", "banned"]:
        return None
    return user

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Restricted to authorized roles ({', '.join(allowed_roles)})."
            )
        return current_user
    return role_checker
