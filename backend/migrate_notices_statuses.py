import sqlite3
from datetime import datetime, timedelta
import database
import models

def run_migration():
    # 1. Create missing tables
    models.Base.metadata.create_all(bind=database.engine)
    print("Tables verified via SQLAlchemy metadata.")

    # 2. Add columns to messages table if needed
    conn = sqlite3.connect("campuslink.db")
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(messages)")
    cols = [row[1] for row in cursor.fetchall()]

    if "message_type" not in cols:
        cursor.execute("ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text'")
        print("Added message_type column to messages.")
    if "media_url" not in cols:
        cursor.execute("ALTER TABLE messages ADD COLUMN media_url VARCHAR(550)")
        print("Added media_url column to messages.")
    if "duration" not in cols:
        cursor.execute("ALTER TABLE messages ADD COLUMN duration INTEGER")
        print("Added duration column to messages.")

    conn.commit()
    conn.close()

    # 3. Seed real notices
    db = database.SessionLocal()
    u = db.query(models.User).filter_by(university_id=23).first()
    if not u:
        u = db.query(models.User).first()

    count = db.query(models.CampusNotice).count()
    print("Current notices count:", count)
    if count == 0:
        sample_notices = [
            models.CampusNotice(
                university_id=u.university_id or 23,
                user_id=u.user_id,
                type="lost",
                title="Lost EKSU Student Matric ID Card (Babatunde Ojo)",
                category="id_card",
                description="I lost my plastic Student ID card around Faculty of Science LT 2 after the CSC 301 morning test. Please call or message if found!",
                location="Faculty of Science Lecture Theatre 2",
                date_lost_or_found="Today at 10:30 AM",
                contact_phone="+2348035557788",
                image_url=None,
                status="open"
            ),
            models.CampusNotice(
                university_id=u.university_id or 23,
                user_id=u.user_id,
                type="found",
                title="Found Bunch of Room Keys with Blue Lanyard & Whistle",
                category="keys",
                description="Picked up a bunch of 4 keys with a blue whistle lanyard left on the concrete seat outside the SUB cafeteria. Owner can call to identify key markings.",
                location="Student Union Building (SUB) Food Walk",
                date_lost_or_found="Yesterday afternoon",
                contact_phone="+2348146538644",
                image_url=None,
                status="open"
            ),
            models.CampusNotice(
                university_id=u.university_id or 23,
                user_id=u.user_id,
                type="announcement",
                title="SUG Townhall Meeting: Campus Power & Hostel Maintenance",
                category="announcement",
                description="All hall reps, faculty presidents, and students are invited to the open townhall session with the Dean of Student Affairs regarding the generator schedule and water pumps.",
                location="Campus Amphitheatre / Main Auditorium",
                date_lost_or_found="Tomorrow, 2:00 PM Prompt",
                contact_phone="+2348090165942",
                image_url=None,
                status="open"
            ),
            models.CampusNotice(
                university_id=u.university_id or 23,
                user_id=u.user_id,
                type="lost",
                title="Lost HP 65W Laptop Charger (Blue Pin)",
                category="phone_gadget",
                description="Forgotten near the wall socket on the second floor of the Main Library reading hall. Black cable with white tape around the adapter.",
                location="Main Campus Library 2nd Floor",
                date_lost_or_found="2 days ago during night study",
                contact_phone="+2348033783421",
                image_url=None,
                status="open"
            ),
            models.CampusNotice(
                university_id=u.university_id or 23,
                user_id=u.user_id,
                type="found",
                title="Found Brown Leather Wallet with GTBank Card & Cash",
                category="wallet_atm",
                description="Found on the spectator bench at the University Sports Complex after the inter-faculty football match. Owner must bring proof of identity.",
                location="University Sports Complex Pavilion",
                date_lost_or_found="Yesterday, 6:00 PM",
                contact_phone="+2348055667788",
                image_url=None,
                status="open"
            )
        ]
        db.add_all(sample_notices)
        db.commit()
        print("Seeded 5 authentic campus notices successfully.")

    # 4. Seed status stories
    st_count = db.query(models.CampusStatus).count()
    print("Current statuses count:", st_count)
    if st_count == 0:
        st1 = models.CampusStatus(
            university_id=u.university_id or 23,
            user_id=u.user_id,
            media_type="text",
            caption="CSC 304 test was something else today! Group study tonight at SUB 📚🔥",
            background_color="from-purple-600 to-indigo-800",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(st1)
        db.commit()
        print("Seeded sample status story successfully.")

    db.close()

if __name__ == "__main__":
    run_migration()
