import os
import sys
import sqlite3
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect, Boolean
from datetime import datetime

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

SUPABASE_URL = os.getenv("DATABASE_URL") or "postgresql+psycopg2://postgres.vaevyoagenaptmjxfzmp:Ajibola2007%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

if SUPABASE_URL.startswith("postgres://"):
    SUPABASE_URL = SUPABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif SUPABASE_URL.startswith("postgresql://") and "+psycopg2" not in SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

print("[Migration] Connecting to Supabase PostgreSQL...")
try:
    target_engine = create_engine(SUPABASE_URL, pool_pre_ping=True)
    with target_engine.connect() as conn:
        ver = conn.execute(text("SELECT version();")).fetchone()[0]
        print(f"[Migration] Connected to Supabase successfully: {ver[:40]}...")
except Exception as e:
    print(f"[Migration] Connection error: {e}")
    sys.exit(1)

# Import models and create all tables
sys.path.append(os.path.dirname(__file__))
import models
print("[Migration] Creating all tables on Supabase...")
models.Base.metadata.create_all(bind=target_engine)
print("[Migration] Tables created successfully.")

# SQLite source database
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "campuslink.db")
if not os.path.exists(SQLITE_PATH):
    print(f"[Migration] Source SQLite file not found at {SQLITE_PATH}")
    sys.exit(1)

sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row

# Table order respects foreign key constraints
TABLE_ORDER = [
    "universities",
    "categories",
    "users",
    "vendors",
    "products",
    "services",
    "reels",
    "reel_likes",
    "reel_comments",
    "posts",
    "orders",
    "rides",
    "reports",
    "reviews",
    "favorites",
    "friendships",
    "messages",
    "notifications",
    "campus_statuses",
    "campus_notices",
    "campus_eateries",
    "ai_memories",
    "ai_messages"
]

# Identify all boolean columns from SQLAlchemy models
bool_columns = {}
for t in models.Base.metadata.tables.values():
    bool_columns[t.name] = set([c.name for c in t.columns if isinstance(c.type, Boolean)])

def parse_val(table_name, col_name, v):
    if v is None:
        return None
    # Boolean conversion
    if col_name in bool_columns.get(table_name, set()):
        return bool(v)
    # Datetime conversion
    if isinstance(v, str) and len(v) >= 19:
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(v, fmt)
            except ValueError:
                pass
    return v

inspector = inspect(target_engine)
existing_tables = inspector.get_table_names()

for table in TABLE_ORDER:
    if table not in existing_tables:
        print(f"[Migration] Table {table} does not exist in target database. Skipping.")
        continue

    # Independent connection per table to isolate transactions
    with target_engine.connect() as pg_conn:
        target_count = pg_conn.execute(text(f"SELECT COUNT(*) FROM {table};")).scalar()
        if target_count > 0:
            print(f"[Migration] Table '{table}' already has {target_count} rows. Skipping transfer.")
            continue

    # Fetch rows from SQLite
    try:
        cursor = sqlite_conn.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        print(f"[Migration] Table '{table}' not present in SQLite database. Skipping.")
        continue

    if not rows:
        print(f"[Migration] Table '{table}' is empty in SQLite.")
        continue

    columns = [col[0] for col in cursor.description]
    col_names = ", ".join(columns)
    placeholders = ", ".join([f":{col}" for col in columns])
    insert_stmt = text(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})")

    records = []
    for r in rows:
        row_dict = {}
        for col in columns:
            row_dict[col] = parse_val(table, col, r[col])
        records.append(row_dict)

    try:
        with target_engine.begin() as pg_conn:
            pg_conn.execute(insert_stmt, records)
        print(f"[Migration] Successfully migrated {len(records)} rows into '{table}'.")
    except Exception as err:
        print(f"[Migration] Bulk insert error on '{table}': {err}")
        success_count = 0
        for record in records:
            try:
                with target_engine.begin() as pg_conn:
                    pg_conn.execute(insert_stmt, record)
                success_count += 1
            except Exception as row_err:
                print(f"  [Row Error on {table}] {row_err}")
        print(f"[Migration] Recovered: {success_count}/{len(records)} inserted into '{table}'.")

sqlite_conn.close()
print("[Migration] ALL MIGRATIONS COMPLETED!")
