"""
Authentication and authorization dependencies compatibility layer.
Re-exports directly from auth.py to ensure unified RBAC and token validation.
"""
from auth import (
    oauth2_scheme,
    oauth2_scheme_optional,
    get_current_user,
    get_current_user_optional,
    require_role,
    verify_token,
    decode_access_token,
)