from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas, auth, database

# Auto-create database tables on startup
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CampusLink API")

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "CampusLink API is live!"}

@app.post("/api/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    existing_email = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered")

    existing_phone = db.query(models.User).filter(models.User.phone_number == user_data.phone_number).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number is already registered")

    hashed_pwd = auth.hash_password(user_data.password)
    new_user = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=hashed_pwd,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    verification_record = models.UserVerification(user_id=new_user.user_id)
    db.add(verification_record)
    db.commit()

    return new_user

@app.post("/api/login", response_model=schemas.Token)
def login_user(credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access_token = auth.create_access_token(data={"sub": user.user_id, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/listings", response_model=list[schemas.ListingOut])
def get_all_listings(db: Session = Depends(database.get_db)):
    return db.query(models.Listing).order_by(models.Listing.created_at.desc()).all()

@app.post("/api/listings", response_model=schemas.ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    listing_data: schemas.ListingCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Authenticated from JWT Bearer token
):
    new_listing = models.Listing(
        title=listing_data.title,
        description=listing_data.description,
        price=listing_data.price,
        category=listing_data.category,
        owner_id=current_user.user_id  # Tied directly to the active user's UUID
    )
    db.add(new_listing)
    db.commit()
    db.refresh(new_listing)
    return new_listing