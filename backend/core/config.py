"""
SHESAFE Backend — Configuration Management
Loads all environment variables for Twilio, Supabase, and app settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # ── App ────────────────────────────────────────────────────────────────
    APP_NAME: str = "SHESAFE"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # ── Twilio ─────────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "")

    # ── Supabase ───────────────────────────────────────────────────────────
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # ── JWT Auth ───────────────────────────────────────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "shesafe-dev-secret")

    # ── Database ───────────────────────────────────────────────────────────
    POLICE_DB_PATH: str = os.getenv(
        "POLICE_DB_PATH",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "police_stations.db"),
    )

    # ── Alert Timing ───────────────────────────────────────────────────────
    ALERT_COUNTDOWN_SECONDS: int = 45
    PASSIVE_ALERT_COUNTDOWN_SECONDS: int = 20
    LOCATION_PING_INTERVAL_SECONDS: int = 30
    SAFE_TIMEOUT_HOURS: int = 2

    # ── Demo Zone (Vemana College, Koramangala) ────────────────────────────
    DEMO_ZONE_LAT: float = 12.9340
    DEMO_ZONE_LNG: float = 77.6210
    DEMO_ZONE_NAME: str = "Vemana College of Engineering, Koramangala"

    def is_twilio_configured(self) -> bool:
        """Returns True if all required Twilio credentials are present."""
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_PHONE_NUMBER)


settings = Settings()
