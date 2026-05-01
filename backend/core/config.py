"""
SHESAFE Backend — Configuration Management
Loads all environment variables for Twilio, Firebase, and app settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # --- App ---
    APP_NAME: str = "SHESAFE"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # --- Twilio ---
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "")

    # --- Firebase ---
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "shesafe-d2928")
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    FIREBASE_STORAGE_BUCKET: str = os.getenv(
        "FIREBASE_STORAGE_BUCKET", "shesafe-d2928.firebasestorage.app"
    )

    # --- Firebase Web Config (for reference / client SDK) ---
    FIREBASE_API_KEY: str = "AIzaSyDpbH1nHcMWYOTDJ760spAeMaBO3GsB4lU"
    FIREBASE_AUTH_DOMAIN: str = "shesafe-d2928.firebaseapp.com"
    FIREBASE_APP_ID: str = "1:800246315630:web:87494fbd2246828d83c47f"

    # --- Database ---
    POLICE_DB_PATH: str = os.getenv(
        "POLICE_DB_PATH",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "police_stations.db"),
    )

    # --- Alert Defaults ---
    ALERT_COUNTDOWN_SECONDS: int = 45
    PASSIVE_ALERT_COUNTDOWN_SECONDS: int = 20
    LOCATION_PING_INTERVAL_SECONDS: int = 30
    SAFE_TIMEOUT_HOURS: int = 2

    # --- Vemana College Demo Zone ---
    DEMO_ZONE_LAT: float = 12.9340
    DEMO_ZONE_LNG: float = 77.6210
    DEMO_ZONE_NAME: str = "Vemana College of Engineering, Koramangala"

    def is_twilio_configured(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_PHONE_NUMBER)

    def is_firebase_configured(self) -> bool:
        return bool(self.FIREBASE_CREDENTIALS_PATH) and os.path.exists(
            self.FIREBASE_CREDENTIALS_PATH
        )

    def has_firebase_project(self) -> bool:
        """Returns True if we at least have a project ID (even without service account)."""
        return bool(self.FIREBASE_PROJECT_ID)


settings = Settings()
