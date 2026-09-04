import sqlite3, re

conn = sqlite3.connect('campuslink.db')
cursor = conn.cursor()

emoji_pattern = re.compile(
    '[\U00010000-\U0010ffff]'
    '|[\u2600-\u27BF]'
    '|[\u2B50-\u2B55]'
    '|[\u203C-\u2049]'
    '|[\u25AA-\u25FE]'
    '|[★✓✕●⏱📍💬📸🍔👗📚💄👟🛠🛒😊🔥✨🎉💡👍❤💯]',
    flags=re.UNICODE
)

def clean_text(text):
    if not text:
        return text
    return emoji_pattern.sub('', text).strip()

# 1. Update Categories
CATEGORY_ICONS = {
    "Food & Snacks": "Utensils",
    "Food & Meals": "Utensils",
    "Fashion & Apparel": "ShoppingBag",
    "Fashion & Shoes": "ShoppingBag",
    "Electronics & Gadgets": "Laptop",
    "Laptops & Gadgets": "Laptop",
    "Services & Skills": "Wrench",
    "Phone & PC Repairs": "Wrench",
    "Books & Stationery": "BookOpen",
    "Academic Services": "BookOpen",
    "Laundry & Cleaning": "Sparkles",
    "Beauty & Personal Care": "Scissors",
    "Hair Styling & Beauty": "Scissors",
    "Photography & Media": "Camera"
}

for row in cursor.execute("SELECT id, name, icon, description FROM categories").fetchall():
    cat_id, name, icon, desc = row
    new_name = clean_text(name)
    new_desc = clean_text(desc)
    new_icon = CATEGORY_ICONS.get(new_name, "ShoppingBag")
    cursor.execute("UPDATE categories SET name = ?, icon = ?, description = ? WHERE id = ?", (new_name, new_icon, new_desc, cat_id))

# 2. Update Reels
for row in cursor.execute("SELECT id, title, description FROM reels").fetchall():
    reel_id, title, desc = row
    new_title = clean_text(title)
    new_desc = clean_text(desc)
    cursor.execute("UPDATE reels SET title = ?, description = ? WHERE id = ?", (new_title, new_desc, reel_id))

# 3. Update Products
for row in cursor.execute("SELECT id, name, description FROM products").fetchall():
    p_id, name, desc = row
    new_name = clean_text(name)
    new_desc = clean_text(desc)
    cursor.execute("UPDATE products SET name = ?, description = ? WHERE id = ?", (new_name, new_desc, p_id))

# 4. Update Services
for row in cursor.execute("SELECT id, name, description FROM services").fetchall():
    s_id, name, desc = row
    new_name = clean_text(name)
    new_desc = clean_text(desc)
    cursor.execute("UPDATE services SET name = ?, description = ? WHERE id = ?", (new_name, new_desc, s_id))

# 5. Update Student profile picture URLs with real photos if missing
STUDENT_PHOTOS = {
    "student@campuslink.ng": "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80",
    "chioma.cs@campuslink.ng": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
    "ibrahim.law@campuslink.ng": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80"
}

for email, photo in STUDENT_PHOTOS.items():
    cursor.execute("UPDATE users SET profile_picture_url = ? WHERE email = ? AND (profile_picture_url IS NULL OR profile_picture_url = '')", (photo, email))

conn.commit()
print("DATABASE CLEANUP COMPLETED: All categories, reels, products, services updated without emojis, and real student profile photos set!")
conn.close()
