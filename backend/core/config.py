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
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # --- Twilio ---
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")  # e.g. +1234567890
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "")  # e.g. whatsapp:+14155238886

    # --- Firebase ---
    FIREBASE_CREDENTIALS_PATH: str = os.getenv(
        "FIREBASE_CREDENTIALS_PATH", "firebase_service_account.json"
    )
    FIREBASE_STORAGE_BUCKET: str = os.getenv("FIREBASE_STORAGE_BUCKET", "")

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

    def is_twilio_configured(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_PHONE_NUMBER)

    def is_firebase_configured(self) -> bool:
        return bool(self.FIREBASE_CREDENTIALS_PATH) and os.path.exists(
            self.FIREBASE_CREDENTIALS_PATH
        )


settings = Settings()
