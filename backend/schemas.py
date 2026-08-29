from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# ------------------------------------------------------------------
# User & Verification Schemas
# ------------------------------------------------------------------

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    role: str = "buyer"  # Options: "buyer" | "seller"

class UserCreate(UserBase):
    password: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    institution: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserOut(UserBase):
    user_id: str
    institution: Optional[str] = None
    id_card_url: Optional[str] = None
    is_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# ------------------------------------------------------------------
# Freelance Service (Gig) Schemas - Upwork/Fiverr Style
# ------------------------------------------------------------------

class ServiceBase(BaseModel):
    title: str
    description: str
    starting_price: float
    category: str

class ServiceCreate(ServiceBase):
    pass

class ServiceOut(ServiceBase):
    id: int
    seller_id: int
    seller_name: str
    institution: str
    rating: float = 5.0
    reviews_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ------------------------------------------------------------------
# Standard Marketplace Listing Schemas
# ------------------------------------------------------------------

class ListingBase(BaseModel):
    title: str
    description: str
    price: float
    category: str

class ListingCreate(ListingBase):
    pass

class ListingOut(ListingBase):
    listing_id: str
    created_at: datetime

    class Config:
        from_attributes = True