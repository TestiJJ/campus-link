import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

# Supabase Cloud Database URL (Default persistent cloud database)
DEFAULT_SUPABASE_URL = "postgresql+psycopg2://postgres.vaevyoagenaptmjxfzmp:Ajibola2007%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

# 1. Primary: Cloud Database via DATABASE_URL or Supabase default for cloud deployments
raw_db_url = os.getenv("DATABASE_URL")
if not raw_db_url and (os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID")):
    raw_db_url = DEFAULT_SUPABASE_URL

if raw_db_url and raw_db_url.strip():
    # SQLAlchemy requires postgresql:// instead of legacy postgres://
    clean_url = raw_db_url.strip()
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif clean_url.startswith("postgresql://") and "+psycopg2" not in clean_url:
        clean_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    DATABASE_URL = clean_url
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        connect_args={"connect_timeout": 10}
    )
    # Log database host safely without printing sensitive passwords
    safe_db_name = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "Cloud Database"
    print(f"[Database] Connected to PostgreSQL via DATABASE_URL ({safe_db_name}).")
else:
    # 2. Local Fallback: MySQL on localhost if running, else local SQLite
    MYSQL_URL = os.getenv("MYSQL_URL", "mysql+pymysql://root:@localhost:3306/campuslink_db")
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campuslink.db")
    SQLITE_URL = f"sqlite:///{DB_PATH}"

    try:
        test_engine = create_engine(MYSQL_URL, connect_args={"connect_timeout": 1})
        with test_engine.connect() as conn:
            pass
        DATABASE_URL = MYSQL_URL
        engine = test_engine
        print("[Database] Connected to MySQL successfully.")
    except Exception:
        DATABASE_URL = SQLITE_URL
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
        print(f"[Database] Using local SQLite database ({DB_PATH}).")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get database session for API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()