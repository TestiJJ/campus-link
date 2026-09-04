import sqlite3
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)

db_paths = [
    os.path.join(backend_dir, "campuslink.db"),
    os.path.join(root_dir, "campuslink.db"),
]

for path in db_paths:
    if os.path.exists(path):
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        cols = [c[1] for c in cur.execute("PRAGMA table_info(users)").fetchall()]
        print(f"Checking {path}: existing columns = {cols}")
        if "status" not in cols:
            cur.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
            cur.execute("UPDATE users SET status = 'active' WHERE status IS NULL")
            conn.commit()
            print(f"Successfully added 'status' column to {path}")
        else:
            cur.execute("UPDATE users SET status = 'active' WHERE status IS NULL")
            conn.commit()
            print(f"'status' column already present in {path}")
        conn.close()
    else:
        print(f"Path not found: {path}")
