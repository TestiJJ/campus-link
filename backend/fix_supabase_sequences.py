import os
import sys
sys.path.append(os.path.dirname(__file__))
from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

tables = [
    'universities', 'categories', 'vendors', 'products', 'services', 
    'reels', 'reel_likes', 'reel_comments', 'posts', 'orders', 'rides', 
    'reports', 'reviews', 'favorites', 'friendships', 'messages', 
    'notifications', 'campus_statuses', 'campus_notices', 'campus_eateries', 
    'ai_memories', 'ai_messages'
]

print("[Supabase Sequences] Synchronizing all table sequences with max(id)...", flush=True)

for table in tables:
    try:
        max_id = db.execute(text(f'SELECT COALESCE(MAX(id), 0) FROM "{table}";')).scalar()
        seq = db.execute(text(f"SELECT pg_get_serial_sequence('{table}', 'id');")).scalar()
        if seq:
            if max_id > 0:
                db.execute(text(f"SELECT setval('{seq}', {max_id}, true);"))
            else:
                db.execute(text(f"SELECT setval('{seq}', 1, false);"))
            db.commit()
            print(f"  [OK] {table:<20} -> max_id: {max_id:<4} | seq: {seq}", flush=True)
        else:
            print(f"  [--] {table:<20} -> no sequence found", flush=True)
    except Exception as e:
        db.rollback()
        print(f"  [ERROR] {table}: {e}", flush=True)

db.close()
print("[Supabase Sequences] All sequences synchronized successfully!", flush=True)
