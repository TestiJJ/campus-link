import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, TIMESTAMP, Text, Float, Integer, DateTime, text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone_number = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('student', 'business', 'admin'), default='student', nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))


class UserVerification(Base):
    __tablename__ = "user_verifications"

    user_id = Column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    is_email_verified = Column(Boolean, default=False)
    is_student_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    is_cac_verified = Column(Boolean, default=False)


class Listing(Base):
    __tablename__ = "listings"

    listing_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)  # e.g., Textbooks, Electronics, Housing
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Changed from Integer to String(36) to match User.user_id UUID
    owner_id = Column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    owner = relationship("User")