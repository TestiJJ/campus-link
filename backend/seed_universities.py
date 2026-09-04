from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

# Complete list of Institutions
NIGERIAN_INSTITUTIONS = [
    # Federal Universities
    {"name": "Ahmadu Bello University, Zaria", "state": "Kaduna", "type": "Federal"},
    {"name": "Bayero University, Kano", "state": "Kano", "type": "Federal"},
    {"name": "Federal University of Agriculture, Abeokuta", "state": "Ogun", "type": "Federal"},
    {"name": "Federal University of Technology, Akure", "state": "Ondo", "type": "Federal"},
    {"name": "Federal University of Technology, Minna", "state": "Niger", "type": "Federal"},
    {"name": "Federal University of Technology, Owerri", "state": "Imo", "type": "Federal"},
    {"name": "Federal University, Oye-Ekiti", "state": "Ekiti", "type": "Federal"},
    {"name": "Nnamdi Azikiwe University, Awka", "state": "Anambra", "type": "Federal"},
    {"name": "Obafemi Awolowo University, Ile-Ife", "state": "Osun", "type": "Federal"},
    {"name": "University of Abuja", "state": "FCT", "type": "Federal"},
    {"name": "University of Benin", "state": "Edo", "type": "Federal"},
    {"name": "University of Calabar", "state": "Cross River", "type": "Federal"},
    {"name": "University of Ibadan", "state": "Oyo", "type": "Federal"},
    {"name": "University of Ilorin", "state": "Kwara", "type": "Federal"},
    {"name": "University of Jos", "state": "Plateau", "type": "Federal"},
    {"name": "University of Lagos", "state": "Lagos", "type": "Federal"},
    {"name": "University of Maiduguri", "state": "Borno", "type": "Federal"},
    {"name": "University of Nigeria, Nsukka", "state": "Enugu", "type": "Federal"},
    {"name": "University of Port Harcourt", "state": "Rivers", "type": "Federal"},
    {"name": "University of Uyo", "state": "Akwa Ibom", "type": "Federal"},

    # State Universities
    {"name": "Adekunle Ajasin University, Akungba-Akoko", "state": "Ondo", "type": "State"},
    {"name": "Ambrose Alli University, Ekpoma", "state": "Edo", "type": "State"},
    {"name": "Ekiti State University, Ado-Ekiti", "state": "Ekiti", "type": "State"},
    {"name": "Kwara State University, Malete", "state": "Kwara", "type": "State"},
    {"name": "Ladoke Akintola University of Technology", "state": "Oyo", "type": "State"},
    {"name": "Lagos State University, Ojo", "state": "Lagos", "type": "State"},
    {"name": "Olabisi Onabanjo University, Ago-Iwoye", "state": "Ogun", "type": "State"},
    {"name": "Osun State University, Osogbo", "state": "Osun", "type": "State"},
    {"name": "Rivers State University", "state": "Rivers", "type": "State"},

    # Private Universities
    {"name": "Afe Babalola University, Ado-Ekiti", "state": "Ekiti", "type": "Private"},
    {"name": "Ajayi Crowther University, Oyo", "state": "Oyo", "type": "Private"},
    {"name": "Babcock University, Ilishan-Remo", "state": "Ogun", "type": "Private"},
    {"name": "Bells University of Technology, Ota", "state": "Ogun", "type": "Private"},
    {"name": "Bowen University, Iwo", "state": "Osun", "type": "Private"},
    {"name": "Covenant University, Ota", "state": "Ogun", "type": "Private"},
    {"name": "Lead City University, Ibadan", "state": "Oyo", "type": "Private"},
    {"name": "Mountain Top University", "state": "Ogun", "type": "Private"},
    {"name": "Nile University of Nigeria, Abuja", "state": "FCT", "type": "Private"},
    {"name": "Redeemer's University, Ede", "state": "Osun", "type": "Private"},

    # Polytechnics & Colleges
    {"name": "Auchi Polytechnic", "state": "Edo", "type": "Polytechnic"},
    {"name": "Federal Polytechnic, Ilaro", "state": "Ogun", "type": "Polytechnic"},
    {"name": "Federal Polytechnic, Offa", "state": "Kwara", "type": "Polytechnic"},
    {"name": "Kaduna Polytechnic", "state": "Kaduna", "type": "Polytechnic"},
    {"name": "Kwara State Polytechnic, Ilorin", "state": "Kwara", "type": "Polytechnic"},
    {"name": "Moshood Abiola Polytechnic, Abeokuta", "state": "Ogun", "type": "Polytechnic"},
    {"name": "The Polytechnic, Ibadan", "state": "Oyo", "type": "Polytechnic"},
    {"name": "Yaba College of Technology, Lagos", "state": "Lagos", "type": "Polytechnic"}
]

# Marketplace Categories
DEFAULT_CATEGORIES = [
    {"name": "Food & Snacks", "icon": "Utensils", "description": "Meals, pastries, drinks, and snacks on campus"},
    {"name": "Fashion & Apparel", "icon": "ShoppingBag", "description": "Clothing, footwear, bags, and accessories"},
    {"name": "Electronics & Gadgets", "icon": "Laptop", "description": "Phones, laptops, accessories, and repairs"},
    {"name": "Services & Skills", "icon": "Wrench", "description": "Graphics design, typing, laundry, hair styling"},
    {"name": "Books & Stationery", "icon": "BookOpen", "description": "Textbooks, notebooks, and academic materials"},
    {"name": "Beauty & Personal Care", "icon": "Sparkles", "description": "Skincare, cosmetics, and grooming products"}
]

def seed_database():
    print("Seeding Nigerian Universities, Polytechnics & Marketplace Categories...")
    db: Session = SessionLocal()
    
    try:
        models.Base.metadata.create_all(bind=engine)
        
        # 1. Seed Institutions
        uni_count = 0
        for item in NIGERIAN_INSTITUTIONS:
            existing = db.query(models.University).filter(models.University.name == item["name"]).first()
            if not existing:
                uni = models.University(
                    name=item["name"],
                    state=item.get("state", "Nigeria"),
                    type=item.get("type", "Public")
                )
                db.add(uni)
                uni_count += 1

        # 2. Seed Categories
        cat_count = 0
        for cat in DEFAULT_CATEGORIES:
            existing_cat = db.query(models.Category).filter(models.Category.name == cat["name"]).first()
            if not existing_cat:
                category_entry = models.Category(
                    name=cat["name"],
                    icon=cat["icon"],
                    description=cat["description"]
                )
                db.add(category_entry)
                cat_count += 1

        db.commit()
        print(f"Successfully seeded {uni_count} institutions and {cat_count} categories into database!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()