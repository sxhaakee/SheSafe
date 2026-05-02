"""
SheSafe — Auth API (Supabase backend)
Role-based registration and login for User (victim), Police, Contact.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "shesafe-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory cache (primary fast store, Supabase is persistent backup)
_users: dict = {}


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    phone: str
    email: str
    password: str
    role: str
    pin: str = ""
    emergency_contacts: list = []
    badge_number: str = ""
    station_name: str = ""
    victim_phone: str = ""
    relationship: str = ""

class LoginRequest(BaseModel):
    phone: str
    password: str

class VerifyPinRequest(BaseModel):
    phone: str
    pin: str

class UpdateProfileRequest(BaseModel):
    phone: str
    name: str
    email: str
    emergency_contacts: list = []

class ResetPasswordRequest(BaseModel):
    phone: str
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash(value: str) -> str:
    return pwd_context.hash(value[:72])  # bcrypt max 72 bytes

def _verify(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)

def _create_token(phone: str, role: str) -> str:
    payload = {
        "sub": phone,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest):
    if req.role not in ("victim", "police", "contact"):
        raise HTTPException(status_code=400, detail="Role must be victim, police, or contact")

    if req.role == "victim" and (not req.pin or len(req.pin) != 4):
        raise HTTPException(status_code=400, detail="Please set a 4-digit safety PIN")

    # Check in-memory cache first, then Supabase
    if req.phone in _users:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    from core.supabase_client import get_user, upsert_user
    existing = get_user(req.phone)
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    user = {
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

    _users[req.phone] = user

    # Persist to Supabase (non-blocking)
    import threading
    threading.Thread(target=upsert_user, args=({
        "phone": req.phone,
        "name": req.name,
        "email": req.email,
        "role": req.role,
        "password_hash": user["password_hash"],
        "pin_hash": user["pin_hash"],
        "emergency_contacts": req.emergency_contacts,
        "badge_number": req.badge_number,
        "station_name": req.station_name,
        "victim_phone": req.victim_phone,
        "relationship": req.relationship,
        "created_at": user["created_at"],
    },)).start()

    token = _create_token(req.phone, req.role)
    return {
        "success": True,
        "token": token,
        "user": {"name": req.name, "phone": req.phone, "role": req.role, "email": req.email}
    }


@router.post("/login")
async def login(req: LoginRequest):
    user = _users.get(req.phone)

    if not user:
        # Try Supabase
        from core.supabase_client import get_user
        supabase_user = get_user(req.phone)
        if supabase_user:
            user = supabase_user
            _users[req.phone] = user  # cache it

    if not user:
        raise HTTPException(status_code=404, detail="Phone number not registered. Please sign up first.")

    if not _verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

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
        from core.supabase_client import get_user
        user = get_user(req.phone)
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
        from core.supabase_client import get_user
        user = get_user(phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {k: v for k, v in user.items() if k not in ("password_hash", "pin_hash")}


@router.post("/update-profile")
async def update_profile(req: UpdateProfileRequest):
    user = _users.get(req.phone)
    if not user:
        from core.supabase_client import get_user
        user = get_user(req.phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["name"] = req.name
    user["email"] = req.email
    user["emergency_contacts"] = req.emergency_contacts
    _users[req.phone] = user

    import threading
    from core.supabase_client import upsert_user
    threading.Thread(target=upsert_user, args=({
        **user,
        "name": req.name,
        "email": req.email,
        "emergency_contacts": req.emergency_contacts,
    },)).start()

    return {"success": True, "message": "Profile updated successfully"}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    user = _users.get(req.phone)
    if not user:
        from core.supabase_client import get_user
        user = get_user(req.phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_hash = _hash(req.new_password)
    user["password_hash"] = new_hash
    _users[req.phone] = user

    import threading
    from core.supabase_client import upsert_user
    threading.Thread(target=upsert_user, args=({
        **user,
        "password_hash": new_hash,
    },)).start()

    return {"success": True, "message": "Password reset successfully"}
