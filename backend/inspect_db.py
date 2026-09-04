import sqlite3

conn = sqlite3.connect('campuslink.db')
cursor = conn.cursor()

print('--- CATEGORIES ---')
for row in cursor.execute('SELECT id, name, icon FROM categories'):
    print(row)

print('\n--- REELS ---')
for row in cursor.execute('SELECT id, title FROM reels'):
    print(row)

print('\n--- USERS ---')
for row in cursor.execute("SELECT user_id, full_name, role, profile_picture_url FROM users WHERE role='student'"):
    print(row)

conn.close()
