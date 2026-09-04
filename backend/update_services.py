import sqlite3

conn = sqlite3.connect('backend/campuslink.db')
c = conn.cursor()

c.execute("UPDATE services SET image = 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=800&q=80' WHERE id = 1")
c.execute("UPDATE services SET image = 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80' WHERE id = 2")

c.execute("""
INSERT OR REPLACE INTO services (id, vendor_id, name, description, price, category_id, university_id, location, image, availability, created_at)
VALUES 
(5, 1, 'Executive Campus Barbering & Styling', 'Clean fades, beard sculpting and hair treatment right on campus.', 2000.0, 14, 23, 'SUB Complex Shop 4', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80', 'available', datetime('now')),
(6, 2, 'Engineering & Science 1-on-1 Tutoring', 'Exam prep for Calculus, Physics & Circuit Theory with past question walkthroughs.', 3500.0, 10, 23, 'University Library Wing B', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80', 'available', datetime('now'))
""")
conn.commit()
print("Services successfully updated in DB:")
c.execute("SELECT id, name, price, location, image FROM services")
for r in c.fetchall():
    print(r)
conn.close()
