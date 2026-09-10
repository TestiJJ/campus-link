from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class University(Base):
    __tablename__ = "universities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    abbreviation = Column(String(20), nullable=True)
    state = Column(String(100), nullable=False)
    type = Column(String(50), default="Public")  # Public | Private

    users = relationship("User", back_populates="university")
    vendors = relationship("Vendor", back_populates="university")


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="student")  # student | vendor | admin
    status = Column(String(20), default="active")  # active | suspended
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=True)
    state = Column(String(100), nullable=True)
    matric_number = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    level = Column(String(20), nullable=True)
    hostel = Column(String(100), nullable=True)
    
    # Profile customization fields
    profile_picture_url = Column(String(550), nullable=True)
    bio = Column(Text, nullable=True)
    
    # Online presence & activity tracking
    is_online = Column(Boolean, default=False, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=True)

    # Email OTP Verification fields
    is_email_verified = Column(Boolean, default=False)
    verification_code = Column(String(6), nullable=True)
    code_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    university = relationship("University", back_populates="users")
    vendor_profile = relationship("Vendor", back_populates="user", uselist=False)
    reels = relationship("Reel", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")
    orders = relationship("Order", back_populates="user")
    rides = relationship("RideBooking", back_populates="user")
    reports = relationship("Report", back_populates="reporter")

    @property
    def verification_status(self):
        if self.vendor_profile:
            return self.vendor_profile.verification_status
        return None

    @property
    def is_verified(self):
        if self.vendor_profile:
            return self.vendor_profile.verification_status == "verified"
        return False


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, unique=True)
    business_name = Column(String(255), nullable=False)
    business_description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=True)
    state = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)  # Stall location, e.g. SUB Stall 4
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    logo = Column(String(550), nullable=True)
    cover_image = Column(String(550), nullable=True)

    # Verification workflow:
    # Vendors start as 'pending' and upload front and back of their ID cards
    verification_status = Column(String(20), default="pending")  # pending | verified | rejected
    id_card_type = Column(String(50), nullable=True, default="national_id") # student_id | nin | voter_card | driver_license | graduate_cert | cac_permit
    id_card_number = Column(String(100), nullable=True)
    id_card_front = Column(String(550), nullable=True)
    id_card_back = Column(String(550), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="vendor_profile")
    university = relationship("University", back_populates="vendors")
    category = relationship("Category", back_populates="vendors")
    products = relationship("Product", back_populates="vendor")
    services = relationship("Service", back_populates="vendor")
    reels = relationship("Reel", back_populates="vendor")
    orders = relationship("Order", back_populates="vendor")
    reviews = relationship("Review", back_populates="vendor")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    icon = Column(String(50), nullable=True)  # e.g. Utensils, ShoppingBag, Laptop
    description = Column(Text, nullable=True)

    vendors = relationship("Vendor", back_populates="category")
    products = relationship("Product", back_populates="category")
    services = relationship("Service", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=True)
    image = Column(String(550), nullable=True)
    quantity = Column(Integer, default=1)
    status = Column(String(30), default="available")  # available | out_of_stock
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="products")
    category = relationship("Category", back_populates="products")
    university = relationship("University")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Float, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=True)
    location = Column(String(255), nullable=True)
    image = Column(String(550), nullable=True)
    availability = Column(String(30), default="available")  # available | busy
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="services")
    category = relationship("Category", back_populates="services")
    university = relationship("University")


class Reel(Base):
    """TikTok / Instagram style video/photo reels posted by students and vendors with location tagging"""
    __tablename__ = "reels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    media_url = Column(String(550), nullable=True)
    media_type = Column(String(20), default="text")  # video | image | text
    location = Column(String(255), nullable=True)  # Campus hotspot tag, e.g. "Library Quad"
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reels")
    vendor = relationship("Vendor", back_populates="reels")
    comments = relationship("ReelComment", back_populates="reel", cascade="all, delete-orphan", order_by="ReelComment.created_at.asc()")


class ReelComment(Base):
    __tablename__ = "reel_comments"

    id = Column(Integer, primary_key=True, index=True)
    reel_id = Column(Integer, ForeignKey("reels.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    content = Column(Text, nullable=False)
    reply_to_comment_id = Column(Integer, nullable=True)
    reply_to_author = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    reel = relationship("Reel", back_populates="comments")


class ReelLike(Base):
    __tablename__ = "reel_likes"

    id = Column(Integer, primary_key=True, index=True)
    reel_id = Column(Integer, ForeignKey("reels.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    reel = relationship("Reel")


# Keep Post model for backward compatibility with existing data
class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    price = Column(Float, nullable=True)
    image_url = Column(String(550), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    item_title = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1)
    amount = Column(Float, nullable=False)
    delivery_location = Column(String(255), nullable=True)
    status = Column(String(30), default="pending")  # pending | confirmed | completed | cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    vendor = relationship("Vendor", back_populates="orders")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    rating = Column(Integer, default=5)  # 1 to 5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reviews")
    vendor = relationship("Vendor", back_populates="reviews")


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")


class RideBooking(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    ride_type = Column(String(50), nullable=False)  # "Campus Shuttle", "Keke Napep", "Bike Express", "Campus Bolt"
    pickup_location = Column(String(255), nullable=False)
    dropoff_location = Column(String(255), nullable=False)
    estimated_fare = Column(Float, nullable=False)
    status = Column(String(30), default="driver_assigned")
    driver_name = Column(String(100), nullable=True, default="Musa Driver")
    driver_phone = Column(String(50), nullable=True, default="+234 812 345 6789")
    plate_number = Column(String(50), nullable=True, default="LAG-452-XY")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="rides")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    reported_vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending | investigating | resolved
    created_at = Column(DateTime, default=datetime.utcnow)

    reporter = relationship("User", back_populates="reports")


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    friend_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    status = Column(String(20), default="accepted")  # pending | accepted
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    recipient_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text") # text, audio, image, video
    media_url = Column(String(550), nullable=True)
    duration = Column(Integer, nullable=True) # seconds for voice note
    is_read = Column(Boolean, default=False, index=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    reply_to_sender = Column(String(100), nullable=True)
    reply_to_text = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_messages_sender_recipient", "sender_id", "recipient_id"),
        Index("ix_messages_recipient_sender", "recipient_id", "sender_id"),
        Index("ix_messages_conv_created", "sender_id", "recipient_id", "created_at"),
    )

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    reply_to = relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])


class CampusEatery(Base):
    __tablename__ = "campus_eateries"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=True)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    image = Column(String(550), nullable=True)
    specialties = Column(Text, nullable=True)
    delivery_time = Column(String(50), default="15-25 mins")
    delivery_fee = Column(String(50), default="₦300 to hostels")
    rating = Column(Float, default=4.8)
    reviews_count = Column(Integer, default=120)
    popular_brand = Column(Boolean, default=False)
    verified_on_google = Column(Boolean, default=True)
    submitted_by = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    university = relationship("University")


class CampusNotice(Base):
    __tablename__ = "campus_notices"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    type = Column(String(30), nullable=False)  # lost, found, announcement
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)  # id_card, phone_gadget, keys, wallet_atm, books, announcement, general
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=False)  # campus lecture theatre, gate, hostel, etc.
    date_lost_or_found = Column(String(100), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    image_url = Column(String(550), nullable=True)
    status = Column(String(20), default="open")  # open, claimed, resolved
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    university = relationship("University")


class CampusStatus(Base):
    __tablename__ = "campus_statuses"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    media_url = Column(String(550), nullable=True)
    media_type = Column(String(20), default="text")  # text, image, video
    caption = Column(Text, nullable=True)
    background_color = Column(String(50), default="from-emerald-600 to-teal-800")
    privacy_setting = Column(String(50), default="friends")  # friends, everyone, only_share_with
    allowed_user_ids = Column(Text, nullable=True)  # JSON or comma-separated user IDs
    viewers = Column(Text, default="[]")  # JSON string of viewer objects: [{"user_id": ..., "name": ..., "viewed_at": ...}]
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)

    __table_args__ = (
        Index("ix_campus_statuses_active", "university_id", "expires_at"),
    )

    user = relationship("User")
    university = relationship("University")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    notification_type = Column(String(50), nullable=False)  # like, comment, friend_request, friend_accept, order, status_reply, notice
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    reference_id = Column(String(100), nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_id])


class AIMemory(Base):
    __tablename__ = "ai_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # academic, reminder, personal, campus, notes
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    sender = Column(String(10), default="user")  # "user" | "ai"
    content = Column(Text, nullable=False)
    is_memory_trigger = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")