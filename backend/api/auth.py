"""
SheSafe — Auth API
Role-based registration and login for Victim, Police, Contact.
PIN is hashed with bcrypt and stored in Firestore.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os, hashlib

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "shesafe-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory user store (replace with Firestore in production)
# Structure: {phone: {name, email, role, password_hash, pin_hash, contacts, ...}}
_users: dict = {}
_tokens: dict = {}  # token → phone

# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    phone: str
    email: str
    password: str
    role: str          # "victim" | "police" | "contact"
    pin: str = ""      # 4-digit PIN (required for victim)
    # Victim-specific
    emergency_contacts: list = []
    # Police-specific
    badge_number: str = ""
    station_name: str = ""
    # Contact-specific
    victim_phone: str = ""
    relationship: str = ""

class LoginRequest(BaseModel):
    phone: str
    password: str

class VerifyPinRequest(BaseModel):
    phone: str
    pin: str

class ProfileUpdateRequest(BaseModel):
    phone: str
    token: str
    emergency_contacts: list = None
    victim_phone: str = None

# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash(value: str) -> str:
    return pwd_context.hash(value)

def _verify(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def _create_token(phone: str, role: str) -> str:
    payload = {
        "sub": phone,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    _tokens[token] = phone
    return token

def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest):
    if req.phone in _users:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    if req.role not in ("victim", "police", "contact"):
        raise HTTPException(status_code=400, detail="Role must be victim, police, or contact")

    if req.role == "victim" and (not req.pin or len(req.pin) != 4):
        raise HTTPException(status_code=400, detail="Victims must set a 4-digit PIN")

    _users[req.phone] = {
        "name": req.name,
        "phone": req.phone,
        "email": req.email,
        "role": req.role,
        "password_hash": _hash(req.password),
        "pin_hash": _hash(req.pin) if req.pin else "",
        "emergency_contacts": req.emergency_contacts,
        "badge_number": req.badge_number,
        "station_name": req.station_name,
        "victim_phone": req.victim_phone,
        "relationship": req.relationship,
        "created_at": datetime.utcnow().isoformat(),
    }

    token = _create_token(req.phone, req.role)

    # Try to persist to Firestore
    try:
        from main import db
        if db:
            user_data = dict(_users[req.phone])
            user_data.pop("password_hash", None)  # Don't store raw hash in Firestore key
            db.collection("users").document(req.phone).set(user_data)
    except Exception as e:
        print(f"[AUTH] Firestore save skipped: {e}")

    return {
        "success": True,
        "token": token,
        "user": {
            "name": req.name,
            "phone": req.phone,
            "role": req.role,
            "email": req.email,
        }
    }


@router.post("/login")
async def login(req: LoginRequest):
    user = _users.get(req.phone)

    # Try Firestore if not in memory
    if not user:
        try:
            from main import db
            if db:
                doc = db.collection("users").document(req.phone).get()
                if doc.exists:
                    user = doc.to_dict()
                    _users[req.phone] = user
        except Exception:
            pass

    if not user:
        raise HTTPException(status_code=404, detail="Phone number not registered")

    if not _verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = _create_token(req.phone, user["role"])

    return {
        "success": True,
        "token": token,
        "user": {
            "name": user["name"],
            "phone": user["phone"],
            "role": user["role"],
            "email": user.get("email", ""),
            "emergency_contacts": user.get("emergency_contacts", []),
            "victim_phone": user.get("victim_phone", ""),
            "station_name": user.get("station_name", ""),
        }
    }


@router.post("/verify-pin")
async def verify_pin(req: VerifyPinRequest):
    user = _users.get(req.phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.get("pin_hash"):
        raise HTTPException(status_code=400, detail="No PIN set for this account")

    if not _verify(req.pin, user["pin_hash"]):
        return {"valid": False, "message": "Incorrect PIN"}

    return {"valid": True, "message": "PIN verified"}


@router.get("/profile/{phone}")
async def get_profile(phone: str):
    user = _users.get(phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "pin_hash")}
    return safe
