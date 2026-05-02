"""
SHESAFE Backend — Pydantic Schemas
Request/Response models for all API endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class MotionState(str, Enum):
    NORMAL_WALK = "normal_walk"
    RUNNING = "running"
    STRUGGLING = "struggling"
    STATIONARY = "stationary"
    VEHICLE = "vehicle"
    PHONE_DROPPED = "phone_dropped"


class RiskLevel(str, Enum):
    SAFE = "safe"              # 0-30
    LOW = "low"                # alias for safe
    WATCHFUL = "watchful"      # 31-60
    ALERT = "alert"            # 61-80
    HIGH = "high"              # alias for emergency
    EMERGENCY = "emergency"    # 81-100


class BehaviorFlag(str, Enum):
    SCREEN_DARK_NO_MOTION = "screen_dark_no_motion"
    SUDDEN_AIRPLANE_MODE = "sudden_airplane_mode"
    RAPID_APP_SWITCHING = "rapid_app_switching"
    PHONE_UPSIDE_DOWN = "phone_upside_down"


# ──────────────────────────────────────────────
# Police Station Schemas
# ──────────────────────────────────────────────

class NearestStationsRequest(BaseModel):
    lat: float = Field(..., description="Current latitude", ge=-90, le=90)
    lng: float = Field(..., description="Current longitude", ge=-180, le=180)


class PoliceStationResponse(BaseModel):
    id: int
    name: str
    address: str
    phone: str
    latitude: float
    longitude: float
    distance_km: float
    jurisdiction: Optional[str] = None
    city: Optional[str] = None


class NearestStationsResponse(BaseModel):
    stations: List[PoliceStationResponse]
    query_lat: float
    query_lng: float


# ──────────────────────────────────────────────
# Risk Score Schemas
# ──────────────────────────────────────────────

class RiskScoreRequest(BaseModel):
    motion_state: MotionState = Field(..., description="Current classified motion state")
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    timestamp: str = Field(..., description="ISO 8601 timestamp from device")
    time_of_day: Optional[str] = Field(None, description="HH:MM in 24h format. Auto-derived from timestamp if not provided.")
    behavior_flags: List[BehaviorFlag] = Field(default_factory=list)
    is_isolated_zone: bool = Field(False, description="Whether current location is flagged as isolated")
    nearest_station_distance_km: Optional[float] = Field(None, description="Distance to nearest police station in km. Auto-computed if not provided.")
    accel_magnitude: Optional[float] = Field(None, description="Current accelerometer magnitude in m/s². Used for struggle/drop detection.")


class ContributingFactor(BaseModel):
    factor: str
    weight: float
    raw_score: float
    weighted_score: float
    reasoning: Optional[str] = None


class RiskScoreResponse(BaseModel):
    score: int = Field(..., ge=0, le=100)
    level: RiskLevel
    contributing_factors: List[ContributingFactor]
    motion_score: float
    location_score: float
    time_score: float
    behavior_score: float
    is_isolated_zone: bool = False
    zone_data: Optional[dict] = None


# ──────────────────────────────────────────────
# Alert Schemas
# ──────────────────────────────────────────────

class TrustedContact(BaseModel):
    name: str
    phone: str = Field(..., description="Phone number with country code, e.g. +919876543210")
    relation: Optional[str] = None


class AlertStation(BaseModel):
    name: str
    phone: str
    distance_km: float = 0.0  # Optional — victim app doesn't always send this


class AlertFireRequest(BaseModel):
    user_name: str
    user_phone: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: Optional[str] = Field(None, description="Reverse-geocoded address, if available")
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    trusted_contacts: List[TrustedContact]
    nearest_stations: List[AlertStation]
    evidence_url: Optional[str] = None
    trigger_type: str = Field("manual", description="widget | shake | power_button | passive | voice")


class RecipientResult(BaseModel):
    name: str
    phone: str
    type: str  # "police" or "contact"
    sms_status: str  # "sent", "failed", "queued"
    message_sid: Optional[str] = None
    error: Optional[str] = None


class AlertFireResponse(BaseModel):
    alert_id: str
    status: str  # "dispatched", "partial_failure", "total_failure"
    recipients: List[RecipientResult]
    timestamp: str
    google_maps_link: str


# ──────────────────────────────────────────────
# Location Ping Schemas
# ──────────────────────────────────────────────

class LocationPingRequest(BaseModel):
    alert_id: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    timestamp: str


class LocationPingResponse(BaseModel):
    status: str
    ping_number: int
    alert_id: str


# ──────────────────────────────────────────────
# I'm Safe Schemas
# ──────────────────────────────────────────────

class ImSafeRequest(BaseModel):
    alert_id: str
    user_phone: str = ""
    pin: str = ""  # Optional — victim confirms safe without PIN from the "I'm Safe" button


class ImSafeResponse(BaseModel):
    status: str
    alert_id: str
    notifications_sent: int
