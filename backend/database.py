import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

# 1. Primary: Cloud Database via DATABASE_URL
raw_db_url = os.getenv("DATABASE_URL")
if not raw_db_url and (os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID")):
    print("[Database Warning] DATABASE_URL is not set on Render. Please configure it in your Render dashboard.")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campuslink.db")
SQLITE_URL = f"sqlite:///{DB_PATH}"
MYSQL_URL = os.getenv("MYSQL_URL", "mysql+pymysql://root:@localhost:3306/campuslink_db")

engine = None
if raw_db_url and raw_db_url.strip():
    try:
        # SQLAlchemy requires postgresql:// instead of legacy postgres://
        clean_url = raw_db_url.strip()
        if clean_url.startswith("postgres://"):
            clean_url = clean_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif clean_url.startswith("postgresql://") and "+psycopg2" not in clean_url:
            clean_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        
        # Supabase pooler on port 6543 (Transaction mode) drops SSL on prepared/session queries
        # Port 5432 (Session mode) is required for stable long-running connections
        if "pooler.supabase.com:6543" in clean_url:
            clean_url = clean_url.replace("pooler.supabase.com:6543", "pooler.supabase.com:5432")
        
        # Supabase requires SSL
        if "sslmode=" not in clean_url:
            sep = "&" if "?" in clean_url else "?"
            clean_url = f"{clean_url}{sep}sslmode=require"
        
        DATABASE_URL = clean_url
        test_pg_engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=10,
            max_overflow=20,
            connect_args={"connect_timeout": 5, "sslmode": "require"}
        )
        from sqlalchemy import text as _sql_text
        with test_pg_engine.connect() as conn:
            conn.execute(_sql_text("SELECT 1"))

        engine = test_pg_engine
        safe_db_name = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "Cloud Database"
        print(f"[Database] Connected to PostgreSQL via DATABASE_URL ({safe_db_name}).")
    except Exception as pg_err:
        print(f"[Database] PostgreSQL connection failed ({pg_err}), falling back to local DB...")
        engine = None

if not engine:
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
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()