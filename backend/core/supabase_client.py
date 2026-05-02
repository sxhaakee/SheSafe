"""
SHESAFE Backend — Supabase database client
All user and alert persistence goes through here.
Supabase is the SINGLE SOURCE OF TRUTH for alerts — no SMS needed.
Police/family apps poll the backend, which reads from Supabase.
"""
import os
from typing import Optional, List

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

_client = None


def get_supabase():
    """Lazy-initialise the Supabase client. Returns None if not configured."""
    global _client
    if _client is not None:
        return _client
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    try:
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("[SHESAFE] Supabase connected ✅")
        return _client
    except Exception as e:
        print(f"[SHESAFE] Supabase init failed: {e}")
        return None


def is_configured() -> bool:
    """Returns True if Supabase credentials are present in the environment."""
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


# ── Users ──────────────────────────────────────────────────────────────────────

def upsert_user(user: dict) -> bool:
    db = get_supabase()
    if not db:
        return False
    try:
        db.table("users").upsert(user).execute()
        return True
    except Exception as e:
        print(f"[SUPABASE] upsert_user failed: {e}")
        return False


def get_user(phone: str) -> Optional[dict]:
    db = get_supabase()
    if not db:
        return None
    try:
        res = db.table("users").select("*").eq("phone", phone).single().execute()
        return res.data
    except Exception:
        return None


# ── Alerts ─────────────────────────────────────────────────────────────────────

def insert_alert(alert: dict) -> bool:
    db = get_supabase()
    if not db:
        return False
    try:
        db.table("alerts").upsert(alert).execute()
        return True
    except Exception as e:
        print(f"[SUPABASE] insert_alert failed: {e}")
        return False


def update_alert(alert_id: str, fields: dict) -> bool:
    db = get_supabase()
    if not db:
        return False
    try:
        db.table("alerts").update(fields).eq("alert_id", alert_id).execute()
        return True
    except Exception as e:
        print(f"[SUPABASE] update_alert failed: {e}")
        return False


def get_active_alerts() -> List[dict]:
    """Get all active (non-safe) alerts from Supabase."""
    db = get_supabase()
    if not db:
        return []
    try:
        res = db.table("alerts").select("*").eq("is_safe", False).order("timestamp", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"[SUPABASE] get_active_alerts failed: {e}")
        return []


def get_alert_by_id(alert_id: str) -> Optional[dict]:
    """Get a single alert from Supabase by alert_id."""
    db = get_supabase()
    if not db:
        return None
    try:
        res = db.table("alerts").select("*").eq("alert_id", alert_id).single().execute()
        return res.data
    except Exception:
        return None
