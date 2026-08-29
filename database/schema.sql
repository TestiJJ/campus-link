CREATE DATABASE IF NOT EXISTS campuslink_db;
USE campuslink_db;

-- 1. Users Table
CREATE TABLE users (
    user_id CHAR(36) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'business', 'admin') NOT NULL DEFAULT 'student',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Verifications Table
CREATE TABLE user_verifications (
    user_id CHAR(36) PRIMARY KEY,
    is_email_verified TINYINT(1) DEFAULT 0,
    is_student_verified TINYINT(1) DEFAULT 0,
    is_phone_verified TINYINT(1) DEFAULT 0,
    is_cac_verified TINYINT(1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Listings Table
CREATE TABLE listings (
    listing_id CHAR(36) PRIMARY KEY,
    seller_id CHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category ENUM('fashion', 'food', 'gadgets', 'tutors', 'services', 'other') NOT NULL,
    image_url VARCHAR(550) NULL,
    status ENUM('active', 'pending_approval', 'sold', 'removed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Security Audit Logs Table
CREATE TABLE security_audit_logs (
    log_id CHAR(36) PRIMARY KEY,
    actor_id CHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    target_id CHAR(36) NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;