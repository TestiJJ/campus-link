from pydantic import BaseModel, EmailStr
from typing import Optional, List, Union, Any
from datetime import datetime

# --- University ---
class UniversityBase(BaseModel):
    name: str
    state: str
    type: str = "Public"

class UniversityOut(UniversityBase):
    university_id: Optional[int] = None
    id: Optional[int] = None

    class Config:
        from_attributes = True

# --- User & Auth ---
class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str
    role: str = "student"  # student | vendor | admin
    status: Optional[str] = "active"  # active | suspended
    university_id: Optional[int] = None
    state: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    hostel: Optional[str] = None
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None

class UserCreate(UserBase):
    password: str
    matric_number: Optional[str] = None
    
    # Extended Registration Payload Fields
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    category_id: Optional[int] = None
    id_card_url: Optional[str] = None
    admin_secret_key: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class VerifyEmailSchema(BaseModel):
    email: EmailStr
    code: str

class ResendOTPSchema(BaseModel):
    email: EmailStr

class UserOut(UserBase):
    user_id: str
    matric_number: Optional[str] = None
    is_email_verified: bool
    is_online: Optional[bool] = False
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserRegistrationOut(UserOut):
    email_dispatched: Optional[bool] = True
    dev_code: Optional[str] = None
    message: Optional[str] = None

class UserProfileUpdate(BaseModel):
    bio: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    hostel: Optional[str] = None
    profile_picture_url: Optional[str] = None
    current_password: Optional[str] = None

class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str

class AdminUserStatusUpdate(BaseModel):
    status: str  # "active" or "suspended"

class UserAccountDeleteRequest(BaseModel):
    confirm_text: Optional[str] = None
    reason: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# --- Vendor & Verification ---
class VendorVerificationSubmit(BaseModel):
    id_card_front: str
    id_card_back: str
    id_card_type: Optional[str] = "national_id"
    id_card_number: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    category_id: Optional[int] = None

class AdminVendorAction(BaseModel):
    action: str  # "approve" | "reject"
    rejection_reason: Optional[str] = None

class VendorOut(BaseModel):
    id: int
    user_id: str
    business_name: str
    business_description: Optional[str] = None
    category_id: Optional[int] = None
    university_id: Optional[int] = None
    state: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo: Optional[str] = None
    cover_image: Optional[str] = None
    verification_status: str  # pending | verified | rejected
    id_card_type: Optional[str] = None
    id_card_number: Optional[str] = None
    id_card_front: Optional[str] = None
    id_card_back: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    user_name: Optional[str] = None
    university_name: Optional[str] = None
    category_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- Product ---
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category_id: int
    university_id: Optional[int] = None
    image: Optional[str] = None
    quantity: Optional[int] = 1

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[int] = None
    university_id: Optional[int] = None
    image: Optional[str] = None
    quantity: Optional[int] = None
    status: Optional[str] = None

class ProductOut(ProductCreate):
    id: int
    vendor_id: int
    university_id: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None
    vendor_name: Optional[str] = None
    vendor_location: Optional[str] = None
    vendor_user_id: Optional[str] = None
    vendor_phone: Optional[str] = None
    is_vendor_verified: Optional[bool] = False
    university_name: Optional[str] = None
    university_abbr: Optional[str] = None
    dispatch_location: Optional[str] = None

    class Config:
        from_attributes = True

# --- Service ---
class ServiceCreate(BaseModel):
    name: str
    description: str
    price: float
    category_id: int
    university_id: Optional[int] = None
    location: Optional[str] = None
    image: Optional[str] = None

class ServiceOut(ServiceCreate):
    id: int
    vendor_id: int
    university_id: Optional[int] = None
    availability: str
    created_at: Optional[datetime] = None
    vendor_name: Optional[str] = None
    vendor_user_id: Optional[str] = None
    vendor_phone: Optional[str] = None
    is_vendor_verified: Optional[bool] = False

    class Config:
        from_attributes = True

# --- Reel (Campus TikTok / Story) ---
class ReelCommentCreate(BaseModel):
    content: str

class ReelCommentOut(BaseModel):
    id: int
    reel_id: int
    user_id: str
    content: str
    author_name: str
    author_avatar: Optional[str] = None
    author_role: Optional[str] = "Student"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ReelCreate(BaseModel):
    title: str
    description: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = "text"  # text | image | video
    location: Optional[str] = None

class ReelOut(ReelCreate):
    id: int
    user_id: str
    vendor_id: Optional[int] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    author_avatar: Optional[str] = None
    author_university: Optional[str] = None
    author_university_abbr: Optional[str] = None
    likes_count: int
    comments_count: Optional[int] = 0
    has_liked: Optional[bool] = False
    comments: Optional[List[ReelCommentOut]] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Order ---
class OrderCreate(BaseModel):
    vendor_id: int
    item_title: str
    product_id: Optional[int] = None
    service_id: Optional[int] = None
    quantity: int = 1
    amount: float
    delivery_location: str

class OrderOut(OrderCreate):
    id: int
    user_id: str
    status: str
    created_at: Optional[datetime] = None
    customer_name: Optional[str] = None
    vendor_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- Review ---
class ReviewCreate(BaseModel):
    vendor_id: int
    rating: int  # 1 to 5
    comment: Optional[str] = None

class ReviewOut(ReviewCreate):
    id: int
    user_id: str
    author_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Ride Booking ---
class RideBookingCreate(BaseModel):
    ride_type: str  # "Campus Shuttle" | "Keke Napep" | "Bike Express" | "Campus Bolt"
    pickup_location: str
    dropoff_location: str

class RideBookingOut(BaseModel):
    id: int
    user_id: str
    ride_type: str
    pickup_location: str
    dropoff_location: str
    estimated_fare: float
    status: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    plate_number: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Post (Backward Compatibility) ---
class PostCreate(BaseModel):
    title: str
    description: str
    price: float
    category_id: int
    image_url: Optional[str] = None

class PostOut(PostCreate):
    id: Optional[int] = None
    post_id: Optional[int] = None
    vendor_id: Optional[int] = None
    user_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Message & Friendship ---
class MessageCreate(BaseModel):
    recipient_id: str
    content: str
    post_id: Optional[int] = None
    message_type: Optional[str] = "text"  # text, audio, image, video
    media_url: Optional[str] = None
    duration: Optional[int] = None

class MessageOut(BaseModel):
    id: int
    sender_id: str
    recipient_id: str
    post_id: Optional[int] = None
    content: str
    message_type: Optional[str] = "text"
    media_url: Optional[str] = None
    duration: Optional[int] = None
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FriendshipOut(BaseModel):
    id: int
    user_id: str
    friend_id: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FriendRequestOut(BaseModel):
    request_id: int
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    sender_department: Optional[str] = None
    sender_level: Optional[str] = None
    sender_hostel: Optional[str] = None
    created_at: Optional[datetime] = None

class StudentProfileOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    hostel: Optional[str] = None
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None
    matric_number: Optional[str] = None
    university_name: Optional[str] = None
    friends_count: Optional[int] = 0
    friendship_status: Optional[str] = "none"  # "none" | "request_sent" | "request_received" | "friends" | "self"
    request_id: Optional[int] = None

# --- Category ---
class CategoryOut(BaseModel):
    category_id: Optional[int] = None
    id: Optional[int] = None
    name: str
    icon: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True

# --- Report & Favorite ---
class ReportCreate(BaseModel):
    reported_vendor_id: int
    reason: str

class FavoriteCreate(BaseModel):
    vendor_id: Optional[int] = None
    product_id: Optional[int] = None
    service_id: Optional[int] = None

# --- Campus Notices & Lost/Found ---
class CampusNoticeCreate(BaseModel):
    type: str  # lost, found, announcement
    title: str
    category: str
    description: str
    location: str
    date_lost_or_found: Optional[str] = None
    contact_phone: Optional[str] = None
    image_url: Optional[str] = None

class CampusNoticeOut(BaseModel):
    id: int
    university_id: int
    user_id: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    author_dept: Optional[str] = None
    type: str
    title: str
    category: str
    description: str
    location: str
    date_lost_or_found: Optional[str] = None
    contact_phone: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Campus Statuses (WhatsApp-style Stories) ---
class CampusStatusCreate(BaseModel):
    media_url: Optional[str] = None
    media_type: Optional[str] = "text"  # text, image, video
    caption: Optional[str] = None
    background_color: Optional[str] = "from-emerald-600 to-teal-800"
    privacy_setting: Optional[str] = "friends"  # friends, everyone, only_share_with
    allowed_user_ids: Optional[Union[str, List[Any]]] = None

class CampusStatusOut(BaseModel):
    id: int
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    user_dept: Optional[str] = None
    media_url: Optional[str] = None
    media_type: str
    caption: Optional[str] = None
    background_color: Optional[str] = None
    privacy_setting: Optional[str] = "friends"
    views_count: Optional[int] = 0
    viewers: Optional[List[dict]] = None
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Notifications ---
class NotificationOut(BaseModel):
    id: int
    user_id: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_avatar: Optional[str] = None
    notification_type: str
    title: str
    message: str
    reference_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- AI Chat & Memories ---
class AIChatRequest(BaseModel):
    message: Optional[str] = None
    content: Optional[str] = None
    api_key: Optional[str] = None
    role_context: Optional[str] = None
    store_information: Optional[bool] = False
    store_as_info: Optional[bool] = False
    category: Optional[str] = "general"

class AIMemoryCreate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    message: Optional[str] = None
    category: Optional[str] = "general"

class AIMemoryOut(BaseModel):
    id: int
    user_id: str
    title: Optional[str] = None
    content: str
    category: str
    created_at: datetime

    class Config:
        from_attributes = True

class AIMessageOut(BaseModel):
    id: int
    sender: str
    content: str
    is_memory_trigger: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True