# seed_v1_data.py
import database, models, auth
from datetime import datetime

def seed():
    db = database.SessionLocal()
    print("Seeding CampusLink V1 Admin, Vendors, Products, Services, and Reels...")

    # 1. Create or ensure Admin account
    admin_email = "admin@campuslink.ng"
    admin_user = db.query(models.User).filter_by(email=admin_email).first()
    if not admin_user:
        admin_user = models.User(
            full_name="CampusLink Super Admin",
            email=admin_email,
            phone_number="+2348000000000",
            password_hash=auth.hash_password("Admin2026!"),
            role="admin",
            university_id=23,  # UNILAG
            is_email_verified=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        print("[OK] Created Super Admin: admin@campuslink.ng (Password: Admin2026!)")

    # 2. Seed Expanded Categories
    V1_CATEGORIES = [
        {"name": "Food & Meals", "icon": "Utensils", "description": "Hostel meals, fast food, snacks & drinks"},
        {"name": "Fashion & Shoes", "icon": "ShoppingBag", "description": "Sneakers, vintage thrift, hoodies & accessories"},
        {"name": "Laptops & Gadgets", "icon": "Laptop", "description": "Chargers, powerbanks, laptops & phones"},
        {"name": "Academic Services", "icon": "BookOpen", "description": "Textbooks, printing, binding & tutorials"},
        {"name": "Laundry & Cleaning", "icon": "Sparkles", "description": "Hostel pickup & fold express services"},
        {"name": "Photography & Media", "icon": "Camera", "description": "Graduation, birthday & event shoots"},
        {"name": "Phone & PC Repairs", "icon": "Wrench", "description": "Screen replacement, software flashing"},
        {"name": "Hair Styling & Beauty", "icon": "Scissors", "description": "Hostel barbers, braided styles & nails"}
    ]
    for c in V1_CATEGORIES:
        cat = db.query(models.Category).filter_by(name=c["name"]).first()
        if not cat:
            db.add(models.Category(name=c["name"], icon=c["icon"], description=c["description"]))
        else:
            cat.icon = c["icon"]
    db.commit()

    # 2b. Seed Verified Demo Student
    student_email = "student@campuslink.ng"
    student_user = db.query(models.User).filter_by(email=student_email).first()
    if not student_user:
        student_user = models.User(
            full_name="Chidinma Okeke",
            email=student_email,
            phone_number="+2348087654321",
            profile_picture_url="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80",
            password_hash=auth.hash_password("Student2026!"),
            role="student",
            university_id=23,
            department="Computer Science",
            level="300L",
            hostel="Moremi Hall Room B12",
            matric_number="190408042",
            is_email_verified=True
        )
        db.add(student_user)
        db.commit()
        db.refresh(student_user)
        print("[OK] Created Verified Student: student@campuslink.ng (Password: Student2026!)")
    else:
        if not student_user.profile_picture_url:
            student_user.profile_picture_url = "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80"
            db.commit()

    # Additional Campus Peers
    peer1 = db.query(models.User).filter_by(email="chioma.cs@campuslink.ng").first()
    if not peer1:
        peer1 = models.User(
            full_name="Chioma Adeleke",
            email="chioma.cs@campuslink.ng",
            phone_number="+2348031122334",
            profile_picture_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
            password_hash=auth.hash_password("Student2026!"),
            role="student",
            university_id=23,
            department="Mass Communication",
            level="400L",
            hostel="Fagunwa Hall Room 14",
            matric_number="180402011",
            is_email_verified=True
        )
        db.add(peer1)
    else:
        if not peer1.profile_picture_url:
            peer1.profile_picture_url = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80"

    peer2 = db.query(models.User).filter_by(email="ibrahim.law@campuslink.ng").first()
    if not peer2:
        peer2 = models.User(
            full_name="Ibrahim Danjuma",
            email="ibrahim.law@campuslink.ng",
            phone_number="+2348059988776",
            profile_picture_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
            password_hash=auth.hash_password("Student2026!"),
            role="student",
            university_id=23,
            department="Faculty of Law",
            level="200L",
            hostel="Jaja Hall Room C5",
            matric_number="210403055",
            is_email_verified=True
        )
        db.add(peer2)
    else:
        if not peer2.profile_picture_url:
            peer2.profile_picture_url = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80"
    db.commit()

    # 3. Seed Verified Vendor: Campus Kicks
    vkicks_email = "kicks@campuslink.ng"
    vkicks_user = db.query(models.User).filter_by(email=vkicks_email).first()
    if not vkicks_user:
        vkicks_user = models.User(
            full_name="Segun Adebayo",
            email=vkicks_email,
            phone_number="+2348091112233",
            password_hash=auth.hash_password("Vendor2026!"),
            role="vendor",
            university_id=23,
            department="Creative Arts",
            level="400L",
            hostel="SUB Block A",
            is_email_verified=True
        )
        db.add(vkicks_user)
        db.commit()
        db.refresh(vkicks_user)

    vkicks_vendor = db.query(models.Vendor).filter_by(user_id=vkicks_user.user_id).first()
    if not vkicks_vendor:
        vkicks_vendor = models.Vendor(
            user_id=vkicks_user.user_id,
            business_name="Campus Kicks UNILAG",
            business_description="Premium grade campus sneakers, slides & vintage thrift items. Pickup at SUB Quad.",
            category_id=2,
            university_id=23,
            location="SUB Shopping Complex Shop 12",
            phone="+2348091112233",
            email=vkicks_email,
            verification_status="verified",
            id_card_front="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80",
            id_card_back="https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=600&q=80"
        )
        db.add(vkicks_vendor)
        db.commit()
        db.refresh(vkicks_vendor)

    # 4. Seed Verified Vendor: Mama Tee Cafeteria
    vfood_email = "mamatee@campuslink.ng"
    vfood_user = db.query(models.User).filter_by(email=vfood_email).first()
    if not vfood_user:
        vfood_user = models.User(
            full_name="Theresa Okafor",
            email=vfood_email,
            phone_number="+2348035557788",
            password_hash=auth.hash_password("Vendor2026!"),
            role="vendor",
            university_id=23,
            hostel="New Hall Cafeteria",
            is_email_verified=True
        )
        db.add(vfood_user)
        db.commit()
        db.refresh(vfood_user)

    vfood_vendor = db.query(models.Vendor).filter_by(user_id=vfood_user.user_id).first()
    if not vfood_vendor:
        vfood_vendor = models.Vendor(
            user_id=vfood_user.user_id,
            business_name="Mama Tee Hot Kitchen",
            business_description="Fresh hot jollof, fried rice, peppered turkey & plantain delivered to your hostel room in 20 mins.",
            category_id=1,
            university_id=23,
            location="New Hall Food Court",
            phone="+2348035557788",
            email=vfood_email,
            verification_status="verified",
            id_card_front="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
            id_card_back="https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=600&q=80"
        )
        db.add(vfood_vendor)
        db.commit()
        db.refresh(vfood_vendor)

    # 5. Seed PENDING Vendor for Admin Verification Demo: Tunde Gadgets
    vpend_email = "tunde.gadgets@campuslink.ng"
    vpend_user = db.query(models.User).filter_by(email=vpend_email).first()
    if not vpend_user:
        vpend_user = models.User(
            full_name="Tunde Bakare",
            email=vpend_email,
            phone_number="+2348024446688",
            password_hash=auth.hash_password("Vendor2026!"),
            role="vendor",
            university_id=23,
            department="Computer Engineering",
            level="300L",
            hostel="Mariere Hall",
            is_email_verified=True
        )
        db.add(vpend_user)
        db.commit()
        db.refresh(vpend_user)

    vpend_vendor = db.query(models.Vendor).filter_by(user_id=vpend_user.user_id).first()
    if not vpend_vendor:
        vpend_vendor = models.Vendor(
            user_id=vpend_user.user_id,
            business_name="Tunde Gadget Repairs & Accessories",
            business_description="Laptop chargers, battery replacements, iPhone screen fix. Fast student rates.",
            category_id=7,
            university_id=23,
            location="Mariere Hall Stall 3",
            phone="+2348024446688",
            email=vpend_email,
            verification_status="pending",
            id_card_front="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
            id_card_back="https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=600&q=80"
        )
        db.add(vpend_vendor)
        db.commit()
        print("[OK] Created Pending Vendor: Tunde Gadgets awaiting Admin verification")

    # 6. Seed Sample Products from Verified Vendors
    if db.query(models.Product).count() == 0:
        db.add_all([
            models.Product(
                vendor_id=vkicks_vendor.id,
                name="Nike Air Force 1 '07 - Triple White",
                description="Brand new box pack, sizes 41-45 available. Safe pickup at SUB Quad.",
                price=26500.0,
                category_id=2,
                university_id=23,
                image="https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80",
                quantity=8,
                status="available"
            ),
            models.Product(
                vendor_id=vkicks_vendor.id,
                name="Vintage Oversized Graphic Hoodie",
                description="Heavyweight fleece cotton, unisex fit, warm for cold library study nights.",
                price=14000.0,
                category_id=2,
                university_id=23,
                image="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
                quantity=15,
                status="available"
            ),
            models.Product(
                vendor_id=vpend_vendor.id,
                name="Apple MacBook Pro Retina 13\" (16GB RAM / 512GB SSD)",
                description="Space Gray, Cycle Count 140, Battery Health 94%. Comes with original 61W USB-C charger and protective hard case. Campus inspection available.",
                price=245000.0,
                category_id=3,
                university_id=23,
                image="https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80",
                quantity=1,
                status="available"
            ),
            models.Product(
                vendor_id=vpend_vendor.id,
                name="Rechargeable High-Velocity Hostel Study Desk Fan (LED Lamp)",
                description="Built-in 10,000mAh battery for night study sessions during power cuts. 4 speed levels, whisper quiet, emergency LED night light.",
                price=29000.0,
                category_id=3,
                university_id=23,
                image="https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80",
                quantity=10,
                status="available"
            )
        ])
        db.commit()
        print("[OK] Seeded Marketplace Products")

    # 7. Seed Sample Services
    if db.query(models.Service).count() == 0:
        db.add_all([
            models.Service(
                vendor_id=vkicks_vendor.id,
                name="Professional Sneaker Deep Cleaning & Restoration",
                description="Stain removal, sole whitening & deodorizing. 24-hour turnaround.",
                price=3000.0,
                category_id=5,
                university_id=23,
                location="SUB Quad Shop 12",
                image="https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80",
                availability="available"
            ),
            models.Service(
                vendor_id=vkicks_vendor.id,
                name="Final Year Project Hardcover Binding & Printing",
                description="Standard faculty approved hardcover binding with gold foil embossing & laser printing.",
                price=1500.0,
                category_id=4,
                university_id=23,
                location="Central Library Walkway",
                image="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
                availability="available"
            )
        ])
        db.commit()
        print("[OK] Seeded Campus Services")

    # 8. Seed TikTok / Campus Reels
    if db.query(models.Reel).count() == 0:
        db.add_all([
            models.Reel(
                user_id=vkicks_user.user_id,
                vendor_id=vkicks_vendor.id,
                title="New Sneaker Drop at SUB Quad",
                description="Fresh batch of Triple White Air Force 1s just landed at our stall. Come try your size!",
                media_url="https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80",
                media_type="image",
                location="UNILAG SUB Quad",
                likes_count=42
            ),
            models.Reel(
                user_id=vfood_user.user_id,
                vendor_id=vfood_vendor.id,
                title="Smokey Jollof Ready for Lunch",
                description="Cooking the big pot for afternoon exam rush. Who is ordering room delivery?",
                media_url="https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
                media_type="image",
                location="New Hall Food Court",
                likes_count=89
            ),
            models.Reel(
                user_id=admin_user.user_id,
                vendor_id=None,
                title="Night Study Vibes at Main Library",
                description="Semester exams are in 2 weeks! The library quad is packed tonight. Stay focused guys!",
                media_url="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80",
                media_type="image",
                location="Main Campus Library Steps",
                likes_count=134
            )
        ])
        db.commit()
        print("[OK] Seeded Campus Reels")
    else:
        # Clean titles of any existing reels
        all_reels = db.query(models.Reel).all()
        for r in all_reels:
            for em in ['🔥', '🍛', '📚', '✨']:
                if em in r.title:
                    r.title = r.title.replace(em, '').strip()
        db.commit()

    print("Database seeding completed successfully!")

    print("Database seeding completed successfully!")
    db.close()

if __name__ == "__main__":
    seed()
