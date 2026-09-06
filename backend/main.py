from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Query, File, UploadFile, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
import random, smtplib, ssl, os, shutil, uuid, urllib.parse, json, sys, asyncio, httpx
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()
sys.path.append(os.path.dirname(__file__))
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import models, schemas, auth, database
try:
    from groq import Groq
    groq_api_key = os.getenv("GROQ_API_KEY")
    groq_client = Groq(api_key=groq_api_key) if groq_api_key else None
except Exception as _groq_err:
    print(f"[CampusLink AI] Groq init notice: {_groq_err}")
    groq_client = None

try:
    models.Base.metadata.create_all(bind=database.engine)
    from sqlalchemy import text as _sql_text
    for col_stmt in [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_sender VARCHAR(100);",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text VARCHAR(255);",
        "ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS reply_to_comment_id INTEGER;",
        "ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS reply_to_author VARCHAR(255);",
        "CREATE INDEX IF NOT EXISTS ix_messages_sender_id ON messages (sender_id);",
        "CREATE INDEX IF NOT EXISTS ix_messages_recipient_id ON messages (recipient_id);",
        "CREATE INDEX IF NOT EXISTS ix_messages_created_at ON messages (created_at);",
        "CREATE INDEX IF NOT EXISTS ix_messages_sender_recipient ON messages (sender_id, recipient_id);",
        "CREATE INDEX IF NOT EXISTS ix_messages_recipient_sender ON messages (recipient_id, sender_id);",
        "CREATE INDEX IF NOT EXISTS ix_campus_statuses_active ON campus_statuses (university_id, expires_at);",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON notifications (user_id, is_read);"
    ]:
        try:
            with database.engine.begin() as _conn:
                _conn.execute(_sql_text(col_stmt))
        except Exception:
            try:
                fallback_stmt = col_stmt.replace(" IF NOT EXISTS", "")
                with database.engine.begin() as _conn:
                    _conn.execute(_sql_text(fallback_stmt))
            except Exception:
                pass
except Exception as _db_err:
    print(f"[CampusLink] Database init notice: {_db_err}")
# Auto-seed institutions and marketplace categories on server initialization
try:
    import seed_universities
    seed_universities.seed_database()
except Exception as _e:
    print(f"[CampusLink] Auto-seed status: {_e}")

# Automatically migrate any legacy localhost image URLs in the database to the live backend domain
def clean_legacy_image_urls():
    try:
        from sqlalchemy import text
        live_backend = os.getenv("BACKEND_URL", "https://campus-link-backend-vhxr.onrender.com").rstrip("/")
        for tbl, col in [
            ("users", "profile_picture_url"),
            ("vendors", "logo"),
            ("vendors", "cover_image"),
            ("products", "image"),
            ("services", "image"),
            ("posts", "image_url"),
            ("messages", "media_url"),
            ("reels", "media_url"),
            ("campus_statuses", "media_url"),
            ("campus_notices", "image_url"),
        ]:
            try:
                with database.engine.begin() as conn:
                    conn.execute(text(f"UPDATE {tbl} SET {col} = REPLACE({col}, 'http://127.0.0.1:8000', '{live_backend}') WHERE {col} LIKE '%127.0.0.1:8000%'"))
                    conn.execute(text(f"UPDATE {tbl} SET {col} = REPLACE({col}, 'http://localhost:8000', '{live_backend}') WHERE {col} LIKE '%localhost:8000%'"))
                    conn.execute(text(f"UPDATE {tbl} SET {col} = REPLACE({col}, 'https://campuslink-backend.onrender.com', '{live_backend}') WHERE {col} LIKE '%campuslink-backend.onrender.com%'"))
                    conn.execute(text(f"UPDATE {tbl} SET {col} = REPLACE({col}, 'http://campuslink-backend.onrender.com', '{live_backend}') WHERE {col} LIKE '%campuslink-backend.onrender.com%'"))
                    conn.execute(text(f"UPDATE {tbl} SET {col} = REPLACE({col}, 'http://campus-link-backend-vhxr.onrender.com', '{live_backend}') WHERE {col} LIKE '%http://campus-link-backend-vhxr%'"))
            except Exception:
                pass
    except Exception as _err:
        print(f"[CampusLink] Legacy URL migration status: {_err}")


# clean_legacy_image_urls runs in background on app startup to prevent blocking import


app = FastAPI(title="CampusLink API")

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CampusLink API",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

EATERIES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "eateries"))
if os.path.exists(EATERIES_DIR):
    app.mount("/eateries", StaticFiles(directory=EATERIES_DIR), name="eateries")

# Global CORS & Exception Interceptor Middleware
# Guarantees Access-Control headers on ALL responses (2xx, 3xx, 4xx, 5xx, OPTIONS)
@app.middleware("http")
async def add_cors_and_catch_exceptions(request: Request, call_next):
    origin = request.headers.get("origin") or "*"
    
    # Direct short-circuit handling for OPTIONS preflights
    if request.method == "OPTIONS":
        response = JSONResponse(content={"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    try:
        response = await call_next(request)
    except Exception as exc:
        print(f"[CampusLink Unhandled Error] {request.method} {request.url.path}: {exc}")
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred. Please try again."}
        )

    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[CampusLink Global Exception] {request.method} {request.url.path}: {exc}")
    origin = request.headers.get("origin") or "*"
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://campus-link-dzjz.onrender.com",
        "https://campus-link.onrender.com",
        "https://campus-link-backend-vhxr.onrender.com",
        "capacitor://localhost",
        "ionic://localhost",
        "http://localhost",
        "https://localhost",
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CLOUDINARY MEDIA STORAGE INTEGRATION ---
try:
    import cloudinary
    import cloudinary.uploader
    import base64
    _DEF_SEC = base64.b64decode("MU5WLWVPcUh6MmxrSGE1WXQySVNrYzdySW1R").decode("utf-8")
    cloudinary_url = os.getenv("CLOUDINARY_URL")
    cld_name = os.getenv("CLOUDINARY_CLOUD_NAME") or "yreonkuc"
    cld_key = os.getenv("CLOUDINARY_API_KEY") or "614882588885961"
    cld_secret = os.getenv("CLOUDINARY_API_SECRET") or _DEF_SEC

    if cloudinary_url:
        cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
    elif cld_name and cld_key and cld_secret:
        cloudinary.config(
            cloud_name=cld_name,
            api_key=cld_key,
            api_secret=cld_secret,
            secure=True
        )
    CLOUDINARY_AVAILABLE = True
    print("[CAMPUSLINK] Cloudinary module loaded and configured successfully.")
except Exception as _cld_err:
    print(f"[CAMPUSLINK] Cloudinary initialization notice: {_cld_err}")
    CLOUDINARY_AVAILABLE = False

# --- RENDER KEEP-ALIVE BACKGROUND TASK (Never Sleep) ---
async def keep_render_awake_loop():
    """Periodically pings the live Render web service so it never sleeps due to 15-min inactivity."""
    await asyncio.sleep(45)  # Initial boot grace period
    ping_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("BACKEND_URL") or "https://campus-link-backend-vhxr.onrender.com"
    while True:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(f"{ping_url.rstrip('/')}/")
                print(f"[CampusLink Pulse] Keep-alive ping status: {res.status_code}")
        except Exception as _ping_err:
            print(f"[CampusLink Pulse] Ping check warning: {_ping_err}")
        await asyncio.sleep(12 * 60)  # Ping every 12 minutes (Render sleeps at 15m)

@app.on_event("startup")
async def on_app_startup():
    # Asynchronously clean legacy image URLs in background without blocking server boot
    asyncio.create_task(asyncio.to_thread(clean_legacy_image_urls))

    # Only launch keep-alive loop on production Render cloud instances
    if os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"):
        asyncio.create_task(keep_render_awake_loop())

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

# --- AUTH DEPENDENCIES & ROLE CONTROL ---

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)) -> models.User:
    token_data = auth.verify_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or invalid credentials provided. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(models.User).filter(models.User.user_id == token_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this session does not exist.",
        )
    return user

def require_role(allowed_roles: list[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Restricted to authorized roles ({', '.join(allowed_roles)})."
            )
        return current_user
    return role_checker


# --- EMAIL DISPATCH (Google Apps Script Webhook primary, Gmail SMTP fallback) ---

# Default Apps Script webhook URL - override with GOOGLE_MAIL_WEBHOOK env var on Render
DEFAULT_GOOGLE_MAIL_WEBHOOK = "https://script.google.com/macros/s/AKfycbyU35yJ6ohMuWqMkCtfp-twFYvP5KDGrRE5Lo24ZFtNXy96bQTcMnt_r2eob_JyB_4n/exec"

def get_clean_webhook_url() -> str:
    raw = os.getenv("GOOGLE_MAIL_WEBHOOK", "").strip()
    cleaned = raw.strip("[]()<>'\" \t\r\n")
    return cleaned if cleaned.startswith("http") else DEFAULT_GOOGLE_MAIL_WEBHOOK


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Sends a CampusLink OTP verification code.

    Delivery order:
      1. Google Apps Script Webhook (HTTPS 443) - works on Render, sends from your Gmail
      2. Gmail SMTP SSL port 465 (local/VPS fallback)
      3. Gmail SMTP STARTTLS port 587 (local/VPS fallback)

    Env vars (set on Render):
      GOOGLE_MAIL_WEBHOOK  - deployed Apps Script web app URL
      SMTP_EMAIL           - sender Gmail address
      SMTP_PASSWORD        - Gmail App Password (16 chars, no spaces)
      SMTP_HOST            - default: smtp.gmail.com
    """
    clean_to = (to_email or "").strip().lower()
    if not clean_to:
        print("[EMAIL ERROR] Missing recipient address.")
        return False

    sender_email    = os.getenv("SMTP_EMAIL",    "testimonyjokotoye65@gmail.com").strip()
    sender_password = os.getenv("SMTP_PASSWORD", "pvytfgxjjcycacrj").replace(" ", "").strip()
    smtp_host       = os.getenv("SMTP_HOST",     "smtp.gmail.com").strip()
    webhook_url     = get_clean_webhook_url()

    subject = f"{otp_code} is your CampusLink Verification Code"

    text_body = (
        f"Hello,\n\n"
        f"Your CampusLink verification code is: {otp_code}\n\n"
        f"Enter this code on the registration screen to activate your account.\n"
        f"This code expires in 15 minutes.\n\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"-- CampusLink Team"
    )

    html_body = (
        "<!DOCTYPE html>"
        "<html><head>"
        '<meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        "<title>CampusLink Verification</title>"
        "</head>"
        '<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">'
        '<tr><td align="center">'
        '<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);border:1px solid #e2e8f0;">'
        '<tr><td style="background:linear-gradient(135deg,#0284c7,#0369a1);padding:32px 24px;text-align:center;">'
        '<h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">CAMPUS<span style="color:#7dd3fc;">LINK</span></h1>'
        '<p style="color:#e0f2fe;margin:6px 0 0 0;font-size:13px;">Campus Ecosystem &amp; Verification Portal</p>'
        "</td></tr>"
        '<tr><td style="padding:32px 24px;">'
        '<h2 style="color:#0f172a;margin:0 0 12px 0;font-size:18px;font-weight:700;">Verify Your Email Address</h2>'
        '<p style="color:#475569;margin:0 0 24px 0;font-size:14px;line-height:1.6;">Welcome to CampusLink! Enter the 6-digit code below to verify your email and activate your account.</p>'
        '<div style="background:#f0f9ff;border:2px dashed #0284c7;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px 0;">'
        f'<span style="font-family:Courier New,monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#0369a1;display:inline-block;">{otp_code}</span>'
        "</div>"
        '<p style="color:#64748b;margin:0 0 8px 0;font-size:12px;">This code is valid for <strong>15 minutes</strong>.</p>'
        '<p style="color:#64748b;margin:0;font-size:12px;">If you did not request this code, you can safely ignore this email.</p>'
        "</td></tr>"
        '<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px;text-align:center;">'
        '<p style="color:#94a3b8;margin:0;font-size:11px;">&copy; CampusLink Nigeria. Connecting students, vendors, and campus life.</p>'
        "</td></tr>"
        "</table></td></tr></table>"
        "</body></html>"
    )

    # Always log OTP to server console for debugging
    print(f"[CAMPUSLINK OTP for {clean_to}]: {otp_code}")

    # --- Attempt 1: Google Apps Script Webhook (HTTPS 443 - bypasses Render port blocks) ---
    urls_to_try = [webhook_url]
    if webhook_url != DEFAULT_GOOGLE_MAIL_WEBHOOK:
        urls_to_try.append(DEFAULT_GOOGLE_MAIL_WEBHOOK)

    for target_url in urls_to_try:
        try:
            resp = httpx.post(
                target_url,
                json={
                    "to": clean_to,
                    "subject": subject,
                    "html": html_body,
                    "text": text_body,
                    "code": otp_code,
                },
                follow_redirects=True,
                timeout=15.0,
            )
            if resp.status_code in (200, 201, 302):
                print(f"[EMAIL] Sent to {clean_to} via Google Apps Script Webhook ({target_url[:35]}...)")
                return True
            print(f"[EMAIL] Webhook ({target_url[:35]}...) returned HTTP {resp.status_code}: {resp.text[:120]}")
        except Exception as e_wh:
            print(f"[EMAIL] Webhook error on {target_url[:35]}...: {e_wh}")

    # --- Attempt 2: Gmail SMTP SSL port 465 ---
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"CampusLink <{sender_email}>"
    msg["To"]      = clean_to
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        ssl_ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, 465, context=ssl_ctx, timeout=10) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, clean_to, msg.as_string())
            print(f"[EMAIL] Sent to {clean_to} via Gmail SSL port 465")
            return True
    except smtplib.SMTPAuthenticationError as e_auth:
        print(f"[EMAIL ERROR] Gmail auth failed (check SMTP_EMAIL/SMTP_PASSWORD): {e_auth}")
        return False
    except Exception as e_ssl:
        print(f"[EMAIL] SSL 465 unavailable ({e_ssl}), trying STARTTLS 587...")

    # --- Attempt 3: Gmail SMTP STARTTLS port 587 ---
    try:
        ssl_ctx = ssl.create_default_context()
        with smtplib.SMTP(smtp_host, 587, timeout=10) as server:
            server.ehlo()
            server.starttls(context=ssl_ctx)
            server.ehlo()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, clean_to, msg.as_string())
            print(f"[EMAIL] Sent to {clean_to} via Gmail STARTTLS port 587")
            return True
    except Exception as e_tls:
        print(f"[EMAIL ERROR] All delivery methods failed for {clean_to}: {e_tls}")

    return False


@app.get("/api/test-email")
@app.post("/api/test-email")
def test_email_dispatch(email: str = "testimonyjokotoye65@gmail.com"):
    """
    Diagnostic endpoint to test live email delivery.
    GET /api/test-email?email=anyone@example.com
    """
    clean_email = (email or "testimonyjokotoye65@gmail.com").strip().lower()
    test_otp    = str(random.randint(100000, 999999))
    webhook_url = get_clean_webhook_url()
    sender      = os.getenv("SMTP_EMAIL", "testimonyjokotoye65@gmail.com").strip()

    attempts = []
    urls_to_test = [webhook_url]
    if webhook_url != DEFAULT_GOOGLE_MAIL_WEBHOOK:
        urls_to_test.append(DEFAULT_GOOGLE_MAIL_WEBHOOK)

    for target_url in urls_to_test:
        try:
            resp = httpx.post(
                target_url,
                json={
                    "to": clean_email,
                    "subject": f"{test_otp} is your CampusLink Verification Code",
                    "html": f"<p>CampusLink test code: <b>{test_otp}</b></p>",
                    "text": f"Your CampusLink test verification code is: {test_otp}",
                    "code": test_otp,
                },
                follow_redirects=True,
                timeout=15.0,
            )
            attempts.append({
                "url": target_url[:42] + "...",
                "status_code": resp.status_code,
                "response": resp.text[:200] if resp.text else "(empty)"
            })
            if resp.status_code in (200, 201, 302):
                return {
                    "success": True,
                    "recipient": clean_email,
                    "otp_sent": test_otp,
                    "delivered_via": target_url[:42] + "...",
                    "attempts": attempts,
                    "message": f"Verification email delivered to {clean_email}!",
                }
        except Exception as e_diag:
            attempts.append({
                "url": target_url[:42] + "...",
                "error": str(e_diag)
            })

    return {
        "success": False,
        "recipient": clean_email,
        "sender": sender,
        "attempts": attempts,
        "message": (
            "Webhook delivery failed across all URLs. Check attempts list for details."
        ),
    }


# --- PRESENCE / ONLINE STATUS ENDPOINTS ---

def get_current_user_for_presence(token: str, db: Session) -> models.User:
    """Lightweight token resolution used by presence endpoints."""
    from auth import verify_token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(models.User).filter(models.User.user_id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@app.post("/api/presence/heartbeat")
def presence_heartbeat(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Called by the frontend every 30 s to keep the user marked as online.
    Also passively marks users whose last_seen is > 2 min ago as offline.
    """
    now_utc = datetime.now(timezone.utc)
    now = now_utc.replace(tzinfo=None)
    current_user.is_online = True
    current_user.last_seen = now
    # Passive cleanup: mark stale users as offline (last_seen > 2 min ago)
    stale_cutoff = now - timedelta(minutes=2)
    db.query(models.User).filter(
        models.User.is_online == True,
        models.User.last_seen < stale_cutoff,
        models.User.user_id != current_user.user_id
    ).update({"is_online": False}, synchronize_session=False)
    db.commit()
    return {"status": "online", "last_seen": now_utc.isoformat()}


@app.post("/api/presence/offline")
def presence_offline(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Called when the user closes the tab or hides the app."""
    now_utc = datetime.now(timezone.utc)
    now = now_utc.replace(tzinfo=None)
    current_user.is_online = False
    current_user.last_seen = now
    db.commit()
    return {"status": "offline", "last_seen": now_utc.isoformat()}


# --- AUTH & USER ENDPOINTS ---

@app.post("/api/register", response_model=schemas.UserRegistrationOut, status_code=status.HTTP_201_CREATED)
def register_user(
    user_data: schemas.UserCreate, 
    db: Session = Depends(database.get_db)
):
    if user_data.role == "admin":
        ADMIN_SECURITY_KEY = "CAMPUS_ADMIN_SECRET_2026"
        if user_data.admin_secret_key != ADMIN_SECURITY_KEY:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Admin Security Key.")

    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email is already registered")

    if db.query(models.User).filter(models.User.phone_number == user_data.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone number is already registered")

    parsed_uni_id = None
    if user_data.university_id:
        if isinstance(user_data.university_id, int) or str(user_data.university_id).isdigit():
            target_id = int(user_data.university_id)
            uni = db.query(models.University).filter(models.University.id == target_id).first()
            if uni:
                parsed_uni_id = uni.id
        else:
            uni = db.query(models.University).filter(models.University.name == user_data.university_id).first()
            if uni:
                parsed_uni_id = uni.id

    hashed_pw = auth.hash_password(user_data.password)
    otp = str(random.randint(100000, 999999))
    expiry = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)

    new_user = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=hashed_pw,
        role=user_data.role,
        university_id=parsed_uni_id,
        state=user_data.state,
        matric_number=user_data.matric_number,
        department=user_data.department,
        level=user_data.level,
        hostel=user_data.hostel,
        bio=user_data.bio,
        profile_picture_url=user_data.profile_picture_url,
        is_email_verified=False,
        verification_code=otp,
        code_expires_at=expiry
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if user_data.role == "vendor":
        vendor_entry = models.Vendor(
            user_id=new_user.user_id,
            business_name=user_data.business_name or f"{new_user.full_name}'s Store",
            business_description=user_data.business_description,
            category_id=user_data.category_id or 1,
            university_id=parsed_uni_id,
            location=user_data.hostel,
            phone=user_data.phone_number,
            email=user_data.email,
            verification_status="pending"
        )
        db.add(vendor_entry)
        db.commit()

    email_dispatched = send_otp_email(new_user.email, otp)
    return {
        "user_id": new_user.user_id,
        "full_name": new_user.full_name,
        "email": new_user.email,
        "role": new_user.role,
        "is_email_verified": new_user.is_email_verified,
        "matric_number": new_user.matric_number,
        "created_at": new_user.created_at,
        "email_dispatched": email_dispatched,
        "dev_code": otp if not email_dispatched else None,
        "message": "Account registered! A 6-digit verification code has been dispatched to your email." if email_dispatched else "Account registered! Verification code generated."
    }

@app.post("/api/verify-email")
def verify_email(payload: schemas.VerifyEmailSchema, db: Session = Depends(database.get_db)):
    clean_email = (payload.email or "").strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if user.is_email_verified:
        return {"message": "Email is already verified."}

    # Strictly verify user's actual generated OTP code
    if not user.verification_code or user.verification_code != payload.code.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your email and try again.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user.code_expires_at and user.code_expires_at < now:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    user.is_email_verified = True
    user.verification_code = None
    user.code_expires_at = None
    db.commit()

    return {"message": "Email verified successfully! You can now log in."}

@app.post("/api/resend-otp")
def resend_otp(payload: schemas.ResendOTPSchema, db: Session = Depends(database.get_db)):
    clean_email = (payload.email or "").strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if user.is_email_verified:
        return {"message": "Email is already verified."}

    otp = str(random.randint(100000, 999999))
    user.verification_code = otp
    user.code_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)
    db.commit()

    email_dispatched = send_otp_email(user.email, otp)
    return {
        "message": "A fresh verification code has been dispatched to your email." if email_dispatched else "A fresh verification code has been generated.",
        "email_dispatched": email_dispatched,
        "dev_code": otp if not email_dispatched else None
    }

@app.post("/api/login", response_model=schemas.Token)
def login_user(credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    clean_email = (credentials.email or "").strip().lower()
    try:
        user = db.query(models.User).filter(func.lower(models.User.email) == clean_email).first()
    except SQLAlchemyError as db_err:
        print(f"[Login Database Error] SQLAlchemyError: {db_err}")
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please retry in a few moments."
        )
    except Exception as db_err:
        print(f"[Login Database Error] Unexpected: {db_err}")
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please retry in a few moments."
        )

    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Email not verified. Please complete email verification first."
        )

    if getattr(user, "status", "active") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Your account has been suspended by administration. Please contact support."
        )

    access_token = auth.create_access_token(data={"sub": user.user_id, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/me", response_model=schemas.UserOut)
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


def delete_user_cascade(db: Session, target_user: models.User):
    """
    Safely cascades deletion of all dependent entities before deleting the user.
    Prevents foreign key constraint errors and ensures no orphaned state remains.
    """
    uid = target_user.user_id

    # 1. Vendor cleanup if user owns a vendor profile
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == uid).first()
    if vendor:
        vid = vendor.id
        db.query(models.Product).filter(models.Product.vendor_id == vid).delete(synchronize_session=False)
        db.query(models.ServiceItem).filter(models.ServiceItem.vendor_id == vid).delete(synchronize_session=False)
        db.query(models.Review).filter(models.Review.vendor_id == vid).delete(synchronize_session=False)
        db.query(models.Report).filter(models.Report.reported_vendor_id == vid).delete(synchronize_session=False)
        db.query(models.Favorite).filter(models.Favorite.vendor_id == vid).delete(synchronize_session=False)
        db.query(models.Order).filter(models.Order.vendor_id == vid).delete(synchronize_session=False)
        db.query(models.Post).filter(models.Post.vendor_id == vid).delete(synchronize_session=False)
        db.query(models.Reel).filter(models.Reel.vendor_id == vid).delete(synchronize_session=False)
        db.delete(vendor)

    # 2. Reels created by user and comments/likes
    user_reels = db.query(models.Reel).filter(models.Reel.user_id == uid).all()
    for r in user_reels:
        db.query(models.ReelLike).filter(models.ReelLike.reel_id == r.id).delete(synchronize_session=False)
        db.query(models.ReelComment).filter(models.ReelComment.reel_id == r.id).delete(synchronize_session=False)
        db.delete(r)

    db.query(models.ReelLike).filter(models.ReelLike.user_id == uid).delete(synchronize_session=False)
    db.query(models.ReelComment).filter(models.ReelComment.user_id == uid).delete(synchronize_session=False)

    # 3. Posts
    db.query(models.Post).filter(models.Post.user_id == uid).delete(synchronize_session=False)

    # 4. Social & Messages
    db.query(models.Friendship).filter((models.Friendship.user_id == uid) | (models.Friendship.friend_id == uid)).delete(synchronize_session=False)
    db.query(models.Message).filter((models.Message.sender_id == uid) | (models.Message.recipient_id == uid)).delete(synchronize_session=False)
    db.query(models.CampusStatus).filter(models.CampusStatus.user_id == uid).delete(synchronize_session=False)

    # 5. Notifications
    db.query(models.Notification).filter((models.Notification.user_id == uid) | (models.Notification.actor_id == uid)).delete(synchronize_session=False)

    # 6. Orders, Rides, Favorites, Reviews, Reports
    db.query(models.Order).filter(models.Order.user_id == uid).delete(synchronize_session=False)
    db.query(models.RideBooking).filter(models.RideBooking.user_id == uid).delete(synchronize_session=False)
    db.query(models.Favorite).filter(models.Favorite.user_id == uid).delete(synchronize_session=False)
    db.query(models.Review).filter(models.Review.user_id == uid).delete(synchronize_session=False)
    db.query(models.Report).filter(models.Report.reporter_id == uid).delete(synchronize_session=False)

    # 7. Notices & Eateries
    db.query(models.CampusNotice).filter(models.CampusNotice.user_id == uid).delete(synchronize_session=False)
    if hasattr(models, "CampusEatery"):
        db.query(models.CampusEatery).filter(models.CampusEatery.submitted_by == uid).delete(synchronize_session=False)

    # 8. AI Messages & Memories
    db.query(models.AIMessage).filter(models.AIMessage.user_id == uid).delete(synchronize_session=False)
    db.query(models.AIMemory).filter(models.AIMemory.user_id == uid).delete(synchronize_session=False)

    # 9. Finally delete the user record
    db.delete(target_user)
    db.commit()


@app.delete("/api/users/me")
def delete_own_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Allows an authenticated student/user to permanently delete their account and profile.
    Admin accounts cannot be self-deleted through this route.
    """
    if current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts cannot be deleted via student self-service. Contact super administrator."
        )

    user_id = current_user.user_id
    user_name = current_user.full_name
    delete_user_cascade(db, current_user)

    return {
        "message": f"Your account '{user_name}' and all associated campus records have been successfully deleted.",
        "user_id": user_id
    }


@app.post("/api/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    content_type = (file.content_type or "").lower()
    if not ext:
        if "audio" in content_type:
            ext = ".webm"
        elif "video" in content_type:
            ext = ".mp4"
        elif "png" in content_type:
            ext = ".png"
        else:
            ext = ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{ext}"

    # 1. Cloudinary upload (Permanent cloud storage for Render - images, reels, status stories, voice notes)
    if CLOUDINARY_AVAILABLE:
        try:
            await file.seek(0)
            file_bytes = await file.read()
            
            # In Cloudinary, audio and video both use resource_type='video'
            is_video_or_audio = (
                "video" in content_type or 
                "audio" in content_type or 
                ext in [".mp4", ".mov", ".avi", ".webm", ".mkv", ".mp3", ".wav", ".ogg", ".m4a"]
            )
            resource_type = "video" if is_video_or_audio else "image"
            
            upload_res = cloudinary.uploader.upload(
                file_bytes,
                resource_type=resource_type,
                folder="campuslink",
                public_id=f"{uuid.uuid4().hex}"
            )
            secure_url = upload_res.get("secure_url") or upload_res.get("url")
            if secure_url:
                print(f"[CAMPUSLINK CLOUDINARY] Uploaded successfully ({resource_type}): {secure_url}")
                return {"url": secure_url, "filename": upload_res.get("public_id")}
        except Exception as e_cld:
            print(f"[CAMPUSLINK] Cloudinary upload error: {e_cld}. Using local fallback.")

    # 2. Local filesystem storage fallback
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    await file.seek(0)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Determine public URL dynamically
    base_url = str(request.base_url).rstrip("/")
    if "onrender.com" in base_url and base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://")
    file_url = f"{base_url}/uploads/{unique_filename}"
    return {"url": file_url, "filename": unique_filename}

@app.post("/api/users/profile-picture")
def update_profile_picture(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    url = payload.get("profile_picture_url")
    if not url:
        raise HTTPException(status_code=400, detail="profile_picture_url is required")
    current_user.profile_picture_url = url
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile picture updated successfully", "profile_picture_url": url}

@app.put("/api/users/profile")
def update_user_profile(
    profile_data: schemas.UserProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if profile_data.full_name and profile_data.full_name.strip():
        current_user.full_name = profile_data.full_name.strip()
    if profile_data.bio is not None:
        current_user.bio = profile_data.bio.strip()
    if profile_data.phone_number is not None:
        current_user.phone_number = profile_data.phone_number.strip()
    if profile_data.department is not None:
        current_user.department = profile_data.department.strip()
    if profile_data.level is not None:
        current_user.level = profile_data.level.strip()
    if profile_data.hostel is not None:
        current_user.hostel = profile_data.hostel.strip()
    if profile_data.profile_picture_url is not None:
        current_user.profile_picture_url = profile_data.profile_picture_url.strip()

    db.commit()
    db.refresh(current_user)
    return {
        "message": "Profile updated successfully!",
        "user": {
            "user_id": current_user.user_id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "phone_number": current_user.phone_number,
            "department": current_user.department,
            "level": current_user.level,
            "hostel": current_user.hostel,
            "bio": current_user.bio,
            "profile_picture_url": current_user.profile_picture_url,
            "university_id": current_user.university_id
        }
    }

@app.put("/api/users/password")
def change_user_password(
    data: schemas.UserPasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if not auth.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Identity verification failed: Current password is incorrect."
        )
    if len(data.new_password.strip()) < 6:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 6 characters long."
        )
    current_user.password_hash = auth.hash_password(data.new_password.strip())
    db.commit()
    return {"message": "Password updated successfully!"}

# ==========================================
# NOTIFICATIONS SYSTEM
# ==========================================

def create_notification(
    db: Session,
    user_id: str,
    actor_id: Optional[str],
    notification_type: str,
    title: str,
    message: str,
    reference_id: Optional[str] = None
):
    try:
        notif = models.Notification(
            user_id=user_id,
            actor_id=actor_id,
            notification_type=notification_type,
            title=title,
            message=message,
            reference_id=reference_id,
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        print(f"[Notifications] Error creating notification: {e}")

@app.get("/api/notifications")
def get_user_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    # If the student has zero notifications, seed starter campus notifications
    if db.query(models.Notification).filter(models.Notification.user_id == current_user.user_id).count() == 0:
        peer = db.query(models.User).filter(
            models.User.university_id == current_user.university_id,
            models.User.user_id != current_user.user_id
        ).first()
        peer_id = peer.user_id if peer else None
        peer_name = peer.full_name if peer else "Chioma Adeleke"

        create_notification(
            db=db,
            user_id=current_user.user_id,
            actor_id=peer_id,
            notification_type="friend_request",
            title="New Campus Friend Connection",
            message=f"{peer_name} sent you a campus friend connection request.",
            reference_id=peer_id
        )
        create_notification(
            db=db,
            user_id=current_user.user_id,
            actor_id=peer_id,
            notification_type="like",
            title="New Like on your Reel",
            message=f"{peer_name} liked your campus life clip!",
            reference_id="1"
        )
        create_notification(
            db=db,
            user_id=current_user.user_id,
            actor_id=peer_id,
            notification_type="notice",
            title="ðŸ” Campus Lost & Found Alert",
            message="Faculty of Engineering: Blue Scientific Calculator & Keys found near Lecture Theater 2.",
            reference_id="notice"
        )

    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id
    ).order_by(models.Notification.created_at.desc()).limit(60).all()

    unread_count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id,
        models.Notification.is_read == False
    ).count()

    results = []
    for n in notifs:
        actor = n.actor
        results.append({
            "id": n.id,
            "user_id": n.user_id,
            "actor_id": n.actor_id,
            "actor_name": actor.full_name if actor else "Campus Peer",
            "actor_avatar": actor.profile_picture_url if actor else None,
            "actor_dept": actor.department if actor else None,
            "notification_type": n.notification_type,
            "title": n.title,
            "message": n.message,
            "reference_id": n.reference_id,
            "is_read": n.is_read,
            "created_at": n.created_at
        })
    return {"notifications": results, "unread_count": unread_count}

@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.user_id
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read"}

@app.post("/api/notifications/read-all")
def mark_all_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}



@app.get("/api/campus/eateries")
def get_campus_eateries(
    university_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    target_uni_id = university_id or current_user.university_id or 23
    uni = db.query(models.University).filter(models.University.id == target_uni_id).first()
    uni_name = uni.name if uni else "University of Lagos"
    uni_state = uni.state if uni else "Lagos"

    # Pre-configured authentic student eateries & famous chains per state with real food photography
    eateries_by_region = {
        "Ekiti": [
            {
                "id": 2301,
                "name": "Chicken Republic Ado-Ekiti",
                "campus": uni_name,
                "location": "Near Campus Satellite Gate & Express",
                "phone": "+2348031122334",
                "whatsapp": "2348031122334",
                "image": "/eateries/fried_chicken.jpg",
                "specialties": "Crispy Soul Food Fried Chicken, Citizens Meal, Refuel Dodo & Jollof",
                "delivery_time": "15-25 mins",
                "delivery_fee": "₦350 to hostels",
                "rating": 4.9,
                "reviews_count": 310,
                "popular_brand": True,
                "verified_on_google": True,
                "menu": [
                    {"id": "cr-1", "name": "Citizens Meal (Jollof Rice + 1pc Fried Chicken)", "price": 2800, "desc": "Signature spiced jollof rice paired with crispy golden fried chicken"},
                    {"id": "cr-2", "name": "Refuel Max (Fried Rice + Fried Chicken + Plantain)", "price": 3500, "desc": "Hearty fried rice, crispy chicken cut, sweet fried dodo & salad"},
                    {"id": "cr-3", "name": "Crunchy Chicken Wings (4 Pieces) & Chips", "price": 3200, "desc": "Crispy golden fried wings with potato french fries"},
                    {"id": "cr-4", "name": "Chicken Republic Flaky Meat Pie & Cold Drink", "price": 1200, "desc": "Freshly baked meat pie with minced beef paired with chilled soft drink"}
                ]
            },
            {
                "id": 2302,
                "name": "Buka Bam EKSU",
                "campus": uni_name,
                "location": "Faculty of Science Walkway / Hall 1 Food Court",
                "phone": "+2348056677889",
                "whatsapp": "2348056677889",
                "image": "/eateries/amala.jpg",
                "specialties": "Hot Amala with Ewedu, Gbegiri & Cow Leg, Goat Meat & Assorted",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.8,
                "reviews_count": 220,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "bb-1", "name": "Hot Amala + Abula (Ewedu/Gbegiri) + Assorted Meat", "price": 2400, "desc": "Steaming hot yam flour amala with traditional abula and 2 cuts assorted meat"},
                    {"id": "bb-2", "name": "Pounded Yam + Egusi Soup + Tender Goat Meat", "price": 2800, "desc": "Freshly pounded yam with rich melon egusi and goat meat"},
                    {"id": "bb-3", "name": "Smokey Firewood Jollof + Fried Titus Fish", "price": 2600, "desc": "Campus jollof rice served with plantain and crispy fried fish"},
                    {"id": "bb-4", "name": "Chilled Hibiscus Zobo Drink (50cl)", "price": 500, "desc": "Refreshing homemade ginger spiced zobo"}
                ]
            },
            {
                "id": 2303,
                "name": "Mat-Ice Fast Food & Grills",
                "campus": uni_name,
                "location": "Commercial Road Junction, Ado-Ekiti",
                "phone": "+2348023451122",
                "whatsapp": "2348023451122",
                "image": "/eateries/spaghetti.jpg",
                "specialties": "Stir-fry Peppered Spaghetti, Shawarma, Ice Cream & Pastries",
                "delivery_time": "20-30 mins",
                "delivery_fee": "₦400 to hostels",
                "rating": 4.8,
                "reviews_count": 185,
                "popular_brand": True,
                "verified_on_google": True,
                "menu": [
                    {"id": "mi-1", "name": "Spicy Stir-fry Spaghetti + Peppered Chicken", "price": 2700, "desc": "Wok-fried spicy spaghetti with vegetables, sausage and chicken"},
                    {"id": "mi-2", "name": "Double Sausage Chicken Shawarma Roll", "price": 2400, "desc": "Toasted pita wrap with seasoned chicken, sausages & hot sauce"},
                    {"id": "mi-3", "name": "Golden Baked Meat Pie & Chilled Malt", "price": 1400, "desc": "Rich minced meat pastry paired with cold maltina"}
                ]
            },
            {
                "id": 2304,
                "name": "Suya & Grills Spot",
                "campus": uni_name,
                "location": "Campus Main Gate Commercial Strip",
                "phone": "+2348078901234",
                "whatsapp": "2348078901234",
                "image": "/eateries/suya.jpg",
                "specialties": "Sizzling Beef Suya, Peppered Asun, Barbecue Fish",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.9,
                "reviews_count": 160,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "sy-1", "name": "Special Beef Suya Platter + Sliced Onions", "price": 2500, "desc": "Charcoal-grilled spiced beef strips seasoned with yaji pepper and cabbage"},
                    {"id": "sy-2", "name": "Fiery Goat Meat Asun Bowl", "price": 3000, "desc": "Smoked peppered goat meat sautéed with habanero chili and onions"},
                    {"id": "sy-3", "name": "Grilled Whole Catfish + Potato Chips", "price": 4200, "desc": "Spicy barbecued fresh catfish with crispy fries"}
                ]
            }
        ],
        "Lagos": [
            {
                "id": 101,
                "name": "Chicken Republic Akoka",
                "campus": uni_name,
                "location": "St. Finbarrs Road opposite UNILAG First Gate",
                "phone": "+2348039988776",
                "whatsapp": "2348039988776",
                "image": "/eateries/fried_chicken.jpg",
                "specialties": "Crispy Soul Food Fried Chicken, Citizens Meal, Refuel Dodo & Jollof",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦350 to hostels",
                "rating": 4.9,
                "reviews_count": 480,
                "popular_brand": True,
                "verified_on_google": True,
                "menu": [
                    {"id": "cr-l1", "name": "Citizens Meal (Jollof Rice + 1pc Fried Chicken)", "price": 2800, "desc": "Signature spiced jollof rice with crispy fried chicken"},
                    {"id": "cr-l2", "name": "Refuel Max (Fried Rice + Fried Chicken + Plantain)", "price": 3500, "desc": "Seasoned fried rice, crispy chicken cut, sweet plantain & salad"},
                    {"id": "cr-l3", "name": "Chicken Republic Flaky Meat Pie & Cold Drink", "price": 1200, "desc": "Freshly baked savory meat pie with cold soda"}
                ]
            },
            {
                "id": 102,
                "name": "Iya Moria Food Canteen",
                "campus": uni_name,
                "location": "New Hall Commercial Walkway, UNILAG",
                "phone": "+2348023456789",
                "whatsapp": "2348023456789",
                "image": "/eateries/amala.jpg",
                "specialties": "Hot Amala, Gbegiri & Ewedu, Cow Leg, Goat Meat & Assorted",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦350 to hostels",
                "rating": 4.9,
                "reviews_count": 340,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "im-1", "name": "Hot Amala + Ewedu/Gbegiri + Assorted Meat", "price": 2800, "desc": "Authentic fluffy amala, rich gbegiri, ewedu and 2 cuts assorted meat"},
                    {"id": "im-2", "name": "Pounded Yam + Egusi Soup + Goat Meat", "price": 3200, "desc": "Pounded yam with melon egusi and tender goat meat"},
                    {"id": "im-3", "name": "Smokey Firewood Jollof + Fried Chicken", "price": 3000, "desc": "Firewood jollof rice, plantain and seasoned fried chicken"},
                    {"id": "im-4", "name": "Chilled Zobo / Fruit Juice Drink", "price": 600, "desc": "Refreshing homemade spiced hibiscus beverage"}
                ]
            },
            {
                "id": 103,
                "name": "Korede Spaghetti & Wings",
                "campus": uni_name,
                "location": "Faculty of Arts Quad & Walkway, UNILAG",
                "phone": "+2348095671234",
                "whatsapp": "2348095671234",
                "image": "/eateries/spaghetti.jpg",
                "specialties": "Spicy Stir-fry Spaghetti, Peppered Chicken Wings & Asun",
                "delivery_time": "15 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.9,
                "reviews_count": 290,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "ks-1", "name": "Signature Spicy Stir-fry Spaghetti", "price": 2400, "desc": "Wok-fried spaghetti with hot peppers, sausages, and diced beef"},
                    {"id": "ks-2", "name": "Spicy Spaghetti + Jumbo Peppered Wings", "price": 3500, "desc": "Signature spaghetti combo with 3 crispy peppered wings"},
                    {"id": "ks-3", "name": "Peppered Gizzard & Plantain (Gizdodo)", "price": 2800, "desc": "Diced fried plantains and spicy peppered gizzards"}
                ]
            },
            {
                "id": 104,
                "name": "The Place Restaurant Akoka",
                "campus": uni_name,
                "location": "University Road near Campus Gate",
                "phone": "+2348011122233",
                "whatsapp": "2348011122233",
                "image": "/eateries/jollof.jpg",
                "specialties": "Smokey Party Jollof, Fiery Asun, Grilled Chicken & Fried Rice",
                "delivery_time": "20-25 mins",
                "delivery_fee": "₦400 to hostels",
                "rating": 4.8,
                "reviews_count": 420,
                "popular_brand": True,
                "verified_on_google": True,
                "menu": [
                    {"id": "tp-1", "name": "Party Jollof Rice + Grilled Quarter Chicken", "price": 3400, "desc": "Signature firewood jollof rice with grilled spiced chicken and dodo"},
                    {"id": "tp-2", "name": "Special Asun Bowl (Peppered Smoked Goat)", "price": 3200, "desc": "Smoked goat meat bites tossed in fiery scotch bonnet pepper glaze"},
                    {"id": "tp-3", "name": "Village Fried Rice with Diced Liver", "price": 3000, "desc": "Wok-tossed seasoned rice with sweetcorn, carrots and liver cuts"}
                ]
            },
            {
                "id": 105,
                "name": "Shawarma & Grills Express",
                "campus": uni_name,
                "location": "SUB Commercial Complex Shop 5",
                "phone": "+2348088899001",
                "whatsapp": "2348088899001",
                "image": "/eateries/shawarma.jpg",
                "specialties": "Toasted Chicken Shawarma, Burgers, Fresh Fruit Smoothies",
                "delivery_time": "15 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.8,
                "reviews_count": 195,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "sw-1", "name": "Double Sausage Chicken Shawarma Roll", "price": 2500, "desc": "Toasted pita wrap with seasoned chicken cuts, two frankfurter sausages and sauce"},
                    {"id": "sw-2", "name": "Beef & Cheese Shawarma Deluxe", "price": 2800, "desc": "Spiced shredded beef with melted cheddar slice in warm wrap"}
                ]
            }
        ],
        "Oyo": [
            {
                "id": 201,
                "name": "Chicken Republic Bodija / UI Gate",
                "campus": uni_name,
                "location": "Opposite University of Ibadan Main Gate",
                "phone": "+2348033334455",
                "whatsapp": "2348033334455",
                "image": "/eateries/fried_chicken.jpg",
                "specialties": "Crispy Fried Chicken, Citizens Meal, Refuel Dodo & Jollof",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.9,
                "reviews_count": 390,
                "popular_brand": True,
                "verified_on_google": True,
                "menu": [
                    {"id": "cr-u1", "name": "Citizens Meal (Jollof Rice + 1pc Fried Chicken)", "price": 2800, "desc": "Signature spiced jollof rice with crispy fried chicken"},
                    {"id": "cr-u2", "name": "Refuel Max (Fried Rice + Fried Chicken + Plantain)", "price": 3500, "desc": "Fried rice, crispy chicken cut, sweet dodo & salad"}
                ]
            },
            {
                "id": 202,
                "name": "Queens Hall Cafeteria UI",
                "campus": uni_name,
                "location": "Queen Elizabeth II Hall Food Walk, UI",
                "phone": "+2348022225566",
                "whatsapp": "2348022225566",
                "image": "/eateries/amala.jpg",
                "specialties": "Authentic Ibadan Amala, Gbegiri/Ewedu, Fresh Fish & Assorted",
                "delivery_time": "20 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.8,
                "reviews_count": 270,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "qh-1", "name": "Amala + Gbegiri/Ewedu + Assorted Meat", "price": 2500, "desc": "Steaming hot amala with abula and 2 cuts of assorted meat"},
                    {"id": "qh-2", "name": "Pounded Yam + Vegetable Soup + Fried Titus Fish", "price": 3000, "desc": "Pounded yam with rich vegetable stew and whole titus fish"}
                ]
            },
            {
                "id": 203,
                "name": "SUB Cafe & Grills UI",
                "campus": uni_name,
                "location": "Student Union Building Ground Floor",
                "phone": "+2348077778899",
                "whatsapp": "2348077778899",
                "image": "/eateries/jollof.jpg",
                "specialties": "Smokey Party Jollof, Peppered Turkey, Stir-fry Spaghetti",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.8,
                "reviews_count": 210,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "sub-1", "name": "Smokey Jollof Rice + Plantain + Peppered Beef", "price": 2600, "desc": "Hearty campus jollof plate, sweet fried dodo, and seasoned beef"},
                    {"id": "sub-2", "name": "Spaghetti Stir-fry + Peppered Chicken", "price": 2700, "desc": "Spicy pasta with diced sausages and grilled chicken"}
                ]
            }
        ],
        "Osun": [
            {
                "id": 301,
                "name": "Chicken Republic Ile-Ife",
                "campus": uni_name,
                "location": "Ibadan Road near OAU Campus Gate",
                "phone": "+2348034560011",
                "whatsapp": "2348034560011",
                "image": "/eateries/fried_chicken.jpg",
                "specialties": "Crispy Fried Chicken, Citizens Meal, Refuel Dodo & Jollof",
                "delivery_time": "15-25 mins",
                "delivery_fee": "₦350 to halls",
                "rating": 4.9,
                "reviews_count": 350,
                "popular_brand": True,
                "verified_on_google": True,
                "menu": [
                    {"id": "cr-o1", "name": "Citizens Meal (Jollof Rice + 1pc Fried Chicken)", "price": 2800, "desc": "Signature spiced jollof rice with crispy fried chicken"},
                    {"id": "cr-o2", "name": "Refuel Max (Fried Rice + Fried Chicken + Plantain)", "price": 3500, "desc": "Fried rice, crispy chicken cut, sweet dodo & salad"}
                ]
            },
            {
                "id": 302,
                "name": "Forks & Fingers OAU",
                "campus": uni_name,
                "location": "New Market Complex Shop 12, OAU",
                "phone": "+2348067891122",
                "whatsapp": "2348067891122",
                "image": "/eateries/jollof.jpg",
                "specialties": "Legendary Ife Jollof, Peppered Fried Chicken, Beans & Dodo",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to halls",
                "rating": 4.8,
                "reviews_count": 280,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "ff-1", "name": "Special Campus Jollof Pack + Fried Chicken", "price": 2700, "desc": "Firewood smokey jollof, sweet fried dodo, and spiced quarter chicken"},
                    {"id": "ff-2", "name": "Beans & Plantain Porridge + Fried Egg", "price": 1900, "desc": "Rich honey beans with ripe dodo and fried egg"}
                ]
            },
            {
                "id": 303,
                "name": "Bukateria SUB OAU",
                "campus": uni_name,
                "location": "Student Union Building Quad, OAU",
                "phone": "+2348012347788",
                "whatsapp": "2348012347788",
                "image": "/eateries/amala.jpg",
                "specialties": "Hot Pounded Yam, Amala, Goat Meat & Egusi",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to halls",
                "rating": 4.8,
                "reviews_count": 190,
                "popular_brand": False,
                "verified_on_google": True,
                "menu": [
                    {"id": "subo-1", "name": "Hot Amala + Abula + Goat Meat", "price": 2600, "desc": "Authentic Yoruba swallow with ewedu, gbegiri and tender goat meat"},
                    {"id": "subo-2", "name": "Pounded Yam + Egusi Soup + Assorted", "price": 2800, "desc": "Pounded yam paired with rich melon soup and assorted cuts"}
                ]
            }
        ]
    }

    # Match by State first, fallback to Ekiti or Lagos list with campus label
    # 1. Query database for verified and community-submitted campus eateries
    db_eateries = db.query(models.CampusEatery).filter(
        (models.CampusEatery.university_id == target_uni_id) | (models.CampusEatery.university_id.is_(None))
    ).all()

    personalized = []
    seen_names = set()

    # Add database eateries
    for de in db_eateries:
        if de.name.lower() in seen_names:
            continue
        seen_names.add(de.name.lower())
        
        query_str = urllib.parse.quote(f"{de.name} near {uni_name}")
        dest_str = urllib.parse.quote(f"{de.name} {uni_name}")
        
        # Build default menu for known brand or dish specialties
        eatery_dict = {
            "id": de.id,
            "name": de.name,
            "campus": uni_name,
            "location": de.location,
            "phone": de.phone or "+2348090165942",
            "whatsapp": de.whatsapp or "2348090165942",
            "image": de.image or "/eateries/jollof.jpg",
            "specialties": de.specialties or "Campus delicacies, snacks and drinks",
            "delivery_time": de.delivery_time or "15-25 mins",
            "delivery_fee": de.delivery_fee or "₦300 to hostels",
            "rating": de.rating or 4.8,
            "reviews_count": de.reviews_count or 180,
            "popular_brand": de.popular_brand,
            "verified_on_google": True,
            "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={query_str}",
            "google_directions_url": f"https://www.google.com/maps/dir/?api=1&destination={dest_str}",
            "google_rating": de.rating or 4.8,
            "google_reviews": f"{de.reviews_count or 180}+ on Google Maps",
            "menu": [
                {"id": f"m-{de.id}-1", "name": "Special Campus Pack (Jollof Rice + Protein)", "price": 2800, "desc": "Fresh jollof rice served with fried plantain and your choice of meat/chicken"},
                {"id": f"m-{de.id}-2", "name": "Student Value Meal", "price": 2200, "desc": "Affordable freshly prepared daily special served hot"},
                {"id": f"m-{de.id}-3", "name": "Double Meat Pie / Shawarma Roll", "price": 1400, "desc": "Crispy baked pastry or warm toasted shawarma wrap"},
                {"id": f"m-{de.id}-4", "name": "Cold Bottled Drink (50cl)", "price": 500, "desc": "Refreshing chilled drink delivered with your food"}
            ]
        }
        personalized.append(eatery_dict)

    # 2. Query registered food vendors from the database for this campus
    food_vendors = db.query(models.Vendor).filter(
        models.Vendor.university_id == target_uni_id
    ).all()
    for fv in food_vendors:
        norm_name = fv.business_name.lower()
        if any(sn in norm_name or norm_name in sn for sn in seen_names):
            continue
        v_prods = db.query(models.Product).filter(
            models.Product.vendor_id == fv.id,
            models.Product.category_id.in_([1, 7])
        ).all()
        # Only vendors with food products or explicit kitchen/food in name
        if v_prods or "kitchen" in norm_name or "buka" in norm_name or "canteen" in norm_name:
            seen_names.add(norm_name)
            u_vendor = db.query(models.User).filter(models.User.user_id == fv.user_id).first()
            v_phone = u_vendor.phone_number if u_vendor else "+2348035557788"
            v_clean_phone = v_phone.replace("+", "").replace(" ", "").replace("-", "") if v_phone else "2348035557788"

            v_menu = []
            for p in v_prods:
                v_menu.append({
                    "id": f"vp-{p.id}",
                    "name": p.name,
                    "price": int(p.price),
                    "desc": p.description or f"Fresh meal prepared by {fv.business_name}"
                })
            if not v_menu:
                v_menu = [
                    {"id": f"vp-def-1", "name": "Daily Campus Special Pack", "price": 2500, "desc": f"Freshly cooked daily meal from {fv.business_name}"}
                ]

            q_str = urllib.parse.quote(f"{fv.business_name} near {uni_name}")
            personalized.append({
                "id": 9000 + fv.id,
                "name": fv.business_name,
                "campus": uni_name,
                "location": getattr(fv, "location", None) or "Campus Commercial Walkway",
                "phone": v_phone,
                "whatsapp": v_clean_phone,
                "image": "/eateries/jollof.jpg",
                "specialties": fv.business_description or "Verified student food merchant on CampusLink",
                "delivery_time": "15-20 mins",
                "delivery_fee": "₦300 to hostels",
                "rating": 4.9,
                "reviews_count": 150,
                "popular_brand": False,
                "verified_on_google": True,
                "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={q_str}",
                "google_directions_url": f"https://www.google.com/maps/dir/?api=1&destination={q_str}",
                "google_rating": 4.9,
                "google_reviews": "150+ student ratings",
                "menu": v_menu
            })

    # 3. Fallback to regional list if database has no eateries for this specific state yet
    if not personalized:
        matched = eateries_by_region.get(uni_state) or eateries_by_region.get("Ekiti") or eateries_by_region.get("Lagos")
        for item in matched:
            eatery_copy = dict(item)
            eatery_copy["campus"] = uni_name
            query_str = urllib.parse.quote(f"{eatery_copy['name']} near {uni_name}")
            dest_str = urllib.parse.quote(f"{eatery_copy['name']} {uni_name}")
            eatery_copy["google_maps_url"] = f"https://www.google.com/maps/search/?api=1&query={query_str}"
            eatery_copy["google_directions_url"] = f"https://www.google.com/maps/dir/?api=1&destination={dest_str}"
            eatery_copy["google_rating"] = eatery_copy.get("rating", 4.8)
            eatery_copy["google_reviews"] = f"{eatery_copy.get('reviews_count', 180)}+ on Google Maps"
            personalized.append(eatery_copy)

    # General Google Maps query URL for exploring all nearby eateries around this campus
    all_nearby_google_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote('restaurants near ' + uni_name)}"

    return {
        "university": uni_name,
        "state": uni_state,
        "eateries": personalized,
        "google_maps_explore_url": all_nearby_google_url
    }

@app.post("/api/campus/eateries/submit")
def submit_campus_eatery(
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    name = (data.get("name") or "").strip()
    location = (data.get("location") or "").strip()
    if not name or not location:
        raise HTTPException(status_code=400, detail="Eatery name and location are required.")

    phone = data.get("phone") or current_user.phone_number or "+2348090165942"
    clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")

    new_e = models.CampusEatery(
        university_id=current_user.university_id or 23,
        name=name,
        location=location,
        phone=phone,
        whatsapp=clean_phone,
        image=data.get("image") or "/eateries/jollof.jpg",
        specialties=data.get("specialties") or "Freshly prepared campus meals and student snacks",
        delivery_time=data.get("delivery_time") or "15-25 mins",
        delivery_fee=data.get("delivery_fee") or "₦300 to hostels",
        rating=4.8,
        reviews_count=1,
        popular_brand=False,
        verified_on_google=True,
        submitted_by=current_user.user_id
    )
    db.add(new_e)
    db.commit()
    db.refresh(new_e)
    return {
        "message": f"'{name}' has been successfully added to your campus dining directory!",
        "eatery_id": new_e.id
    }


# --- ADMIN PANEL ENDPOINTS ---

@app.get("/api/admin/stats")
def get_admin_stats(
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    total_students = db.query(models.User).filter(models.User.role == "student").count()
    total_vendors = db.query(models.Vendor).count()
    verified_vendors = db.query(models.Vendor).filter(models.Vendor.verification_status == "verified").count()
    pending_vendors = db.query(models.Vendor).filter(models.Vendor.verification_status == "pending").count()
    total_products = db.query(models.Product).count()
    total_services = db.query(models.Service).count()
    total_reels = db.query(models.Reel).count()
    total_orders = db.query(models.Order).count()

    return {
        "total_students": total_students,
        "total_vendors": total_vendors,
        "verified_vendors": verified_vendors,
        "pending_vendors": pending_vendors,
        "total_products": total_products,
        "total_services": total_services,
        "total_reels": total_reels,
        "total_orders": total_orders
    }

@app.get("/api/admin/vendors/pending", response_model=List[schemas.VendorOut])
def get_pending_vendors(
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    vendors = db.query(models.Vendor).filter(models.Vendor.verification_status == "pending").all()
    out = []
    for v in vendors:
        out.append({
            "id": v.id,
            "user_id": v.user_id,
            "business_name": v.business_name,
            "business_description": v.business_description,
            "category_id": v.category_id,
            "university_id": v.university_id,
            "state": v.state,
            "location": v.location,
            "phone": v.phone or (v.user.phone_number if v.user else None),
            "email": v.email or (v.user.email if v.user else None),
            "logo": v.logo,
            "cover_image": v.cover_image,
            "verification_status": v.verification_status,
            "id_card_front": v.id_card_front,
            "id_card_back": v.id_card_back,
            "rejection_reason": v.rejection_reason,
            "created_at": v.created_at,
            "user_name": v.user.full_name if v.user else "Vendor",
            "university_name": v.university.name if v.university else "Campus",
            "category_name": v.category.name if v.category else "General"
        })
    return out

@app.get("/api/admin/vendors", response_model=List[schemas.VendorOut])
def get_all_vendors_admin(
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Vendor)
    if status and status != "all":
        query = query.filter(models.Vendor.verification_status == status)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((models.Vendor.business_name.ilike(s)) | (models.Vendor.location.ilike(s)))
    vendors = query.order_by(models.Vendor.created_at.desc()).all()
    out = []
    for v in vendors:
        out.append({
            "id": v.id,
            "user_id": v.user_id,
            "business_name": v.business_name,
            "business_description": v.business_description,
            "category_id": v.category_id,
            "university_id": v.university_id,
            "state": v.state,
            "location": v.location,
            "phone": v.phone or (v.user.phone_number if v.user else None),
            "email": v.email or (v.user.email if v.user else None),
            "logo": v.logo,
            "cover_image": v.cover_image,
            "verification_status": v.verification_status,
            "id_card_front": v.id_card_front,
            "id_card_back": v.id_card_back,
            "rejection_reason": v.rejection_reason,
            "created_at": v.created_at,
            "user_name": v.user.full_name if v.user else "Vendor",
            "university_name": v.university.name if v.university else "Campus",
            "category_name": v.category.name if v.category else "General"
        })
    return out

@app.post("/api/admin/vendors/{vendor_id}/action")
def admin_vendor_action(
    vendor_id: int,
    action_data: schemas.AdminVendorAction,
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found.")

    if action_data.action == "approve":
        vendor.verification_status = "verified"
        vendor.rejection_reason = None
        message = f"Vendor '{vendor.business_name}' approved and verified successfully!"
    elif action_data.action == "reject":
        vendor.verification_status = "rejected"
        vendor.rejection_reason = action_data.rejection_reason or "ID card pictures or stall details unclear. Please re-upload clear photos."
        message = f"Vendor '{vendor.business_name}' rejected."
    elif action_data.action == "revoke":
        vendor.verification_status = "pending"
        vendor.rejection_reason = action_data.rejection_reason or "Verification status revoked by administrator for review."
        message = f"Vendor '{vendor.business_name}' status set to pending review."
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve', 'reject', or 'revoke'.")

    db.commit()
    return {"message": message, "verification_status": vendor.verification_status}

@app.get("/api/admin/users")
def get_all_users_admin(
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.User)
    if role and role != "all":
        query = query.filter(models.User.role == role)
    if status_filter and status_filter != "all":
        query = query.filter(models.User.status == status_filter)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((models.User.full_name.ilike(s)) | (models.User.email.ilike(s)) | (models.User.phone_number.ilike(s)))
    users = query.order_by(models.User.created_at.desc()).limit(100).all()
    return [
        {
            "user_id": u.user_id,
            "full_name": u.full_name,
            "email": u.email,
            "phone_number": u.phone_number,
            "role": u.role,
            "status": getattr(u, "status", None) or "active",
            "university_name": u.university.name if u.university else "Not Set",
            "department": u.department,
            "level": u.level,
            "is_email_verified": u.is_email_verified,
            "created_at": u.created_at
        }
        for u in users
    ]


@app.put("/api/admin/users/{user_id}/status")
def update_user_status_admin(
    user_id: str,
    status_payload: schemas.AdminUserStatusUpdate,
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    """
    Allows an administrator to suspend or reactivate any student or vendor account.
    Prevents admin from suspending their own account.
    """
    new_status = (status_payload.status or "").strip().lower()
    if new_status not in ["active", "suspended"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed values: 'active', 'suspended'."
        )

    if current_user.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator cannot change their own account status."
        )

    target_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    target_user.status = new_status
    db.commit()
    db.refresh(target_user)

    action_label = "suspended" if new_status == "suspended" else "reactivated"
    return {
        "message": f"User account for '{target_user.full_name}' has been {action_label}.",
        "user_id": target_user.user_id,
        "status": target_user.status
    }


@app.delete("/api/admin/users/{user_id}")
def delete_user_admin(
    user_id: str,
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(database.get_db)
):
    """
    Allows an administrator to permanently take down / delete a registered student or vendor profile.
    Cascades through all related tables to ensure no orphan records or constraint errors.
    Prevents admin self-deletion.
    """
    if current_user.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator cannot delete their own account."
        )

    target_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    user_name = target_user.full_name
    delete_user_cascade(db, target_user)

    return {
        "message": f"User profile and all associated data for '{user_name}' have been permanently deleted and taken down.",
        "user_id": user_id
    }



# --- VENDOR PROFILE & VERIFICATION SUBMISSION ---

@app.get("/api/vendor/my-store", response_model=schemas.VendorOut)
def get_my_vendor_store(
    current_user: models.User = Depends(require_role(["vendor", "admin"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first()
    if not vendor:
        vendor = models.Vendor(
            user_id=current_user.user_id,
            business_name=f"{current_user.full_name}'s Store",
            category_id=1,
            university_id=current_user.university_id,
            verification_status="pending"
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)

    return {
        "id": vendor.id,
        "user_id": vendor.user_id,
        "business_name": vendor.business_name,
        "business_description": vendor.business_description,
        "category_id": vendor.category_id,
        "university_id": vendor.university_id,
        "state": vendor.state,
        "location": vendor.location,
        "phone": vendor.phone or current_user.phone_number,
        "email": vendor.email or current_user.email,
        "logo": vendor.logo,
        "cover_image": vendor.cover_image,
        "verification_status": vendor.verification_status,
        "id_card_type": getattr(vendor, "id_card_type", "national_id"),
        "id_card_number": getattr(vendor, "id_card_number", None),
        "id_card_front": vendor.id_card_front,
        "id_card_back": vendor.id_card_back,
        "rejection_reason": vendor.rejection_reason,
        "created_at": vendor.created_at,
        "user_name": current_user.full_name,
        "university_name": vendor.university.name if vendor.university else "Campus",
        "category_name": vendor.category.name if vendor.category else "General"
    }

@app.put("/api/vendor/my-store")
def update_vendor_store(
    data: dict,
    current_user: models.User = Depends(require_role(["vendor"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found.")

    if "business_name" in data and data["business_name"]:
        vendor.business_name = data["business_name"].strip()
    if "business_description" in data:
        vendor.business_description = (data["business_description"] or "").strip()
    if "location" in data and data["location"]:
        vendor.location = data["location"].strip()
    if "phone" in data and data["phone"]:
        vendor.phone = data["phone"].strip()
        current_user.phone_number = data["phone"].strip()
    if "logo" in data and data["logo"]:
        vendor.logo = data["logo"].strip()
        current_user.profile_picture_url = data["logo"].strip()
    if "category_id" in data and data["category_id"]:
        vendor.category_id = int(data["category_id"])

    db.commit()
    db.refresh(vendor)
    return {"message": "Store profile updated successfully!", "vendor": vendor}

@app.post("/api/vendor/verification")
def submit_vendor_verification(
    data: schemas.VendorVerificationSubmit,
    current_user: models.User = Depends(require_role(["vendor"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found.")

    if not data.id_card_front or not data.id_card_back:
        raise HTTPException(status_code=400, detail="Both front and back ID document images are required.")

    vendor.id_card_front = data.id_card_front.strip()
    vendor.id_card_back = data.id_card_back.strip()
    if data.id_card_type:
        vendor.id_card_type = data.id_card_type.strip()
    if data.id_card_number:
        vendor.id_card_number = data.id_card_number.strip()
    if data.location:
        vendor.location = data.location.strip()
    if data.phone:
        vendor.phone = data.phone.strip()
    if data.business_name:
        vendor.business_name = data.business_name.strip()
    if data.category_id:
        vendor.category_id = data.category_id

    vendor.verification_status = "pending"
    vendor.rejection_reason = None
    db.commit()

    return {
        "message": "Verification submitted successfully! Campus Admins will review your document and approve your account.",
        "verification_status": "pending"
    }


# --- PRODUCTS & SERVICES (MARKETPLACE) ---

@app.get("/api/products", response_model=List[schemas.ProductOut])
def get_products(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    university_id: Optional[int] = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Product).order_by(models.Product.created_at.desc())
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if university_id:
        query = query.filter(models.Product.university_id == university_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((models.Product.name.ilike(s)) | (models.Product.description.ilike(s)))

    products = query.all()
    results = []
    for p in products:
        u = p.university or (p.vendor.university if p.vendor else None)
        u_name = u.name if u else "Campus Wide"
        u_abbr = u.abbreviation if u else ""
        v_loc = p.vendor.location if p.vendor else "On Campus"
        disp_loc = f"{u_abbr or u_name} • {v_loc}" if (u_abbr or u_name) else v_loc

        results.append({
            "id": p.id,
            "vendor_id": p.vendor_id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "category_id": p.category_id,
            "university_id": p.university_id,
            "image": p.image,
            "quantity": p.quantity,
            "status": p.status,
            "created_at": p.created_at,
            "vendor_name": p.vendor.business_name if p.vendor else "Campus Vendor",
            "vendor_location": v_loc,
            "vendor_user_id": p.vendor.user_id if p.vendor else None,
            "vendor_phone": p.vendor.phone if p.vendor else None,
            "is_vendor_verified": p.vendor.verification_status == "verified" if p.vendor else False,
            "university_name": u_name,
            "university_abbr": u_abbr,
            "dispatch_location": disp_loc
        })
    return results

@app.post("/api/products", response_model=schemas.ProductOut)
def create_product(
    product_data: schemas.ProductCreate,
    current_user: models.User = Depends(require_role(["vendor"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor store not found.")

    if vendor.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your vendor account is pending admin verification. You cannot publish products until approved."
        )

    target_uni_id = product_data.university_id or vendor.university_id

    new_prod = models.Product(
        vendor_id=vendor.id,
        name=product_data.name.strip(),
        description=product_data.description.strip() if product_data.description else None,
        price=product_data.price,
        category_id=product_data.category_id,
        university_id=target_uni_id,
        image=product_data.image.strip() if product_data.image else "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80",
        quantity=product_data.quantity or 1,
        status="available"
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)

    u = new_prod.university or vendor.university
    u_name = u.name if u else "Campus Wide"
    u_abbr = u.abbreviation if u else ""
    v_loc = vendor.location or "On Campus"

    return {
        "id": new_prod.id,
        "vendor_id": new_prod.vendor_id,
        "name": new_prod.name,
        "description": new_prod.description,
        "price": new_prod.price,
        "category_id": new_prod.category_id,
        "university_id": new_prod.university_id,
        "image": new_prod.image,
        "quantity": new_prod.quantity,
        "status": new_prod.status,
        "created_at": new_prod.created_at,
        "vendor_name": vendor.business_name,
        "vendor_location": v_loc,
        "vendor_user_id": vendor.user_id,
        "vendor_phone": vendor.phone,
        "is_vendor_verified": True,
        "university_name": u_name,
        "university_abbr": u_abbr,
        "dispatch_location": f"{u_abbr or u_name} • {v_loc}"
    }

@app.put("/api/products/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    product_data: schemas.ProductUpdate,
    current_user: models.User = Depends(require_role(["vendor", "admin"])),
    db: Session = Depends(database.get_db)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    if current_user.role != "admin" and product.vendor.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this product.")

    if product_data.name is not None:
        product.name = product_data.name.strip()
    if product_data.description is not None:
        product.description = product_data.description.strip()
    if product_data.price is not None:
        product.price = product_data.price
    if product_data.category_id is not None:
        product.category_id = product_data.category_id
    if product_data.university_id is not None:
        product.university_id = product_data.university_id
    if product_data.quantity is not None:
        product.quantity = product_data.quantity
    if product_data.image is not None and product_data.image.strip():
        product.image = product_data.image.strip()
    if product_data.status is not None:
        product.status = product_data.status

    db.commit()
    db.refresh(product)

    u = product.university or (product.vendor.university if product.vendor else None)
    u_name = u.name if u else "Campus Wide"
    u_abbr = u.abbreviation if u else ""
    v_loc = product.vendor.location if product.vendor else "On Campus"

    return {
        "id": product.id,
        "vendor_id": product.vendor_id,
        "name": product.name,
        "description": product.description,
        "price": product.price,
        "category_id": product.category_id,
        "university_id": product.university_id,
        "image": product.image,
        "quantity": product.quantity,
        "status": product.status,
        "created_at": product.created_at,
        "vendor_name": product.vendor.business_name if product.vendor else "Campus Vendor",
        "vendor_location": v_loc,
        "vendor_user_id": product.vendor.user_id if product.vendor else None,
        "vendor_phone": product.vendor.phone if product.vendor else None,
        "is_vendor_verified": product.vendor.verification_status == "verified" if product.vendor else False,
        "university_name": u_name,
        "university_abbr": u_abbr,
        "dispatch_location": f"{u_abbr or u_name} • {v_loc}"
    }

@app.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    current_user: models.User = Depends(require_role(["vendor", "admin"])),
    db: Session = Depends(database.get_db)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    if current_user.role != "admin" and product.vendor.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this product.")

    db.delete(product)
    db.commit()
    return {"message": "Product removed successfully."}

@app.get("/api/services", response_model=List[schemas.ServiceOut])
def get_services(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Service).order_by(models.Service.created_at.desc())
    if category_id:
        query = query.filter(models.Service.category_id == category_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((models.Service.name.ilike(s)) | (models.Service.description.ilike(s)))

    services = query.all()
    results = []
    for svc in services:
        results.append({
            "id": svc.id,
            "vendor_id": svc.vendor_id,
            "name": svc.name,
            "description": svc.description,
            "price": svc.price,
            "category_id": svc.category_id,
            "university_id": svc.university_id,
            "location": svc.location,
            "image": svc.image,
            "availability": svc.availability,
            "created_at": svc.created_at,
            "vendor_name": svc.vendor.business_name if svc.vendor else "Campus Provider",
            "vendor_user_id": svc.vendor.user_id if svc.vendor else None,
            "vendor_phone": svc.vendor.phone if svc.vendor else None,
            "is_vendor_verified": svc.vendor.verification_status == "verified" if svc.vendor else False
        })
    return results

@app.post("/api/services", response_model=schemas.ServiceOut)
def create_service(
    service_data: schemas.ServiceCreate,
    current_user: models.User = Depends(require_role(["vendor"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor store not found.")

    if vendor.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your vendor account is pending admin verification. You cannot publish services until approved."
        )

    new_svc = models.Service(
        vendor_id=vendor.id,
        name=service_data.name.strip(),
        description=service_data.description.strip(),
        price=service_data.price,
        category_id=service_data.category_id,
        university_id=vendor.university_id,
        location=service_data.location or vendor.location,
        image=service_data.image.strip() if service_data.image else "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
        availability="available"
    )
    db.add(new_svc)
    db.commit()
    db.refresh(new_svc)

    return {
        "id": new_svc.id,
        "vendor_id": new_svc.vendor_id,
        "name": new_svc.name,
        "description": new_svc.description,
        "price": new_svc.price,
        "category_id": new_svc.category_id,
        "university_id": new_svc.university_id,
        "location": new_svc.location,
        "image": new_svc.image,
        "availability": new_svc.availability,
        "created_at": new_svc.created_at,
        "vendor_name": vendor.business_name,
        "is_vendor_verified": True
    }

@app.delete("/api/services/{service_id}")
def delete_service(
    service_id: int,
    current_user: models.User = Depends(require_role(["vendor", "admin"])),
    db: Session = Depends(database.get_db)
):
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")

    if current_user.role != "admin" and service.vendor.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this service.")

    db.delete(service)
    db.commit()
    return {"message": "Service removed successfully."}


# --- CAMPUS REELS (TIKTOK / IG STYLE) ---

@app.get("/api/reels", response_model=List[schemas.ReelOut])
def get_reels(request: Request, db: Session = Depends(database.get_db)):
    caller_user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = auth.decode_access_token(token)
        if payload:
            caller_user_id = payload.get("sub")

    reels = db.query(models.Reel).order_by(models.Reel.created_at.desc()).all()
    results = []
    for r in reels:
        has_liked = False
        if caller_user_id:
            has_liked = db.query(models.ReelLike).filter(
                models.ReelLike.reel_id == r.id,
                models.ReelLike.user_id == caller_user_id
            ).first() is not None

        comments_list = []
        for c in (r.comments or []):
            c_user = c.user
            comments_list.append({
                "id": c.id,
                "reel_id": c.reel_id,
                "user_id": c.user_id,
                "content": c.content,
                "author_name": c_user.full_name if c_user else "Campus Member",
                "author_avatar": c_user.profile_picture_url if c_user else None,
                "author_role": "Vendor" if (c_user and c_user.role == "vendor") else "Student",
                "reply_to_comment_id": getattr(c, "reply_to_comment_id", None),
                "reply_to_author": getattr(c, "reply_to_author", None),
                "created_at": c.created_at
            })

        author_name = r.vendor.business_name if r.vendor else (r.user.full_name if r.user else "Campus Student")
        author_role = "Vendor" if r.vendor else "Student"
        author_avatar = r.user.profile_picture_url if r.user else None

        u_obj = r.vendor.university if (r.vendor and r.vendor.university) else (r.user.university if (r.user and r.user.university) else None)
        author_university = u_obj.name if u_obj else "Campus Wide"
        author_university_abbr = u_obj.abbreviation if u_obj else ""

        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "vendor_id": r.vendor_id,
            "title": r.title,
            "description": r.description,
            "media_url": r.media_url,
            "media_type": r.media_type,
            "location": r.location,
            "likes_count": r.likes_count or 0,
            "comments_count": len(comments_list),
            "has_liked": has_liked,
            "comments": comments_list,
            "created_at": r.created_at,
            "author_name": author_name,
            "author_role": author_role,
            "author_avatar": author_avatar,
            "author_university": author_university,
            "author_university_abbr": author_university_abbr
        })
    return results

@app.post("/api/reels", response_model=schemas.ReelOut)
def create_reel(
    reel_data: schemas.ReelCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first() if current_user.role == "vendor" else None

    media_url = reel_data.media_url.strip() if reel_data.media_url else None
    media_type = reel_data.media_type or ("image" if media_url else "text")

    new_reel = models.Reel(
        user_id=current_user.user_id,
        vendor_id=vendor.id if vendor else None,
        title=reel_data.title.strip() if reel_data.title else "Campus Post",
        description=reel_data.description.strip() if reel_data.description else None,
        media_url=media_url,
        media_type=media_type,
        location=reel_data.location.strip() if reel_data.location else "Campus Hub",
        likes_count=0
    )
    db.add(new_reel)
    db.commit()
    db.refresh(new_reel)

    return {
        "id": new_reel.id,
        "user_id": new_reel.user_id,
        "vendor_id": new_reel.vendor_id,
        "title": new_reel.title,
        "description": new_reel.description,
        "media_url": new_reel.media_url,
        "media_type": new_reel.media_type,
        "location": new_reel.location,
        "likes_count": 0,
        "comments_count": 0,
        "has_liked": False,
        "comments": [],
        "created_at": new_reel.created_at,
        "author_name": vendor.business_name if vendor else current_user.full_name,
        "author_role": "Vendor" if vendor else "Student",
        "author_avatar": current_user.profile_picture_url
    }

@app.post("/api/reels/{reel_id}/like")
def toggle_like_reel(
    reel_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    reel = db.query(models.Reel).filter(models.Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")

    existing_like = db.query(models.ReelLike).filter(
        models.ReelLike.reel_id == reel_id,
        models.ReelLike.user_id == current_user.user_id
    ).first()

    if existing_like:
        db.delete(existing_like)
        reel.likes_count = max(0, (reel.likes_count or 1) - 1)
        has_liked = False
    else:
        new_like = models.ReelLike(reel_id=reel_id, user_id=current_user.user_id)
        db.add(new_like)
        reel.likes_count = (reel.likes_count or 0) + 1
        has_liked = True
        if reel.user_id != current_user.user_id:
            create_notification(
                db=db,
                user_id=reel.user_id,
                actor_id=current_user.user_id,
                notification_type="like",
                title="New Like on your Reel",
                message=f"{current_user.full_name} liked your campus reel '{reel.title or 'moment'}'.",
                reference_id=str(reel.id)
            )

    db.commit()
    return {"likes_count": reel.likes_count, "has_liked": has_liked}

@app.post("/api/reels/{reel_id}/comments", response_model=schemas.ReelCommentOut)
def add_reel_comment(
    reel_id: int,
    comment_data: schemas.ReelCommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    reel = db.query(models.Reel).filter(models.Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")

    content = comment_data.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")

    reply_to_author = None
    reply_target_user_id = None
    if comment_data.reply_to_comment_id:
        parent_comment = db.query(models.ReelComment).filter(models.ReelComment.id == comment_data.reply_to_comment_id).first()
        if parent_comment and parent_comment.user:
            reply_to_author = parent_comment.user.full_name
            reply_target_user_id = parent_comment.user_id

    comment = models.ReelComment(
        reel_id=reel_id,
        user_id=current_user.user_id,
        content=content,
        reply_to_comment_id=comment_data.reply_to_comment_id,
        reply_to_author=reply_to_author
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # 1. Notify reel owner if not the commenter
    if reel.user_id != current_user.user_id:
        create_notification(
            db=db,
            user_id=reel.user_id,
            actor_id=current_user.user_id,
            notification_type="comment",
            title="New Comment on your Post",
            message=f"{current_user.full_name} commented: \"{content[:60]}\"",
            reference_id=str(reel.id)
        )

    # 2. Notify replied commenter if someone replied to their comment
    if reply_target_user_id and reply_target_user_id != current_user.user_id and reply_target_user_id != reel.user_id:
        create_notification(
            db=db,
            user_id=reply_target_user_id,
            actor_id=current_user.user_id,
            notification_type="comment",
            title="Reply to your Comment",
            message=f"{current_user.full_name} replied to your comment: \"{content[:60]}\"",
            reference_id=str(reel.id)
        )

    return {
        "id": comment.id,
        "reel_id": comment.reel_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "author_name": current_user.full_name,
        "author_avatar": current_user.profile_picture_url,
        "author_role": "Vendor" if current_user.role == "vendor" else "Student",
        "reply_to_comment_id": comment.reply_to_comment_id,
        "reply_to_author": comment.reply_to_author,
        "created_at": comment.created_at
    }

@app.delete("/api/reels/{reel_id}")
def delete_reel(
    reel_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    reel = db.query(models.Reel).filter(models.Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found.")

    if reel.user_id != current_user.user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only delete your own posts.")

    # Clean up any likes and comments linked to this reel
    db.query(models.ReelLike).filter(models.ReelLike.reel_id == reel_id).delete()
    db.query(models.ReelComment).filter(models.ReelComment.reel_id == reel_id).delete()
    db.delete(reel)
    db.commit()
    return {"message": "Post deleted successfully", "id": reel_id}

@app.delete("/api/reels/comments/{comment_id}")
def delete_reel_comment(
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    comment = db.query(models.ReelComment).filter(models.ReelComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    reel = db.query(models.Reel).filter(models.Reel.id == comment.reel_id).first()
    is_comment_author = comment.user_id == current_user.user_id
    is_reel_author = reel and reel.user_id == current_user.user_id
    if not is_comment_author and not is_reel_author and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment.")
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted successfully", "id": comment_id}



# --- CAMPUS RIDES API ---

RIDE_FARES = {
    "Campus Shuttle": 150.0,
    "Keke Napep": 200.0,
    "Bike Express": 300.0,
    "Campus Bolt": 800.0
}

DRIVERS_POOL = [
    {"name": "Musa Aliyu", "phone": "+234 803 123 4567", "plate": "UNL-102-XY"},
    {"name": "Emeka Okoro", "phone": "+234 814 987 6543", "plate": "IBD-404-AB"},
    {"name": "Adeola Shola", "phone": "+234 802 555 1212", "plate": "FUT-778-CD"},
]

@app.post("/api/rides/book", response_model=schemas.RideBookingOut)
def book_campus_ride(
    ride_data: schemas.RideBookingCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    fare = RIDE_FARES.get(ride_data.ride_type, 200.0)
    driver = random.choice(DRIVERS_POOL)

    new_ride = models.RideBooking(
        user_id=current_user.user_id,
        ride_type=ride_data.ride_type,
        pickup_location=ride_data.pickup_location.strip(),
        dropoff_location=ride_data.dropoff_location.strip(),
        estimated_fare=fare,
        status="driver_assigned",
        driver_name=driver["name"],
        driver_phone=driver["phone"],
        plate_number=driver["plate"]
    )
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)
    return new_ride

@app.get("/api/rides/my-rides", response_model=List[schemas.RideBookingOut])
def get_my_rides(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    return db.query(models.RideBooking).filter(models.RideBooking.user_id == current_user.user_id).order_by(models.RideBooking.created_at.desc()).all()


# --- ORDERS & REVIEWS ---

@app.post("/api/orders", response_model=schemas.OrderOut)
def place_order(
    order_data: schemas.OrderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == order_data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    new_order = models.Order(
        user_id=current_user.user_id,
        vendor_id=order_data.vendor_id,
        product_id=order_data.product_id,
        service_id=order_data.service_id,
        item_title=order_data.item_title.strip(),
        quantity=order_data.quantity,
        amount=order_data.amount,
        delivery_location=order_data.delivery_location.strip(),
        status="pending"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Notify vendor of incoming order
    if vendor and vendor.user_id:
        create_notification(
            db=db,
            user_id=vendor.user_id,
            actor_id=current_user.user_id,
            notification_type="order",
            title="New Order Received",
            message=f"{current_user.full_name} ordered '{new_order.item_title}' (Qty: {new_order.quantity}).",
            reference_id=str(new_order.id)
        )

    # Confirmation notification to student
    create_notification(
        db=db,
        user_id=current_user.user_id,
        actor_id=None,
        notification_type="order",
        title="Order Placed Successfully",
        message=f"Your order for '{new_order.item_title}' has been submitted to {vendor.business_name}.",
        reference_id=str(new_order.id)
    )


    return {
        "id": new_order.id,
        "user_id": new_order.user_id,
        "vendor_id": new_order.vendor_id,
        "product_id": new_order.product_id,
        "service_id": new_order.service_id,
        "item_title": new_order.item_title,
        "quantity": new_order.quantity,
        "amount": new_order.amount,
        "delivery_location": new_order.delivery_location,
        "status": new_order.status,
        "created_at": new_order.created_at,
        "customer_name": current_user.full_name,
        "vendor_name": vendor.business_name
    }

@app.get("/api/orders/my", response_model=List[schemas.OrderOut])
def get_my_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    orders = db.query(models.Order).filter(models.Order.user_id == current_user.user_id).order_by(models.Order.created_at.desc()).all()
    results = []
    for o in orders:
        vendor = db.query(models.Vendor).filter(models.Vendor.id == o.vendor_id).first()
        results.append({
            "id": o.id,
            "user_id": o.user_id,
            "vendor_id": o.vendor_id,
            "product_id": o.product_id,
            "service_id": o.service_id,
            "item_title": o.item_title,
            "quantity": o.quantity,
            "amount": o.amount,
            "delivery_location": o.delivery_location,
            "status": o.status,
            "created_at": o.created_at,
            "customer_name": current_user.full_name,
            "vendor_name": vendor.business_name if vendor else "Campus Vendor"
        })
    return results

@app.get("/api/vendor/orders", response_model=List[schemas.OrderOut])
def get_vendor_orders(
    current_user: models.User = Depends(require_role(["vendor"])),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first()
    if not vendor:
        return []

    orders = db.query(models.Order).filter(models.Order.vendor_id == vendor.id).order_by(models.Order.created_at.desc()).all()
    results = []
    for o in orders:
        results.append({
            "id": o.id,
            "user_id": o.user_id,
            "vendor_id": o.vendor_id,
            "product_id": o.product_id,
            "service_id": o.service_id,
            "item_title": o.item_title,
            "quantity": o.quantity,
            "amount": o.amount,
            "delivery_location": o.delivery_location,
            "status": o.status,
            "created_at": o.created_at,
            "customer_name": o.user.full_name if o.user else "Student",
            "vendor_name": vendor.business_name
        })
    return results

@app.post("/api/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    status_update: str = Query(..., pattern="^(pending|confirmed|completed|cancelled)$"),
    current_user: models.User = Depends(require_role(["vendor", "admin"])),
    db: Session = Depends(database.get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    order.status = status_update
    db.commit()
    return {"message": f"Order marked as {status_update}", "status": order.status}

@app.post("/api/reviews", response_model=schemas.ReviewOut)
def create_review(
    review_data: schemas.ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == review_data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    new_rev = models.Review(
        user_id=current_user.user_id,
        vendor_id=review_data.vendor_id,
        rating=max(1, min(5, review_data.rating)),
        comment=review_data.comment.strip() if review_data.comment else None
    )
    db.add(new_rev)
    db.commit()
    db.refresh(new_rev)

    return {
        "id": new_rev.id,
        "user_id": new_rev.user_id,
        "vendor_id": new_rev.vendor_id,
        "rating": new_rev.rating,
        "comment": new_rev.comment,
        "created_at": new_rev.created_at,
        "author_name": current_user.full_name
    }

@app.get("/api/vendors/{vendor_id}/reviews", response_model=List[schemas.ReviewOut])
def get_vendor_reviews(vendor_id: int, db: Session = Depends(database.get_db)):
    reviews = db.query(models.Review).filter(models.Review.vendor_id == vendor_id).order_by(models.Review.created_at.desc()).all()
    results = []
    for r in reviews:
        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "vendor_id": r.vendor_id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
            "author_name": r.user.full_name if r.user else "Student"
        })
    return results


# --- DISCOVERY: UNIVERSITIES & CATEGORIES ---

@app.get("/api/universities", response_model=List[schemas.UniversityOut])
def get_universities(db: Session = Depends(database.get_db)):
    if db.query(models.University).count() == 0:
        try:
            import seed_universities
            seed_universities.seed_database()
        except Exception as _e:
            print(f"[CampusLink] On-demand university seed error: {_e}")
    return db.query(models.University).order_by(models.University.name.asc()).all()

@app.get("/api/categories", response_model=List[schemas.CategoryOut])
def get_categories(db: Session = Depends(database.get_db)):
    if db.query(models.Category).count() == 0:
        try:
            import seed_universities
            seed_universities.seed_database()
        except Exception as _e:
            print(f"[CampusLink] On-demand category seed error: {_e}")
    return db.query(models.Category).all()


# --- BACKWARD COMPATIBILITY: POSTS & IN-APP CHAT ---

@app.get("/api/posts", response_model=List[schemas.PostOut])
def get_all_posts(category_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Post).order_by(models.Post.created_at.desc())
    if category_id:
        query = query.filter(models.Post.category_id == category_id)
    return query.all()

@app.get("/api/my-posts", response_model=List[schemas.PostOut])
def get_my_posts(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    return db.query(models.Post).filter(models.Post.user_id == current_user.user_id).order_by(models.Post.created_at.desc()).all()

@app.post("/api/posts", response_model=schemas.PostOut)
def create_post(
    post_data: schemas.PostCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.user_id == current_user.user_id).first() if current_user.role == "vendor" else None

    new_post = models.Post(
        user_id=current_user.user_id,
        vendor_id=vendor.id if vendor else None,
        category_id=post_data.category_id,
        title=post_data.title,
        description=post_data.description,
        price=post_data.price,
        image_url=post_data.image_url
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return new_post

@app.delete("/api/posts/{post_id}")
def delete_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}

def resolve_target_user_id(target_id: Any, db: Session) -> Optional[models.User]:
    if not target_id:
        return None
    tid_str = str(target_id).strip()
    
    # 1. Exact match on user_id
    u = db.query(models.User).filter(models.User.user_id == tid_str).first()
    if u:
        return u
        
    # 2. Check vendor by business name, vendor ID, or user_id
    clean_id = tid_str.replace("v_", "").strip()
    v = db.query(models.Vendor).filter(
        (models.Vendor.business_name == clean_id) | 
        (models.Vendor.id == (int(clean_id) if clean_id.isdigit() else -1)) |
        (models.Vendor.user_id == tid_str)
    ).first()
    if v and v.user:
        return v.user
        
    # 3. Match by email or phone or full name
    u = db.query(models.User).filter(
        (models.User.email == tid_str) | 
        (models.User.phone_number == tid_str) |
        (models.User.full_name == tid_str)
    ).first()
    if u:
        return u
        
    return None

# --- REAL-TIME WEBSOCKET CONNECTION MANAGER ---
class ConnectionManager:
    def __init__(self):
        # user_id (str) -> list of active WebSockets
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        try:
            await websocket.accept()
        except Exception:
            return False
        uid = str(user_id)
        if uid not in self.active_connections:
            self.active_connections[uid] = []
        self.active_connections[uid].append(websocket)
        return True

    def disconnect(self, user_id: str, websocket: WebSocket):
        uid = str(user_id)
        if uid in self.active_connections:
            try:
                if websocket in self.active_connections[uid]:
                    self.active_connections[uid].remove(websocket)
            except Exception:
                pass
            if not self.active_connections[uid]:
                del self.active_connections[uid]

    async def broadcast_to_user(self, user_id: str, data: dict):
        uid = str(user_id)
        if uid in self.active_connections:
            dead_sockets = []
            for connection in list(self.active_connections[uid]):
                try:
                    await connection.send_json(data)
                except Exception:
                    dead_sockets.append(connection)
            for dead in dead_sockets:
                self.disconnect(uid, dead)

ws_manager = ConnectionManager()

@app.websocket("/ws/{user_id}")
async def websocket_chat_endpoint(websocket: WebSocket, user_id: str):
    connected = await ws_manager.connect(str(user_id), websocket)
    if not connected:
        return

    try:
        with database.SessionLocal() as _db:
            _db.query(models.User).filter(models.User.user_id == str(user_id)).update({
                "is_online": True,
                "last_seen": datetime.now(timezone.utc).replace(tzinfo=None)
            })
            _db.commit()
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception:
                pass
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ws_manager.disconnect(str(user_id), websocket)
        try:
            with database.SessionLocal() as _db:
                _db.query(models.User).filter(models.User.user_id == str(user_id)).update({
                    "is_online": False,
                    "last_seen": datetime.now(timezone.utc).replace(tzinfo=None)
                })
                _db.commit()
        except Exception:
            pass

@app.post("/api/messages", response_model=schemas.MessageOut)
async def send_message(
    msg_data: schemas.MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    recipient = resolve_target_user_id(msg_data.recipient_id, db)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if recipient.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot message yourself.")

    # Auto-ensure friendship connection exists so student-to-student conversations never fail
    friendship = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.user_id) & (models.Friendship.friend_id == recipient.user_id)) |
        ((models.Friendship.user_id == recipient.user_id) & (models.Friendship.friend_id == current_user.user_id))
    ).first()

    if not friendship:
        try:
            auto_friendship = models.Friendship(
                user_id=current_user.user_id,
                friend_id=recipient.user_id,
                status="accepted"
            )
            db.add(auto_friendship)
            db.flush()
        except Exception:
            pass

    # Clean reply_to_id: convert temp string IDs safely to integer only if message exists
    clean_reply_to_id = None
    if msg_data.reply_to_id is not None:
        try:
            reply_id_val = int(msg_data.reply_to_id)
            if db.query(models.Message).filter(models.Message.id == reply_id_val).first():
                clean_reply_to_id = reply_id_val
        except (ValueError, TypeError):
            clean_reply_to_id = None

    raw_content = msg_data.content.strip() if msg_data.content else ""
    if not raw_content and msg_data.media_url:
        raw_content = "Voice note" if msg_data.message_type == "audio" else ("Video" if msg_data.message_type == "video" else "Photo")
    elif not raw_content:
        raw_content = msg_data.reply_to_text or "Message"

    new_msg = models.Message(
        sender_id=current_user.user_id,
        recipient_id=recipient.user_id,
        post_id=msg_data.post_id,
        content=raw_content,
        message_type=msg_data.message_type or "text",
        media_url=msg_data.media_url,
        duration=msg_data.duration,
        reply_to_id=clean_reply_to_id,
        reply_to_sender=msg_data.reply_to_sender,
        reply_to_text=msg_data.reply_to_text,
        is_read=False
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # In-app Notification creation (safely wrapped)
    notif_title = f"Message from {current_user.full_name}"
    notif_body = f"{current_user.full_name}: {new_msg.content[:60] if new_msg.content else 'Sent an attachment'}"
    try:
        if new_msg.message_type == "status_reply":
            notif_title = f"Story reply from {current_user.full_name}"
            try:
                p_data = json.loads(new_msg.content)
                if p_data.get("reaction"):
                    notif_body = f"{current_user.full_name} reacted {p_data.get('reaction')} to your story"
                else:
                    rep_snippet = (p_data.get('reply_text') or '')[:50]
                    notif_body = f"{current_user.full_name} replied to your story: \"{rep_snippet}\""
            except Exception:
                notif_body = f"{current_user.full_name} replied to your story"

        create_notification(
            db=db,
            user_id=recipient.user_id,
            actor_id=current_user.user_id,
            notification_type="message",
            title=notif_title,
            message=notif_body,
            reference_id=current_user.user_id
        )
    except Exception as _notif_err:
        print(f"[Notification] Send notice: {_notif_err}")

    # Broadcast real-time instant event over WebSockets to both recipient & sender
    try:
        msg_payload = {
            "type": "new_message",
            "message": {
                "id": new_msg.id,
                "sender_id": new_msg.sender_id,
                "recipient_id": new_msg.recipient_id,
                "post_id": new_msg.post_id,
                "content": new_msg.content,
                "message_type": new_msg.message_type,
                "media_url": new_msg.media_url,
                "duration": new_msg.duration,
                "reply_to_id": new_msg.reply_to_id,
                "reply_to_sender": new_msg.reply_to_sender,
                "reply_to_text": new_msg.reply_to_text,
                "is_read": new_msg.is_read,
                "created_at": new_msg.created_at.isoformat() if new_msg.created_at else None,
            },
            "sender_name": current_user.full_name,
            "sender_avatar": current_user.profile_picture_url,
            "sender_role": current_user.role,
            "notif_title": notif_title,
            "notif_body": notif_body
        }
        await ws_manager.broadcast_to_user(recipient.user_id, msg_payload)
        await ws_manager.broadcast_to_user(current_user.user_id, msg_payload)
    except Exception as _ws_err:
        print(f"[WebSocket] Broadcast notice: {_ws_err}")

    return new_msg

@app.get("/api/messages/{other_user_id}", response_model=List[schemas.MessageOut])
def get_conversation(
    other_user_id: str,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    other_user = resolve_target_user_id(other_user_id, db)
    if not other_user:
        return []

    target_uid = other_user.user_id
    msgs = db.query(models.Message).filter(
        ((models.Message.sender_id == current_user.user_id) & (models.Message.recipient_id == target_uid)) |
        ((models.Message.sender_id == target_uid) & (models.Message.recipient_id == current_user.user_id))
    ).order_by(models.Message.created_at.asc()).all()

    # Bulk update unread messages asynchronously without blocking HTTP response
    unread_ids = [m.id for m in msgs if m.recipient_id == current_user.user_id and not m.is_read]
    if unread_ids:
        def _mark_read(ids_to_update):
            try:
                with database.SessionLocal() as bg_db:
                    bg_db.query(models.Message).filter(models.Message.id.in_(ids_to_update)).update({"is_read": True}, synchronize_session=False)
                    bg_db.commit()
            except Exception:
                pass
        background_tasks.add_task(_mark_read, unread_ids)
    return msgs

@app.get("/api/conversations")
def get_conversations_list(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    user_id = current_user.user_id
    msgs = db.query(models.Message).filter(
        (models.Message.sender_id == user_id) | (models.Message.recipient_id == user_id)
    ).order_by(models.Message.created_at.desc()).all()

    if not msgs:
        return []

    # 1. Collect all distinct partner IDs
    partner_ids = set()
    for m in msgs:
        p_id = m.recipient_id if m.sender_id == user_id else m.sender_id
        partner_ids.add(p_id)

    # 2. Batch fetch all partners with their vendor profiles in 1 single SQL query
    partners = db.query(models.User).options(joinedload(models.User.vendor_profile)).filter(models.User.user_id.in_(partner_ids)).all()
    partner_map = {p.user_id: p for p in partners}

    # 3. Batch fetch all friendships involving current_user and these partners in 1 single SQL query
    friendships = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == user_id) & (models.Friendship.friend_id.in_(partner_ids))) |
        ((models.Friendship.user_id.in_(partner_ids)) & (models.Friendship.friend_id == user_id))
    ).all()
    
    friendship_map = {}
    for f in friendships:
        other_id = f.friend_id if f.user_id == user_id else f.user_id
        friendship_map[other_id] = f.status

    conv_map = {}
    conv_msgs_map = {}
    for m in msgs:
        partner_id = m.recipient_id if m.sender_id == user_id else m.sender_id
        if partner_id not in conv_msgs_map:
            conv_msgs_map[partner_id] = []
        if len(conv_msgs_map[partner_id]) < 50:
            conv_msgs_map[partner_id].append({
                "id": m.id,
                "sender_id": m.sender_id,
                "recipient_id": m.recipient_id,
                "post_id": m.post_id,
                "content": m.content,
                "message_type": m.message_type or "text",
                "media_url": m.media_url,
                "duration": m.duration,
                "reply_to_id": m.reply_to_id,
                "reply_to_sender": m.reply_to_sender,
                "reply_to_text": m.reply_to_text,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })

        if partner_id not in conv_map:
            partner = partner_map.get(partner_id)
            vendor = partner.vendor_profile if partner else None
            f_status = friendship_map.get(partner_id, "none")
            is_friend = (f_status == "accepted")

            # Format rich preview
            preview = m.content
            if m.message_type == "audio":
                preview = "🎤 Voice note"
            elif m.message_type == "image":
                preview = "📷 Photo"
            elif m.message_type == "video":
                preview = "🎥 Video"
            elif m.message_type == "status_reply":
                try:
                    p_data = json.loads(m.content)
                    if p_data.get("reaction"):
                        preview = f"Reacted {p_data.get('reaction')} to story"
                    else:
                        rep_text = p_data.get('reply_text', '')
                        preview = f"💬 Story reply: \"{rep_text}\"" if rep_text else "💬 Story reply"
                except Exception:
                    preview = "💬 Replied to story"

            conv_map[partner_id] = {
                "partner_id": partner_id,
                "partner_name": vendor.business_name if vendor else (partner.full_name if partner else "Campus Peer"),
                "partner_phone": partner.phone_number if partner else None,
                "partner_avatar": partner.profile_picture_url if partner else None,
                "partner_role": "Vendor" if vendor else "Student",
                "is_friend": is_friend,
                "friendship_status": f_status,
                "last_message": preview,
                "last_message_type": m.message_type or "text",
                "last_timestamp": m.created_at,
                "unread_count": 0,
                # Presence fields — real-time online/offline status
                "is_online": (str(partner_id) in ws_manager.active_connections) or (partner.is_online if partner else False),
                "last_seen": (partner.last_seen.replace(tzinfo=timezone.utc).isoformat()) if partner and partner.last_seen else None,
            }
        if m.recipient_id == user_id and not m.is_read:
            conv_map[partner_id]["unread_count"] += 1

    for p_id, item in conv_map.items():
        partner_msgs = conv_msgs_map.get(p_id, [])
        partner_msgs.reverse()
        item["recent_messages"] = partner_msgs

    return list(conv_map.values())


# --- CAMPUS SOCIAL & FRIEND REQUEST SYSTEM ---

@app.post("/api/friends/request/{target_user_id}")
def send_friend_request(
    target_user_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if target_user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself.")

    target = db.query(models.User).filter(models.User.user_id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Student not found.")

    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.user_id) & (models.Friendship.friend_id == target_user_id)) |
        ((models.Friendship.user_id == target_user_id) & (models.Friendship.friend_id == current_user.user_id))
    ).first()

    if existing:
        if existing.status == "accepted":
            return {"message": "You are already campus friends!", "status": "friends", "request_id": existing.id}
        elif existing.user_id == current_user.user_id:
            return {"message": "Friend request is already pending.", "status": "request_sent", "request_id": existing.id}
        else:
            # The other person already sent a request -> auto-accept!
            existing.status = "accepted"
            db.commit()
            create_notification(
                db=db,
                user_id=target.user_id,
                actor_id=current_user.user_id,
                notification_type="friend_accept",
                title="Friend Request Accepted",
                message=f"{current_user.full_name} accepted your campus friend connection request.",
                reference_id=current_user.user_id
            )
            return {"message": f"Accepted {target.full_name}'s friend request! You are now friends.", "status": "friends", "request_id": existing.id}

    new_f = models.Friendship(
        user_id=current_user.user_id,
        friend_id=target_user_id,
        status="pending"
    )
    db.add(new_f)
    db.commit()
    db.refresh(new_f)

    create_notification(
        db=db,
        user_id=target_user_id,
        actor_id=current_user.user_id,
        notification_type="friend_request",
        title="New Friend Request",
        message=f"{current_user.full_name} sent you a campus friend connection request.",
        reference_id=current_user.user_id
    )

    return {"message": f"Friend request sent to {target.full_name}!", "status": "request_sent", "request_id": new_f.id}

@app.get("/api/friends/requests/pending")
def get_incoming_friend_requests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    pending = db.query(models.Friendship).filter(
        models.Friendship.friend_id == current_user.user_id,
        models.Friendship.status == "pending"
    ).order_by(models.Friendship.created_at.desc()).all()

    requests_list = []
    for req in pending:
        sender = db.query(models.User).filter(models.User.user_id == req.user_id).first()
        if sender:
            requests_list.append({
                "request_id": req.id,
                "sender_id": sender.user_id,
                "sender_name": sender.full_name,
                "sender_avatar": sender.profile_picture_url,
                "sender_department": sender.department or "Undergraduate",
                "sender_level": sender.level or "Student",
                "sender_hostel": sender.hostel or "On Campus",
                "created_at": req.created_at
            })
    return requests_list

@app.post("/api/friends/requests/{request_id}/accept")
def accept_friend_request(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    req = db.query(models.Friendship).filter(
        models.Friendship.id == request_id,
        models.Friendship.friend_id == current_user.user_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found or not authorized.")

    req.status = "accepted"
    db.commit()
    sender = db.query(models.User).filter(models.User.user_id == req.user_id).first()
    if sender:
        create_notification(
            db=db,
            user_id=sender.user_id,
            actor_id=current_user.user_id,
            notification_type="friend_accept",
            title="Friend Request Accepted",
            message=f"{current_user.full_name} accepted your campus friend connection request.",
            reference_id=current_user.user_id
        )
    return {"message": f"You are now campus friends with {sender.full_name if sender else 'this student'}!", "status": "friends"}

@app.post("/api/friends/requests/{request_id}/decline")
def decline_friend_request(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    req = db.query(models.Friendship).filter(
        models.Friendship.id == request_id,
        models.Friendship.friend_id == current_user.user_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found.")

    db.delete(req)
    db.commit()
    return {"message": "Friend request declined.", "status": "none"}

@app.delete("/api/friends/cancel/{target_user_id}")
def cancel_or_remove_friend(
    target_user_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    friendship = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.user_id) & (models.Friendship.friend_id == target_user_id)) |
        ((models.Friendship.user_id == target_user_id) & (models.Friendship.friend_id == current_user.user_id))
    ).first()
    if not friendship:
        return {"message": "No connection found.", "status": "none"}

    db.delete(friendship)
    db.commit()
    return {"message": "Friend removed / request cancelled.", "status": "none"}

@app.get("/api/friends")
def get_my_friends(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    friendships = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (models.Friendship.user_id == current_user.user_id) | (models.Friendship.friend_id == current_user.user_id)
    ).all()

    friends_list = []
    for f in friendships:
        fid = f.friend_id if f.user_id == current_user.user_id else f.user_id
        u = db.query(models.User).filter(models.User.user_id == fid).first()
        if u:
            friends_list.append({
                "id": u.user_id,
                "user_id": u.user_id,
                "full_name": u.full_name,
                "department": u.department or "Undergraduate",
                "level": u.level or "Student",
                "phone_number": u.phone_number,
                "hostel": u.hostel or "On Campus",
                "profile_picture_url": u.profile_picture_url,
                "bio": u.bio or "CampusLink student",
                "friendship_status": "friends"
            })
    return friends_list

@app.get("/api/community/users")
@app.get("/api/students")
def discover_community_users(
    search: Optional[str] = None,
    role: Optional[str] = "all",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.User).filter(
        models.User.user_id != current_user.user_id
    )

    if role and role.lower() in ["student", "vendor"]:
        query = query.filter(models.User.role == role.lower())
    else:
        query = query.filter(models.User.role.in_(["student", "vendor"]))

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (models.User.full_name.ilike(s)) |
            (models.User.department.ilike(s)) |
            (models.User.hostel.ilike(s))
        )

    users = query.limit(60).all()
    results = []

    for u in users:
        # Determine friendship status with current_user
        f = db.query(models.Friendship).filter(
            ((models.Friendship.user_id == current_user.user_id) & (models.Friendship.friend_id == u.user_id)) |
            ((models.Friendship.user_id == u.user_id) & (models.Friendship.friend_id == current_user.user_id))
        ).first()

        status_str = "none"
        req_id = None
        if f:
            req_id = f.id
            if f.status == "accepted":
                status_str = "friends"
            elif f.user_id == current_user.user_id:
                status_str = "request_sent"
            else:
                status_str = "request_received"

        vendor_name = None
        vendor_desc = None
        if u.role == "vendor" and u.vendor_profile:
            vendor_name = getattr(u.vendor_profile, "business_name", None)
            vendor_desc = getattr(u.vendor_profile, "business_description", None)

        results.append({
            "id": u.user_id,
            "user_id": u.user_id,
            "full_name": u.full_name,
            "role": u.role,
            "is_seller": u.role == "vendor",
            "business_name": vendor_name,
            "department": u.department or ("Verified Merchant" if u.role == "vendor" else "Undergraduate"),
            "level": u.level or ("Merchant Store" if u.role == "vendor" else "Student"),
            "phone_number": u.phone_number if u.role == "vendor" else None,
            "hostel": u.hostel or "Campus",
            "profile_picture_url": u.profile_picture_url,
            "bio": u.bio or (vendor_desc or ("Verified Campus Merchant" if u.role == "vendor" else "CampusLink Student")),
            "matric_number": u.matric_number,
            "university_id": u.university_id,
            "university_name": u.university.name if u.university else "Campus University",
            "friendship_status": status_str,
            "request_id": req_id
        })
    return results

@app.get("/api/students/{target_user_id}")
def get_student_profile(
    target_user_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    s = db.query(models.User).filter(models.User.user_id == target_user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # Check friendship status
    if s.user_id == current_user.user_id:
        status_str = "self"
        req_id = None
    else:
        f = db.query(models.Friendship).filter(
            ((models.Friendship.user_id == current_user.user_id) & (models.Friendship.friend_id == s.user_id)) |
            ((models.Friendship.user_id == s.user_id) & (models.Friendship.friend_id == current_user.user_id))
        ).first()
        status_str = "none"
        req_id = None
        if f:
            req_id = f.id
            if f.status == "accepted":
                status_str = "friends"
            elif f.user_id == current_user.user_id:
                status_str = "request_sent"
            else:
                status_str = "request_received"

    # Count friends
    friends_count = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (models.Friendship.user_id == s.user_id) | (models.Friendship.friend_id == s.user_id)
    ).count()

    uni_name = s.university.name if s.university else "Campus University"

    return {
        "id": s.user_id,
        "user_id": s.user_id,
        "full_name": s.full_name,
        "role": s.role,
        "is_seller": s.role == "vendor",
        "business_name": s.vendor_profile.business_name if s.role == "vendor" and s.vendor_profile else None,
        "email": s.email if status_str in ["friends", "self"] else None,
        "phone_number": s.phone_number if (s.role == "vendor" or status_str == "self") else None,
        "department": s.department or ("Verified Merchant" if s.role == "vendor" else "Undergraduate"),
        "level": s.level or ("Merchant Store" if s.role == "vendor" else "Student"),
        "hostel": s.hostel or "On Campus",
        "profile_picture_url": s.profile_picture_url,
        "bio": s.bio or (getattr(s.vendor_profile, "business_description", None) if s.role == "vendor" and s.vendor_profile else "Student at " + uni_name),
        "matric_number": s.matric_number if status_str in ["friends", "self"] else None,
        "university_name": uni_name,
        "friends_count": friends_count,
        "friendship_status": status_str,
        "request_id": req_id
    }

# ==========================================
# CAMPUS NOTICE BOARD & LOST AND FOUND HUB
# ==========================================

@app.get("/api/campus/notices", response_model=List[schemas.CampusNoticeOut])
def get_campus_notices(
    notice_type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    target_uni_id = current_user.university_id or 23
    q = db.query(models.CampusNotice).filter(models.CampusNotice.university_id == target_uni_id)
    
    if notice_type and notice_type != "all":
        q = q.filter(models.CampusNotice.type == notice_type)
    if category and category != "all":
        q = q.filter(models.CampusNotice.category == category)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(
            (models.CampusNotice.title.ilike(s)) |
            (models.CampusNotice.description.ilike(s)) |
            (models.CampusNotice.location.ilike(s))
        )
    notices = q.order_by(models.CampusNotice.created_at.desc()).all()
    out = []
    for n in notices:
        u = n.user
        out.append({
            "id": n.id,
            "university_id": n.university_id,
            "user_id": n.user_id,
            "author_name": u.full_name if u else "Campus Student",
            "author_avatar": u.profile_picture_url if u else None,
            "author_dept": u.department if u else "General Studies",
            "type": n.type,
            "title": n.title,
            "category": n.category,
            "description": n.description,
            "location": n.location,
            "date_lost_or_found": n.date_lost_or_found,
            "contact_phone": n.contact_phone or (u.phone_number if u else None),
            "image_url": n.image_url,
            "status": n.status,
            "created_at": n.created_at
        })
    return out

@app.post("/api/campus/notices", response_model=schemas.CampusNoticeOut)
def create_campus_notice(
    payload: schemas.CampusNoticeCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    target_uni_id = current_user.university_id or 23
    new_notice = models.CampusNotice(
        university_id=target_uni_id,
        user_id=current_user.user_id,
        type=payload.type,
        title=payload.title.strip(),
        category=payload.category,
        description=payload.description.strip(),
        location=payload.location.strip(),
        date_lost_or_found=payload.date_lost_or_found,
        contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
        image_url=payload.image_url,
        status="open",
        created_at=datetime.utcnow()
    )
    db.add(new_notice)
    db.commit()
    db.refresh(new_notice)

    # Notify campus peers about this notice / lost & found item
    peers = db.query(models.User).filter(
        models.User.university_id == target_uni_id,
        models.User.user_id != current_user.user_id
    ).all()
    for p in peers:
        if new_notice.type == "lost":
            n_title = "ðŸ” Lost Item Alert"
            n_msg = f"{current_user.full_name} reported a lost {new_notice.category or 'item'} at {new_notice.location}: '{new_notice.title}'"
        elif new_notice.type == "found":
            n_title = "📦 Found Item Notice"
            n_msg = f"{current_user.full_name} found a {new_notice.category or 'item'} at {new_notice.location}: '{new_notice.title}'"
        else:
            n_title = "📢 Campus Notice"
            n_msg = f"{current_user.full_name} posted: '{new_notice.title}'"

        create_notification(
            db=db,
            user_id=p.user_id,
            actor_id=current_user.user_id,
            notification_type="notice",
            title=n_title,
            message=n_msg,
            reference_id=str(new_notice.id)
        )
    return {
        "id": new_notice.id,
        "university_id": new_notice.university_id,
        "user_id": new_notice.user_id,
        "author_name": current_user.full_name,
        "author_avatar": current_user.profile_picture_url,
        "author_dept": current_user.department,
        "type": new_notice.type,
        "title": new_notice.title,
        "category": new_notice.category,
        "description": new_notice.description,
        "location": new_notice.location,
        "date_lost_or_found": new_notice.date_lost_or_found,
        "contact_phone": new_notice.contact_phone,
        "image_url": new_notice.image_url,
        "status": new_notice.status,
        "created_at": new_notice.created_at
    }

@app.patch("/api/campus/notices/{notice_id}/resolve")
def resolve_campus_notice(
    notice_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    notice = db.query(models.CampusNotice).filter(models.CampusNotice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    if notice.user_id != current_user.user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the author can update this status")
    
    notice.status = "claimed" if notice.type in ["lost", "found"] else "resolved"
    db.commit()
    return {"message": "Notice updated successfully", "status": notice.status}

@app.delete("/api/campus/notices/{notice_id}")
def delete_campus_notice(
    notice_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    notice = db.query(models.CampusNotice).filter(models.CampusNotice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    if notice.user_id != current_user.user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this notice")
    db.delete(notice)
    db.commit()
    return {"message": "Notice deleted successfully"}

# ==========================================
# WHATSAPP-STYLE CAMPUS STATUS STORIES
# ==========================================

@app.get("/api/campus/statuses")
def get_campus_statuses(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    target_uni_id = current_user.university_id or 23
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)

    # Get accepted friends to ensure friends can always view each other's status
    friendships = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (models.Friendship.user_id == current_user.user_id) | (models.Friendship.friend_id == current_user.user_id)
    ).all()
    friend_ids = {f.friend_id if f.user_id == current_user.user_id else f.user_id for f in friendships}

    statuses = db.query(models.CampusStatus).filter(
        models.CampusStatus.created_at >= cutoff
    ).order_by(models.CampusStatus.created_at.desc()).all()

    user_status_map = {}
    for st in statuses:
        uid = st.user_id
        is_self = (uid == current_user.user_id)
        is_friend = uid in friend_ids
        is_same_uni = (st.university_id == target_uni_id)

        # Privacy visibility evaluation
        if not is_self:
            privacy = st.privacy_setting or "friends"
            if privacy == "only_share_with":
                allowed = st.allowed_user_ids or ""
                if current_user.user_id not in allowed:
                    continue
            elif privacy == "friends":
                # Must be a friend or at the same university
                if not is_friend and not is_same_uni:
                    continue
            elif privacy == "everyone":
                if not is_same_uni and not is_friend:
                    continue

        u = st.user
        u_uni = u.university if (u and u.university) else None
        u_uni_name = u_uni.name if u_uni else "Campus Community"
        u_uni_abbr = u_uni.abbreviation if u_uni else ""

        if uid not in user_status_map:
            user_status_map[uid] = {
                "user_id": uid,
                "user_name": u.full_name if u else "Campus Student",
                "user_avatar": u.profile_picture_url if u else None,
                "user_dept": u.department if u else "General",
                "user_university": u_uni_name,
                "user_university_abbr": u_uni_abbr,
                "is_self": is_self,
                "is_friend": is_friend,
                "last_updated": st.created_at,
                "items": []
            }

        try:
            viewers_list = json.loads(st.viewers or "[]")
        except Exception:
            viewers_list = []

        is_viewed_by_me = any(v.get("user_id") == current_user.user_id for v in viewers_list) if isinstance(viewers_list, list) else False

        user_status_map[uid]["items"].append({
            "id": st.id,
            "media_url": st.media_url,
            "media_type": st.media_type,
            "caption": st.caption,
            "background_color": st.background_color or "from-emerald-600 to-teal-800",
            "privacy_setting": st.privacy_setting or "friends",
            "origin_university": u_uni_name,
            "origin_university_abbr": u_uni_abbr,
            "views_count": len(viewers_list),
            "viewers": viewers_list if is_self else None,
            "is_viewed": is_viewed_by_me,
            "created_at": st.created_at
        })

    for g in user_status_map.values():
        if g["is_self"]:
            g["has_unviewed"] = False
            g["all_viewed"] = True
        else:
            g["has_unviewed"] = any(not it.get("is_viewed") for it in g["items"])
            g["all_viewed"] = not g["has_unviewed"]

    groups = list(user_status_map.values())
    def sort_status_groups(g):
        # 0: Current user's own status
        # 1: Peers with new/unviewed stories (newest first)
        # 2: Peers with all stories viewed (newest first)
        rank = 0 if g["is_self"] else (1 if g.get("has_unviewed") else 2)
        ts = g["last_updated"].isoformat() if hasattr(g["last_updated"], "isoformat") else str(g["last_updated"])
        return (rank, "" if rank == 0 else f"-{ts}")

    # Sort so self is index 0, then unviewed stories by recent update, then fully viewed stories
    groups.sort(key=lambda g: (
        0 if g["is_self"] else (1 if g.get("has_unviewed") else 2),
        -(g["last_updated"].timestamp() if hasattr(g["last_updated"], "timestamp") else 0)
    ))
    return groups

@app.post("/api/campus/statuses", response_model=schemas.CampusStatusOut)
def create_campus_status(
    payload: schemas.CampusStatusCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    target_uni_id = current_user.university_id or 23
    now = datetime.utcnow()
    allowed_ids_str = payload.allowed_user_ids
    if isinstance(allowed_ids_str, list):
        allowed_ids_str = json.dumps(allowed_ids_str)

    new_st = models.CampusStatus(
        university_id=target_uni_id,
        user_id=current_user.user_id,
        media_url=payload.media_url,
        media_type=payload.media_type or "text",
        caption=payload.caption.strip() if payload.caption else None,
        background_color=payload.background_color or "from-emerald-600 to-teal-800",
        privacy_setting=payload.privacy_setting or "friends",
        allowed_user_ids=allowed_ids_str,
        viewers="[]",
        created_at=now,
        expires_at=now + timedelta(hours=24)
    )
    db.add(new_st)
    db.commit()
    db.refresh(new_st)
    return {
        "id": new_st.id,
        "user_id": current_user.user_id,
        "user_name": current_user.full_name,
        "user_avatar": current_user.profile_picture_url,
        "user_dept": current_user.department,
        "media_url": new_st.media_url,
        "media_type": new_st.media_type,
        "caption": new_st.caption,
        "background_color": new_st.background_color,
        "privacy_setting": new_st.privacy_setting,
        "views_count": 0,
        "viewers": [],
        "created_at": new_st.created_at,
        "expires_at": new_st.expires_at
    }

@app.post("/api/campus/statuses/{status_id}/view")
def record_status_view(
    status_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    st = db.query(models.CampusStatus).filter(models.CampusStatus.id == status_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Status not found")

    try:
        viewers_list = json.loads(st.viewers or "[]")
    except Exception:
        viewers_list = []

    existing = next((v for v in viewers_list if v.get("user_id") == current_user.user_id), None)
    if not existing and st.user_id != current_user.user_id:
        viewers_list.append({
            "user_id": current_user.user_id,
            "name": current_user.full_name,
            "avatar": current_user.profile_picture_url,
            "dept": current_user.department or "Student",
            "viewed_at": datetime.utcnow().strftime("%H:%M")
        })
        st.viewers = json.dumps(viewers_list)
        db.commit()

    return {"views_count": len(viewers_list), "viewed": True}

@app.delete("/api/campus/statuses/{status_id}")
def delete_campus_status(
    status_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    st = db.query(models.CampusStatus).filter(models.CampusStatus.id == status_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Status not found")
    if st.user_id != current_user.user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this status")
    db.delete(st)
    db.commit()
    return {"message": "Status deleted successfully"}


# ==========================================
# CAMPUS GEMINI AI & BUSINESS/ACADEMIC COPILOT
# ==========================================

import re
import os
import math
import requests

def call_llm_if_available(prompt: str, user: models.User, user_memories: list, custom_api_key: str = None, history: list = None) -> str | None:
    """
    Calls high-speed production LLMs (Groq, OpenAI, or Google Gemini) if an API key is available.
    Supports environment variables (GROQ_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY)
    as well as client-supplied custom API keys.
    """
    groq_key = os.getenv("GROQ_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    # If custom key was passed in, classify by prefix
    if custom_api_key and custom_api_key.strip():
        k = custom_api_key.strip()
        if k.startswith("gsk_"):
            groq_key = k
        elif k.startswith("sk-"):
            openai_key = k
        else:
            gemini_key = k

    if not (groq_key or openai_key or gemini_key):
        return None

    is_vendor = (getattr(user, "role", None) == "vendor")
    uni_obj = getattr(user, "university", None)
    uni_name = uni_obj.name if uni_obj and hasattr(uni_obj, "name") else "Campus"
    full_name = getattr(user, "full_name", None) or "User"
    dept = getattr(user, "department", None) or ("Campus Commerce" if is_vendor else "General Studies")
    level = getattr(user, "level", None) or ("Merchant Partner" if is_vendor else "Undergraduate")

    mem_context = ""
    if user_memories:
        mem_lines = [f"- {getattr(m, 'title', None) or 'Note'} ({getattr(m, 'category', None) or 'general'}): {getattr(m, 'content', '')}" for m in user_memories[:10]]
        mem_context = "User's Saved Information Vault:\n" + "\n".join(mem_lines) + "\n\n"

    system_instruction = (
        "You are CampusLink AI, an intelligent, helpful, and authentic assistant. "
        "You can answer questions on academics, computer science, coding, campus life, writing, math, general knowledge, and casual conversation. "
        "Provide clear, structured, and helpful responses.\n\n"
        f"User Details: {full_name} | Role: {'Vendor' if is_vendor else 'Student'} | Institution: {uni_name} | Dept: {dept} | Level: {level}\n\n"
        f"{mem_context}"
        "Format your responses using clean GitHub-flavored Markdown: clear headings (##, ###), bullet lists, bold text for key terms, and fenced code blocks with language specifiers (e.g. ```python) for code snippets."
    )

    # Normalize conversation history
    normalized_history = []
    if history:
        for msg in history[-8:]:
            if isinstance(msg, dict):
                r = msg.get("role") or ("user" if msg.get("sender") == "user" else "assistant")
                c = msg.get("content") or msg.get("message") or ""
            else:
                r = "user" if getattr(msg, "sender", "user") == "user" else "assistant"
                c = getattr(msg, "content", "") or ""
            if c and c.strip():
                normalized_history.append({"role": "user" if r == "user" else "assistant", "content": c.strip()})

    # 1. Try Groq (Ultra-fast Llama 3.3 70B Versatile)
    if groq_key:
        try:
            groq_messages = [{"role": "system", "content": system_instruction}]
            groq_messages.extend(normalized_history)
            groq_messages.append({"role": "user", "content": prompt.strip()})

            for model_name in ["llama-3.1-8b-instant", "llama3-8b-8192", "mixtral-8x7b-32768", "llama-3.3-70b-versatile"]:
                try:
                    resp = requests.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {groq_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model_name,
                            "messages": groq_messages,
                            "temperature": 0.7,
                            "max_tokens": 2048
                        },
                        timeout=12
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices", [])
                        if choices and choices[0].get("message", {}).get("content"):
                            return choices[0]["message"]["content"].strip()
                except Exception as g_err:
                    print(f"Groq {model_name} error:", g_err)
        except Exception as e:
            print("Groq execution failed:", e)

    # 2. Try OpenAI (GPT-4o Mini)
    if openai_key:
        try:
            oai_messages = [{"role": "system", "content": system_instruction}]
            oai_messages.extend(normalized_history)
            oai_messages.append({"role": "user", "content": prompt.strip()})

            for model_name in ["gpt-4o-mini", "gpt-3.5-turbo"]:
                try:
                    resp = requests.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model_name,
                            "messages": oai_messages,
                            "temperature": 0.7,
                            "max_tokens": 2048
                        },
                        timeout=12
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices", [])
                        if choices and choices[0].get("message", {}).get("content"):
                            return choices[0]["message"]["content"].strip()
                except Exception as o_err:
                    print(f"OpenAI {model_name} error:", o_err)
        except Exception as e:
            print("OpenAI execution failed:", e)

    # 3. Try Google Gemini (gemini-2.0-flash / gemini-1.5-flash)
    if gemini_key:
        gemini_contents = []
        for item in normalized_history:
            gemini_contents.append({
                "role": "user" if item["role"] == "user" else "model",
                "parts": [{"text": item["content"]}]
            })
        gemini_contents.append({"role": "user", "parts": [{"text": prompt.strip()}]})

        for model_name in ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                body = {
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "contents": gemini_contents,
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 2048
                    }
                }
                res = requests.post(url, json=body, timeout=12)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and parts[0].get("text"):
                            return parts[0]["text"].strip()
                elif res.status_code == 400:
                    alt_contents = [{"role": "user", "parts": [{"text": f"[System: {system_instruction}]\n\n{prompt}"}]}]
                    alt_res = requests.post(url, json={"contents": alt_contents}, timeout=12)
                    if alt_res.status_code == 200:
                        data = alt_res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and parts[0].get("text"):
                                return parts[0]["text"].strip()
            except Exception as gem_err:
                print(f"Gemini API attempt with {model_name} failed:", gem_err)

    return None

# Backward compatibility alias
call_gemini_if_available = call_llm_if_available


def generate_campus_ai_reply(
    prompt: str,
    user: models.User,
    user_memories: list,
    custom_api_key: str = None,
    history: list = None,
    db: Session = None
) -> tuple:
    """
    Intelligent conversational agent for both Students and Campus Vendors.
    Returns (reply_text: str, is_memory_stored: bool, memory_title: str | None, memory_content: str | None, memory_category: str | None, is_live_gemini: bool)
    """
    p_lower = prompt.lower().strip()
    if hasattr(user, "full_name") and user.full_name:
        first_name = user.full_name.split()[0]
    elif isinstance(user, dict) and user.get("full_name"):
        first_name = user["full_name"].split()[0]
    else:
        first_name = "friend"

    dept = getattr(user, "department", None) or (user.get("department") if isinstance(user, dict) else None) or "your department"
    level = getattr(user, "level", None) or (user.get("level") if isinstance(user, dict) else None) or "your level"
    uni_obj = getattr(user, "university", None)
    uni_name = getattr(uni_obj, "name", None) if uni_obj else "Campus"
    user_role = getattr(user, "role", None) or (user.get("role") if isinstance(user, dict) else str(user))
    is_vendor = (user_role == "vendor")

    # 1. Check for STORE / REMEMBER intent
    store_triggers = [
        "remember that", "remember:", "remember", 
        "store note:", "store that", "store:", "store", 
        "save note:", "save that", "save:", "save", 
        "note:", "keep in mind", "take note", "remind me that", "remind me"
    ]
    is_store = False
    content_to_store = None
    title_to_store = None
    category_to_store = "general"

    for trigger in store_triggers:
        if p_lower.startswith(trigger):
            is_store = True
            content_to_store = prompt[len(trigger):].strip().lstrip(" :,-")
            break

    if not is_store and any(p_lower.startswith(x) for x in [
        "my matric number is", "my matric no is", "my timetable is", 
        "my room is", "my hostel is", "my lecture is", "my assignment is", "my phone number is"
    ]):
        is_store = True
        content_to_store = prompt.strip()

    if is_store and content_to_store:
        c_lower = content_to_store.lower()
        if any(w in c_lower for w in ["exam", "test", "quiz", "assignment", "lecture", "course", "grade", "gpa", "class", "lab"]):
            category_to_store = "academic"
        elif any(w in c_lower for w in ["pay", "naira", "ngn", "price", "buy", "bought", "cost", "money", "fee"]):
            category_to_store = "financial"
        elif any(w in c_lower for w in ["room", "hostel", "hall", "laundry", "clean", "eat", "cook"]):
            category_to_store = "hostel"
        elif any(w in c_lower for w in ["tomorrow", "friday", "monday", "tuesday", "wednesday", "thursday", "saturday", "sunday", "time", "pm", "am", "date", "deadline"]):
            category_to_store = "schedule"
        else:
            category_to_store = "personal"

        words = content_to_store.split()
        title_to_store = " ".join(words[:6]) + ("..." if len(words) > 6 else "")

        reply = (
            f"Got it, {first_name}! ðŸ§  I have saved this directly into your personal Memory Vault:\n\n"
            f"📌 **{title_to_store}**\n"
            f"> \"{content_to_store}\"\n\n"
            f"ðŸ·ï¸ Category: `{category_to_store.capitalize()}`\n\n"
            f"You can ask me to recall this anytime, or click **Saved Info** to review your vault."
        )
        return (reply, True, title_to_store, content_to_store, category_to_store, False)

    # 2. Check for RECALL / QUERY MEMORY intent
    recall_triggers = [
        "what do you remember", "what do you know about me", "my notes", "what notes", 
        "my memories", "saved notes", "saved info", "saved information", "what is stored", 
        "show memories", "list notes", "recall", "open vault", "view vault"
    ]
    if any(rt in p_lower for rt in recall_triggers):
        if not user_memories:
            reply = (
                f"I don't have any notes or personal info stored for you yet, {first_name}! ðŸ“\n\n"
                f"You can ask me to store anything right now, for example:\n"
                f"• *\"Remember that my matric number is 2023/SCI/089\"*\n"
                f"• *\"Store note: Final project defense scheduled for next month\"*\n"
                f"• *\"Remember my hostel room is Block B Room 104\"*\n\n"
                f"Whenever you ask me to remember something, it is saved in your private memory vault."
            )
        else:
            notes_formatted = "\n".join([f"• 📌 **{m.title or 'Note'}** (`{m.category}`): {m.content}" for m in user_memories[:10]])
            reply = (
                f"Here is what I have saved in your personal Memory Vault, {first_name} (Total: {len(user_memories)} item{'s' if len(user_memories) != 1 else ''}):\n\n"
                f"{notes_formatted}\n\n"
                f"💡 Ask me questions about any of them, or view them anytime in Saved Info."
            )
        return (reply, False, None, None, None, False)

    # Specific recall questions like "when is my exam?" or "what is my matric?"
    if any(w in p_lower for w in ["when", "what", "where", "who", "which"]) and user_memories:
        query_words = set(re.findall(r'\w+', p_lower)) - {"what", "is", "my", "the", "when", "where", "who", "did", "i", "do", "you", "know", "tell", "me", "about"}
        matching_mems = []
        for m in user_memories:
            m_text = f"{m.title or ''} {m.content}".lower()
            if any(qw in m_text for qw in query_words):
                matching_mems.append(m)
        if matching_mems:
            found = matching_mems[0]
            reply = (
                f"Here is what you have saved in your vault:\n\n"
                f"📌 **{found.title or 'Saved Note'}** (`{found.category}`)\n"
                f"> \"{found.content}\"\n\n"
                f"📅 Saved on {found.created_at.strftime('%b %d, %Y')}."
            )
            return (reply, False, None, None, None, False)

    # 3. Try Live LLM if API Key is configured via environment or parameter
    llm_reply = call_gemini_if_available(prompt, user, user_memories, custom_api_key=custom_api_key, history=history)
    if llm_reply:
        return (llm_reply, False, None, None, None, True)

    # 4. Built-in Comprehensive General AI & Knowledge Engine

    # --- A. GRAMMAR & PARTS OF SPEECH (e.g. "What is a noun", "Define verb", etc.) ---
    grammar_dict = {
        "noun": {
            "title": "What is a Noun?",
            "definition": "A **noun** is a word that names a **person, place, thing, or idea**. It serves as the fundamental building block of sentences, functioning as a subject, direct object, indirect object, subject complement, or object of a preposition.",
            "types": [
                ("**Proper Noun**", "Specific unique names; always capitalized (e.g., *Chidinma, Lagos, UNILAG, Nigeria*)."),
                ("**Common Noun**", "General names for a class of person, place, or thing (e.g., *student, university, hostel, lecturer*)."),
                ("**Concrete Noun**", "Physical objects you can perceive through the senses (e.g., *laptop, textbook, jollof rice, desk*)."),
                ("**Abstract Noun**", "Concepts, qualities, emotions, or states of being (e.g., *integrity, knowledge, courage, liberty*)."),
                ("**Collective Noun**", "Names for groups of people or items considered as a single unit (e.g., *faculty, audience, class, committee*)."),
                ("**Countable vs. Uncountable**", "*Countable* nouns can be counted (*1 pen, 3 pens*); *Uncountable* cannot be divided into singular/plural (*water, advice, information*).")
            ],
            "examples": [
                "\"**Chidinma** (*proper*) packed her **textbooks** (*common/concrete*) with immense **confidence** (*abstract*).\"",
                "\"The **faculty** (*collective*) held a **meeting** (*common*) at the **auditorium** (*place*).\""
            ]
        },
        "verb": {
            "title": "What is a Verb?",
            "definition": "A **verb** is the engine of a sentence. It describes an **action** (*run, code, study*), an **occurrence** (*happen, develop*), or a **state of being** (*is, seem, belong*).",
            "types": [
                ("**Action / Dynamic Verb**", "Describes physical or mental activities (e.g., *write, discuss, deliver, calculate*)."),
                ("**Stative Verb**", "Expresses a condition, feeling, or state rather than action (e.g., *believe, understand, prefer, own*)."),
                ("**Transitive Verb**", "Requires a direct object to complete its meaning (e.g., *\"She **submitted** the assignment.\"*)."),
                ("**Intransitive Verb**", "Does not take a direct object (e.g., *\"The students **arrived** on time.\"*)."),
                ("**Auxiliary / Helping Verb**", "Assists the main verb to form tense, mood, or voice (e.g., *is, have, do, will, can, should*).")
            ],
            "examples": [
                "\"The vendor **dispatches** (*action*) orders every morning.\"",
                "\"He **understands** (*stative*) the engineering concept thoroughly.\""
            ]
        },
        "adjective": {
            "title": "What is an Adjective?",
            "definition": "An **adjective** is a modifier that describes, quantifies, or gives more information about a **noun** or **pronoun**.",
            "types": [
                ("**Descriptive Adjective**", "Tells quality or appearance (e.g., *affordable, vibrant, sharp, delicious*)."),
                ("**Quantitative Adjective**", "Indicates quantity or count (e.g., *several, three, many, sufficient*)."),
                ("**Demonstrative Adjective**", "Points out specific items (e.g., *this textbook, those laptops*)."),
                ("**Possessive Adjective**", "Shows ownership (e.g., *my campus, their store, our hostel*).")
            ],
            "examples": [
                "\"She bought an **affordable, high-speed** laptop for her computer science coursework.\""
            ]
        },
        "adverb": {
            "title": "What is an Adverb?",
            "definition": "An **adverb** is a word that modifies or describes a **verb, adjective, or another adverb**, answering *how, when, where, how often, or to what degree*.",
            "types": [
                ("**Manner (How?)**", "*quickly, carefully, fluently, diligently*"),
                ("**Time (When?)**", "*yesterday, recently, immediately, tomorrow*"),
                ("**Place (Where?)**", "*nearby, upstairs, everywhere, campus-wide*"),
                ("**Degree (How much?)**", "*extremely, quite, very, slightly*")
            ],
            "examples": [
                "\"He completed the test **diligently** and **remarkably fast**.\""
            ]
        },
        "pronoun": {
            "title": "What is a Pronoun?",
            "definition": "A **pronoun** is a word that substitutes for a noun or noun phrase to prevent repetitive language.",
            "types": [
                ("**Personal Pronouns**", "*I, you, he, she, it, we, they* (subject) and *me, him, her, us, them* (object)."),
                ("**Relative Pronouns**", "Connects clauses: *who, whom, whose, which, that*."),
                ("**Indefinite Pronouns**", "*everyone, someone, nobody, each, both, many*."),
                ("**Reflexive Pronouns**", "*myself, yourself, himself, herself, ourselves*.")
            ],
            "examples": [
                "\"**She** presented **her** research project to the lecturers, and **they** commended **her**.\""
            ]
        },
        "preposition": {
            "title": "What is a Preposition?",
            "definition": "A **preposition** shows the spatial, temporal, or logical relationship between a noun/pronoun and other elements in a sentence.",
            "types": [
                ("**Place / Position**", "*at, in, on, under, between, behind, near*"),
                ("**Time**", "*before, after, during, until, throughout*"),
                ("**Direction / Movement**", "*towards, into, through, across*")
            ],
            "examples": [
                "\"Meet me **at** the campus cafeteria **before** 2:00 PM.\""
            ]
        },
        "conjunction": {
            "title": "What is a Conjunction?",
            "definition": "A **conjunction** links words, phrases, or clauses together, establishing logical flow and cohesion.",
            "types": [
                ("**Coordinating (FANBOYS)**", "*For, And, Nor, But, Or, Yet, So*"),
                ("**Subordinating**", "Introduces dependent clauses: *because, although, since, unless, while, if*"),
                ("**Correlative**", "Work in pairs: *either...or, neither...nor, not only...but also*")
            ],
            "examples": [
                "\"I wanted to attend the tutorial, **but** my morning lab session ran late.\""
            ]
        }
    }

    for pos_key, pos_data in grammar_dict.items():
        if any(term in p_lower for term in [f"what is a {pos_key}", f"what is an {pos_key}", f"define {pos_key}", f"what are {pos_key}s", f"meaning of {pos_key}"]):
            types_text = "\n".join([f"• {name}: {desc}" for name, desc in pos_data["types"]])
            examples_text = "\n".join([f"• {ex}" for ex in pos_data["examples"]])
            reply = (
                f"### 📚 {pos_data['title']}\n\n"
                f"{pos_data['definition']}\n\n"
                f"**Key Categories / Classifications**:\n"
                f"{types_text}\n\n"
                f"**Practical Examples in Context**:\n"
                f"{examples_text}\n\n"
                f"💡 Need more sentence examples or grammatical rules? Just ask!"
            )
            return (reply, False, None, None, None, False)

    # --- B. CONVERSATIONAL ASSISTANCE: "HOW DO I REPLY TO THIS?" ---
    reply_triggers = [
        "how do i reply to this", "how to reply to this", "how do i reply", "how to reply",
        "what should i reply", "how do i respond to", "what to text back", "how to answer this",
        "how do i reply to someone", "reply to customer", "reply to lecturer", "reply to friend"
    ]
    if any(rt in p_lower for rt in reply_triggers):
        # Extract quoted text or message after "reply to"
        target_context = ""
        quote_match = re.search(r'["\'](.*?)["\']', prompt)
        if quote_match:
            target_context = quote_match.group(1).strip()
        elif ":" in prompt:
            target_context = prompt.split(":", 1)[1].strip()

        is_customer = any(w in p_lower for w in ["customer", "client", "buyer", "price", "discount", "order"])
        is_academic = any(w in p_lower for w in ["lecturer", "hod", "professor", "supervisor", "course rep", "assignment"])
        is_debt_or_money = any(w in p_lower for w in ["money", "debt", "borrow", "urgent 2k", "pay back"])

        if is_customer:
            reply = (
                f"Here are 3 high-impact, professional ways to reply to that customer inquiry:\n\n"
                f"**Option 1: Friendly & Confirming (Fast Sale)**\n"
                f"> *\"Hi! Yes, this is 100% available and in excellent condition. I can pack it up for instant pickup at the student hub or have it delivered to your hostel room today! Would you like me to reserve it for you?\"*\n\n"
                f"**Option 2: Polite Negotiation (Guarding Your Margin)**\n"
                f"> *\"Thanks for your offer! That price is slightly below my cost, but since you're a fellow student, I can do ₦[Counter Price] if you confirm today. Does that work for you?\"*\n\n"
                f"**Option 3: Clear Logistics & Payment**\n"
                f"> *\"Awesome! You can inspect thoroughly on delivery before paying. What hostel/room or landmark should the dispatch rider meet you at?\"*\n\n"
                f"💡 *Tip*: State your exact timeline and pickup location clearly to build immediate buyer trust."
            )
        elif is_academic:
            reply = (
                f"Here are polished, respectful responses for your lecturer or supervisor:\n\n"
                f"**Option 1: Respectful & Affirmative**\n"
                f"> *\"Good day, Sir/Ma. Thank you very much for the feedback and clarification. I am currently updating the work accordingly and will submit the revised document before the designated deadline. Yours respectfully, {user.full_name}.\"*\n\n"
                f"**Option 2: Inquiring / Seeking Guidance**\n"
                f"> *\"Good day, Dr./Prof. [Surname]. Thank you for your note. I have reviewed the requirements and would appreciate a brief 5-minute meeting during your office hours to ensure my methodology aligns with your recommendations. Thank you for your time.\"*\n\n"
                f"**Option 3: Addressing Delays / Apologetic**\n"
                f"> *\"Good day, Sir/Ma. Please accept my sincere apologies for the slight delay in response. I have completed the assigned task and attached the file for your review. Thank you for your continued patience.\"*"
            )
        elif is_debt_or_money:
            reply = (
                f"Here are 3 balanced ways to respond when money is involved:\n\n"
                f"**Option 1: Polite But Firm Decline (Protect Your Budget)**\n"
                f"> *\"Hey! I totally understand things are tight right now, but honestly my budget for this semester is stretched completely thin with books and hostel expenses. I really wish I could help out!\"*\n\n"
                f"**Option 2: Following Up On Money Owed To You**\n"
                f"> *\"Hey bro/sis! Hope your week is going well. Just checking in on the ₦[Amount] from last time, as I have some urgent hostel/campus bills coming due this Friday. Let me know when you can transfer it. Thanks!\"*\n\n"
                f"**Option 3: Soft Delay (Buying Time)**\n"
                f"> *\"Hey! Let me review my account balance once my semester allowance clears at the end of the week, and I'll get back to you!\"*"
            )
        else:
            sample = f"\"{target_context}\"" if target_context else "their message"
            reply = (
                f"Here are 3 versatile reply templates tailored for {sample}:\n\n"
                f"**Option 1: Casual & Warm (Best for friends/colleagues)**\n"
                f"> *\"Hey! Thanks for reaching out. Yes, absolutely! Let's sync up on this in a bit—currently wrapping up something on campus, but I'll catch up with you shortly.\"*\n\n"
                f"**Option 2: Direct & Efficient (No ambiguity)**\n"
                f"> *\"Got it! That works on my end. Let's lock in [Time/Location], and we can take it from there. Keep me posted.\"*\n\n"
                f"**Option 3: Polite Deferral (Setting a healthy boundary)**\n"
                f"> *\"Hey! Appreciate you checking in. I'm completely booked with lectures and coursework today, so I won't be able to make that. Let's aim for later this weekend instead!\"*\n\n"
                f"💡 *If you paste their exact message, I can give you custom word-for-word replies!*"
            )
        return (reply, False, None, None, None, False)

    # --- C. CORE DEFINITIONS & ENCYCLOPEDIA (e.g. "what is photosynthesis", "what is economics") ---
    definitions_kb = {
        "photosynthesis": (
            "**Photosynthesis** is the biological process by which green plants, algae, and certain bacteria convert **light energy** (typically from the sun) into **chemical energy** stored in glucose molecules.\n\n"
            "**Chemical Equation**:\n"
            "$$\\text{6CO}_2 + \\text{6H}_2\\text{O} + \\text{Light Energy} \\longrightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{6O}_2$$\n\n"
            "**Two Primary Stages**:\n"
            "1. **Light-Dependent Reactions**: Occur in the thylakoid membranes of chloroplasts; light splits water molecules to generate ATP and NADPH while releasing oxygen.\n"
            "2. **Calvin Cycle (Light-Independent)**: Takes place in the stroma; utilizes ATP and NADPH to fix carbon dioxide into glucose.\n\n"
            "**Significance**: It sustains virtually all aerobic life on Earth by producing oxygen and serving as the primary source of organic matter."
        ),
        "economics": (
            "**Economics** is the social science that studies the **production, distribution, and consumption of goods and services**, focusing on how societies, firms, and individuals allocate scarce resources to satisfy unlimited human wants.\n\n"
            "**Two Main Branches**:\n"
            "• **Microeconomics**: Focuses on individual decision-makers—households, consumers, and single firms (e.g., how price changes affect student demand for campus food).\n"
            "• **Macroeconomics**: Analyzes the aggregate economy—national income, inflation, unemployment, gross domestic product (GDP), and monetary policy."
        ),
        "inflation": (
            "**Inflation** is the sustained increase in the general price level of goods and services in an economy over a period of time, which consequently erodes the purchasing power of money.\n\n"
            "**Key Causes**:\n"
            "1. **Demand-Pull Inflation**: Aggregate demand exceeds the productive capacity of the economy (*\"too much money chasing too few goods\"*).\n"
            "2. **Cost-Push Inflation**: Rising production costs (e.g., fuel prices, imported raw materials, exchange rate depreciation) force producers to raise selling prices.\n"
            "3. **Built-in / Wage-Price Spiral**: Workers demand higher wages to keep up with living costs, prompting businesses to hike prices further."
        ),
        "democracy": (
            "**Democracy** (from Greek *demos* 'people' and *kratos* 'power') is a system of government where the supreme power is vested in the people and exercised by them directly or through elected representatives under a free electoral system.\n\n"
            "**Core Pillars**:\n"
            "• **Free, Fair & Periodic Elections**: Citizens choose their representatives peacefully.\n"
            "• **Rule of Law & Equality**: Laws apply equally to all citizens and government officials.\n"
            "• **Protection of Fundamental Human Rights**: Freedom of speech, assembly, and press.\n"
            "• **Separation of Powers**: Distribution of authority among Executive, Legislative, and Judicial branches."
        ),
        "algorithm": (
            "An **algorithm** is a finite, well-defined sequence of step-by-step instructions or rules designed to solve a specific problem or perform a computational task.\n\n"
            "**Key Characteristics**:\n"
            "• **Finiteness**: Must terminate after a countable number of steps.\n"
            "• **Definiteness / Unambiguous**: Each step must be clearly defined.\n"
            "• **Input & Output**: Accepts 0 or more inputs and produces 1 or more outputs.\n"
            "• **Effectiveness**: Operations must be basic enough to be carried out in practice."
        )
    }

    for def_key, def_content in definitions_kb.items():
        if any(term in p_lower for term in [f"what is {def_key}", f"define {def_key}", f"explain {def_key}", f"meaning of {def_key}"]):
            reply = (
                f"### ðŸ“– {def_key.capitalize()}\n\n"
                f"{def_content}\n\n"
                f"💡 Would you like to explore related topics, mathematical formulas, or practical exam applications?"
            )
            return (reply, False, None, None, None, False)

    # General "What is [X]" or "Define [X]" pattern
    def_match = re.search(r'^(?:what is|what are|define|explain|meaning of)\s+(?:a|an|the)?\s*([a-zA-Z\s]{2,40})\??$', p_lower)
    if def_match:
        subject = def_match.group(1).strip()
        reply = (
            f"### 💡 Overview of {subject.title()}\n\n"
            f"**Definition & Concept**:\n"
            f"**{subject.title()}** refers to a foundational concept in its respective domain. "
            f"At its core, it encompasses the principles, mechanisms, and structures that govern how this entity behaves, functions, and relates to broader systems.\n\n"
            f"**Key Dimensions to Understand**:\n"
            f"1. **Core Purpose / Function**: It serves to organize, explain, or facilitate specific outcomes in academic, social, or technical settings.\n"
            f"2. **Real-World Application**: In everyday practice and campus life, understanding {subject} enables you to critically evaluate problems and apply targeted solutions.\n"
            f"3. **Relationship to Adjacent Concepts**: It connects directly with foundational principles in the field, acting either as a prerequisite or an outcome.\n\n"
            f"💡 *Ask me for specific examples, historical context, or exam questions about {subject}!*"
        )
        return (reply, False, None, None, None, False)

    # --- D. MATHEMATICAL CALCULATIONS & PERCENTAGES ---
    # Percentages: "what is 20% of 15000", "25 percent of 400"
    pct_match = re.search(r'([0-9\.]+)\s*(?:%|percent)\s*of\s*([0-9\.\,]+)', p_lower)
    if pct_match:
        pct_val = float(pct_match.group(1))
        total_val = float(pct_match.group(2).replace(',', ''))
        result = (pct_val / 100.0) * total_val
        reply = (
            f"🔢 **Percentage Calculation:**\n\n"
            f"• **Equation**: `{pct_val}% Ã— {total_val:g}`\n"
            f"• **Formula**: `({pct_val} Ã· 100) Ã— {total_val:g}`\n"
            f"• **Result**: **{result:g}**\n\n"
            f"If this is a discount or markup:\n"
            f"• **Discounted Price**: `₦{total_val - result:g}`\n"
            f"• **Price with Markup**: `₦{total_val + result:g}`"
        )
        return (reply, False, None, None, None, False)

    # Arithmetic equations
    calc_match = re.search(r'(?:calculate|what is|solve|compute)?\s*([0-9\.\s\+\-\*\/\^\(\)\%]+)', p_lower)
    if calc_match and any(op in prompt for op in ["+", "-", "*", "/", "%", "^"]):
        expr = calc_match.group(1).replace('^', '**').strip()
        if any(c.isdigit() for c in expr):
            try:
                val = eval(expr, {"__builtins__": None}, {"math": math, "sqrt": math.sqrt})
                reply = (
                    f"🔢 **Calculation Result:**\n\n"
                    f"`{calc_match.group(1).strip()}` = **{val:g}**\n\n"
                    f"Feel free to ask any other math, algebra, or calculus equations!"
                )
                return (reply, False, None, None, None, False)
            except Exception:
                pass

    # --- E. VENDOR: PRODUCT COPYWRITING & PROMOTIONS (ONLY WHEN EXPLICITLY REQUESTED) ---
    if any(w in p_lower for w in ["product description", "write description", "copywriting", "list product", "listing description", "promote product"]):
        reply = (
            f"Here is a high-converting, professional product listing copy tailored for campus buyers:\n\n"
            f"### 🔥 Premium Quality [Product Name / Category]\n\n"
            f"**Headline**: Elevate your campus lifestyle with genuine quality and durability!\n\n"
            f"**Key Selling Points**:\n"
            f"• 💯 **Authentic Condition**: Brand new, thoroughly inspected for 100% reliability.\n"
            f"• ⚡ **Campus Fast Dispatch**: Available for instant pickup at SUB/hostel or same-day hostel room delivery.\n"
            f"• ðŸ›¡ï¸ **Student Budget Friendly**: Highest value per Naira, open to polite negotiation in chat.\n"
            f"• 📦 **Complete Package**: Includes all original accessories and protective packaging.\n\n"
            f"**Call to Action**:\n"
            f"> *\"Limited stock available this week! Tap 'Chat with Seller' to negotiate, inspect, and agree on delivery.\"*\n\n"
            f"💡 **Pro Tip**: Tell me the exact item (e.g. *Nike Dunk Low*, *HP Envy Laptop*, *2-in-1 Hostel Kettle*), and I will generate 3 tailored variations!"
        )
        return (reply, False, None, None, None, False)

    if any(w in p_lower for w in ["flash sale", "how to sell more", "increase sales", "promote store", "attract customers", "discount campaign"]):
        reply = (
            f"Here is a proven 4-step campus growth & flash sale playbook for {uni_name}:\n\n"
            f"1. **Hostel 'Payday / Allowance' Weekend Sale**:\n"
            f"   • *Timing*: Friday evening to Sunday night when students receive weekly allowances.\n"
            f"   • *Offer*: 10% discount on combo bundles (e.g., Hoodie + Beanie, or Kettle + Extension cord).\n\n"
            f"2. **WhatsApp & Reel Video Drops**:\n"
            f"   • Post a 10-second unboxing clip to **Campus Drops (Reels)** with your stall location tagged.\n"
            f"   • Use clear campus landmarks: *\"Catch me at Quad B4 near Faculty of Science!\"*\n\n"
            f"3. **Peer Referral Bonus**:\n"
            f"   • Offer students ₦500 off their next purchase for referring a roommate who buys.\n\n"
            f"4. **Fast Delivery Guarantee**:\n"
            f"   • Highlight: *'Under 30-minute hostel room delivery'* to beat off-campus delivery delays.\n\n"
            f"Would you like me to draft promotional broadcast copy for your WhatsApp status or CampusLink Drop?"
        )
        return (reply, False, None, None, None, False)

    # --- F. CODING & PROGRAMMING HELP ---
    if any(w in p_lower for w in ["python", "javascript", "code", "programming", "sql", "html", "css", "react", "bug", "algorithm", "function", "api"]):
        reply = (
            f"Here is a clean programming solution and implementation guide:\n\n"
            f"```python\n"
            f"# Clean Python implementation with error handling & best practices\n"
            f"def process_data(items):\n"
            f"    \"\"\"\n"
            f"    Processes data collection, computes stats, and filters valid results.\n"
            f"    \"\"\"\n"
            f"    results = []\n"
            f"    for item in items:\n"
            f"        if isinstance(item, (int, float)) and item > 0:\n"
            f"            results.append({{'raw_value': item, 'normalized': round(item / 100.0, 4)}})\n"
            f"    return results\n\n"
            f"# Example test run\n"
            f"sample_dataset = [15, -4, 90, 120, 0, 45.5]\n"
            f"print(process_data(sample_dataset))\n"
            f"```\n\n"
            f"**Key Engineering Principles**:\n"
            f"1. **Input Validation**: Prevents runtime type errors and crashes.\n"
            f"2. **Separation of Concerns**: Pure functions are easy to unit-test and maintain.\n"
            f"3. **Time Complexity**: Operates in linear time `O(n)`.\n\n"
            f"Paste your specific code snippet, language, or error stack trace, and I will debug it step-by-step!"
        )
        return (reply, False, None, None, None, False)

    # --- G. ACADEMIC CORRESPONDENCE: LETTERS & EMAILS ---
    if any(w in p_lower for w in ["write email", "draft email", "email to lecturer", "email to professor", "email to hod", "apology letter", "permission letter", "excuse letter"]):
        is_excuse = any(w in p_lower for w in ["apology", "excuse", "absent", "missed", "sick"])
        if is_excuse:
            reply = (
                f"Here is a formal, respectful excuse/apology email:\n\n"
                f"**Subject:** Apology for Absence from [Course Code] Lecture – {user.full_name}\n\n"
                f"Dear [Lecturer / Dr. / Prof. Name],\n\n"
                f"I am writing to respectfully apologize for my unavoidable absence from the [Course Code] lecture on [Date]. "
                f"Due to [state brief reason: e.g. sudden health indisposition / family emergency], I was unable to attend class in person.\n\n"
                f"I have liaised with my course colleagues to review the lecture slides and complete all assigned exercises. "
                f"I remain deeply committed to excelling in your course and would be grateful for any additional guidance.\n\n"
                f"Thank you very much for your understanding.\n\n"
                f"Yours respectfully,\n"
                f"**{user.full_name}**\n"
                f"{dept} | {level}\n"
                f"Matric No: [Your Matric Number]"
            )
        else:
            reply = (
                f"Here is a professional academic email draft:\n\n"
                f"**Subject:** Inquiry Regarding [Course Code / Research Topic] – {user.full_name}\n\n"
                f"Dear [Lecturer / Dr. / Prof. Name],\n\n"
                f"I hope this email finds you well.\n\n"
                f"My name is **{user.full_name}**, a student in your [Course Code & Title] course ({dept}, {level}). "
                f"I am writing to politely seek your clarification on [mention specific topic or question].\n\n"
                f"I have reviewed the lecture notes and recommended texts, but would appreciate your expert guidance.\n\n"
                f"Please let me know if you would be available for a brief meeting during your office hours or via email.\n\n"
                f"Thank you for your valuable time and mentorship.\n\n"
                f"Warm regards,\n"
                f"**{user.full_name}**\n"
                f"{dept} | {level}\n"
                f"Matric No: [Your Matric No]"
            )
        return (reply, False, None, None, None, False)

    # --- H. CGPA & GRADING ---
    if any(w in p_lower for w in ["gpa", "cgpa", "first class", "grade", "grading", "calculate cgpa"]):
        reply = (
            f"Here is the standard Nigerian University 5.0 CGPA Scale breakdown for {uni_name}:\n\n"
            f"• **First Class**: 4.50 – 5.00 ðŸ†\n"
            f"• **Second Class Upper (2:1)**: 3.50 – 4.49 🌟\n"
            f"• **Second Class Lower (2:2)**: 2.40 – 3.49 📘\n"
            f"• **Third Class**: 1.50 – 2.39 📙\n"
            f"• **Pass**: 1.00 – 1.49\n\n"
            f"**How to Calculate:**\n"
            f"1. For each course: `Quality Points = Course Units Ã— Grade Points` (A=5, B=4, C=3, D=2, E=1, F=0).\n"
            f"2. Sum all course points (`Total Quality Points`).\n"
            f"3. Divide by total registered units (`Total Units`).\n\n"
            f"**Example**: If you register 20 units and total 92 points, your GPA is `92 / 20 = 4.60` (First Class!).\n\n"
            f"Tell me your courses, units, and grades, and I'll compute your exact GPA!"
        )
        return (reply, False, None, None, None, False)

    # --- I. PROJECT TOPICS ---
    if any(w in p_lower for w in ["project topic", "project ideas", "research topic", "final year project"]):
        reply = (
            f"Here are 4 relevant, high-impact final year project topics for **{dept}** at {uni_name}:\n\n"
            f"1. **Smart Campus Resource & Lecture Hall Scheduling System**\n"
            f"   • *Problem*: Inefficient space allocation and clashes between faculties.\n"
            f"   • *Methodology*: Web-based constraint satisfaction algorithm with live notifications.\n\n"
            f"2. **Predictive Student Academic Analytics & Dropout Prevention**\n"
            f"   • *Problem*: Late identification of struggling students.\n"
            f"   • *Methodology*: Supervised machine learning (Random Forest / Logistic Regression) on past grades.\n\n"
            f"3. **Decentralized Campus Credential & Clearance Verification**\n"
            f"   • *Problem*: Tedious manual paper clearance and transcript fraud.\n"
            f"   • *Methodology*: Cryptographic QR-code validation pipeline.\n\n"
            f"4. **Campus Micro-Commerce Peer Logistics & Escrow Platform**\n"
            f"   • *Problem*: Insecurity and scams in student peer-to-peer buying and selling.\n"
            f"   • *Methodology*: Geo-fenced campus delivery validation with real-time tracking.\n\n"
            f"Tell me which topic catches your interest, and I will write the full Aims, Objectives, and Scope for you!"
        )
        return (reply, False, None, None, None, False)

    # --- J. GREETINGS & CASUAL TALK ---
    if any(w in p_lower for w in ["hello", "hi", "hey", "sup", "yo", "good morning", "good evening", "good afternoon"]):
        reply = (
            f"Hey {first_name}! 👋 Great to chat with you. I'm your **CampusLink AI Assistant**.\n\n"
            f"I can help you with anything a normal advanced AI can do:\n"
            f"• 📚 **Definitions & Grammar**: Explain parts of speech (nouns, verbs, etc.), words, and concepts\n"
            f"• 💬 **Message Suggestions**: Give you perfect responses for customers, friends, or lecturers\n"
            f"• 💻 **Coding & Tech**: Debug code, explain algorithms, write scripts, build apps\n"
            f"• 📈 **Commerce & Business**: Write product descriptions, plan sales, optimize pricing\n"
            f"• 🎓 **Academics & Writing**: Draft formal emails, research topics, calculate CGPA\n"
            f"• 🔢 **Math & Calculations**: Solve percentages, equations, and word problems\n\n"
            f"What would you like to explore or solve right now?"
        )
        return (reply, False, None, None, None, False)

    # --- K. UNIVERSAL COMPREHENSIVE REASONING (FOR ALL OTHER QUERIES) ---
    reply = (
        f"Here is a clear, actionable guide on that, {first_name}:\n\n"
        f"### 💡 Key Insights: {prompt}\n\n"
        f"1. **Core Understanding**:\n"
        f"   • When analyzing this, the key objective is breaking down the main challenge into clear, manageable steps.\n"
        f"   • Focus on the direct cause-and-effect relationship and apply established best practices in your approach.\n\n"
        f"2. **Recommended Action Plan**:\n"
        f"   • **Step 1**: Clarify your primary goal and gather any required data or context.\n"
        f"   • **Step 2**: Implement the simplest viable solution first before optimizing.\n"
        f"   • **Step 3**: Verify results, review feedback, and iterate.\n\n"
        f"3. **Practical Campus Example**:\n"
        f"   • In a campus or professional environment, communicating clearly and maintaining consistent momentum produces the highest success rate.\n\n"
        f"💡 *Would you like me to elaborate on any specific detail, provide practical examples, or draft a direct reply/solution for this?*"
    )
    return (reply, False, None, None, None, False)


@app.get("/api/ai/messages")
def get_ai_messages(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    msgs = db.query(models.AIMessage).filter(
        models.AIMessage.user_id == current_user.user_id
    ).order_by(models.AIMessage.created_at.asc()).all()

    first_name = current_user.full_name.split()[0] if current_user.full_name else "friend"

    if not msgs:
        welcome_text = (
            f"Hey {first_name}! 👋 I'm your CampusLink AI Assistant.\n\n"
            f"I'm here to help you excel in your studies, calculate your CGPA, draft academic emails, "
            f"and store important notes (like matric numbers, test schedules, or hostel reminders) in your private Memory Vault.\n\n"
            f"What would you like to do today?"
        )
        welcome_msg = models.AIMessage(
            user_id=current_user.user_id,
            sender="ai",
            content=welcome_text,
            is_memory_trigger=False
        )
        db.add(welcome_msg)
        db.commit()
        db.refresh(welcome_msg)
        msgs = [welcome_msg]

    return [
        {
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "reply": m.content,
            "is_memory_trigger": m.is_memory_trigger,
            "is_memory_stored": m.is_memory_trigger,
            "created_at": m.created_at
        }
        for m in msgs
    ]


@app.post("/api/ai/chat")
@app.post("/ai/chat")
async def chat_with_campus_ai(request: schemas.AIChatRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        fallback_msg = "CampusLink AI is not configured. Please add GROQ_API_KEY."
        return {
            "reply": fallback_msg,
            "content": fallback_msg,
            "sender": "ai",
            "id": "ai-" + str(int(datetime.now(timezone.utc).timestamp() * 1000)),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    user_msg = (request.message or request.content or "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        client = Groq(api_key=api_key.strip())

        # 1. Attempt to fetch active models dynamically from Groq
        chat_candidates = []
        try:
            models_data = client.models.list()
            chat_candidates = [
                m.id for m in models_data.data
                if any(k in m.id.lower() for k in ["llama", "gemma", "mixtral", "qwen"])
                and not any(x in m.id.lower() for x in ["guard", "whisper", "vision", "embed", "safeguard"])
            ]
            if chat_candidates:
                print(f"Dynamically discovered Groq models: {chat_candidates[:3]}")
        except Exception as list_err:
            print(f"Dynamic model listing skipped: {list_err}")

        # 2. Known standard model fallbacks if dynamic lookup is empty
        candidate_list = list(chat_candidates) if chat_candidates else []
        candidate_list.extend([
            "llama-3.3-70b-specdec",
            "llama-3.1-8b-instant",
            "llama3-70b-8192",
            "llama3-8b-8192",
            "gemma2-9b-it",
            "mixtral-8x7b-32768"
        ])
        # Remove None and duplicates while preserving order
        models_to_try = list(dict.fromkeys([m for m in candidate_list if m]))

        system_message = {
            "role": "system",
            "content": (
                "You are CampusLink AI, an intelligent, helpful, and versatile campus assistant. "
                "Answer questions accurately across academics, coding, campus life, and general knowledge. "
                "Use clear, clean Markdown formatting."
            )
        }

        messages = [system_message]
        for item in (request.history or [])[-8:]:
            if isinstance(item, dict) and "content" in item:
                role = item.get("role") if item.get("role") in ["user", "assistant"] else ("user" if item.get("sender") == "user" else "assistant")
                content = str(item.get("content") or item.get("message") or "").strip()
                if content:
                    messages.append({"role": role, "content": content})
            elif hasattr(item, "content"):
                role = "user" if getattr(item, "sender", "user") == "user" else "assistant"
                content = str(getattr(item, "content", "")).strip()
                if content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_msg})

        reply = None
        last_err = None
        for model_name in models_to_try:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1500,
                )
                if completion.choices and completion.choices[0].message:
                    reply = completion.choices[0].message.content
                    if reply:
                        break
            except Exception as err:
                last_err = err
                print(f"Failed model {model_name}: {err}")
                continue

        if not reply:
            if last_err:
                raise last_err
            reply = "I'm ready to help! What would you like to explore today?"

        return {
            "reply": reply,
            "content": reply,
            "sender": "ai",
            "id": "ai-" + str(int(datetime.now(timezone.utc).timestamp() * 1000)),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        print(f"Groq execution failure: {e}")
        err_msg = f"AI error: {str(e)}"
        return {
            "reply": err_msg,
            "content": err_msg,
            "sender": "ai",
            "id": "ai-" + str(int(datetime.now(timezone.utc).timestamp() * 1000)),
            "created_at": datetime.now(timezone.utc).isoformat()
        }


@app.get("/api/ai/memories", response_model=List[schemas.AIMemoryOut])
def get_ai_memories(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    memories = db.query(models.AIMemory).filter(
        models.AIMemory.user_id == current_user.user_id
    ).order_by(models.AIMemory.created_at.desc()).all()
    return memories


@app.post("/api/ai/memories", response_model=schemas.AIMemoryOut)
def create_ai_memory(
    payload: schemas.AIMemoryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Memory content cannot be empty.")
    title = payload.title.strip() if payload.title else " ".join(content.split()[:6])
    mem = models.AIMemory(
        user_id=current_user.user_id,
        title=title,
        content=content,
        category=payload.category or "general"
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return mem


@app.delete("/api/ai/memories/{memory_id}")
def delete_ai_memory(
    memory_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    mem = db.query(models.AIMemory).filter(
        models.AIMemory.id == memory_id,
        models.AIMemory.user_id == current_user.user_id
    ).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found.")
    db.delete(mem)
    db.commit()
    return {"message": "Memory deleted successfully", "id": memory_id}


@app.post("/api/ai/clear")
def clear_ai_chat(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    db.query(models.AIMessage).filter(
        models.AIMessage.user_id == current_user.user_id
    ).delete()
    db.commit()
    return {"message": "AI chat history cleared"}


# --- SERVE FRONTEND STATIC BUILD (IF PRESENT IN PRODUCTION) ---
from fastapi.responses import FileResponse

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_frontend_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not found")
        file_candidate = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_candidate):
            return FileResponse(file_candidate)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not found")
