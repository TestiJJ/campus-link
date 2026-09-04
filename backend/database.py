from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

MYSQL_URL = "mysql+pymysql://root:@localhost:3306/campuslink_db"
import os
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campuslink.db")
SQLITE_URL = f"sqlite:///{DB_PATH}"

# Automatic database fallback: Use MySQL if XAMPP/MySQL service is running, otherwise use SQLite
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
    print("[Database] MySQL not reachable on port 3306. Using resilient local SQLite database (campuslink.db).")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get database session for API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()