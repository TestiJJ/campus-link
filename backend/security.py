"""
Security module compatibility layer.
Redirects all cryptographic and auth primitives directly to auth.py
to maintain a single source of truth and prevent security drift.
"""
from auth import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)

# Legacy alias
get_password_hash = hash_password
