from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# XAMPP MySQL Default Credentials (no password by default)
DATABASE_URL = "mysql+pymysql://root:@localhost:3306/campuslink_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get database session for API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()