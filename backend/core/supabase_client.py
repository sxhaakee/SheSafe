"""
SHESAFE Backend — Supabase database client
Replaces Firebase with Supabase (PostgreSQL).
"""
import os
from typing import Optional

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

_client = None


def get_supabase():
    """Lazy-init Supabase client."""
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
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


# ── Users ──────────────────────────────────────────────────────────────────

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


# ── Alerts ────────────────────────────────────────────────────────────────

def insert_alert(alert: dict) -> bool:
    db = get_supabase()
    if not db:
        return False
    try:
        db.table("alerts").insert(alert).execute()
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
