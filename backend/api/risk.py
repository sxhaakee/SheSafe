"""
SHESAFE Backend — Risk Scoring Engine
Weighted multi-signal risk computation as defined in the FRD.

Risk Score = (Motion_weight × Motion_score) +
             (Location_weight × Location_score) +
             (Time_weight × Time_score) +
             (Behavior_weight × Behavior_score)

Weights: Motion=0.35, Location=0.30, Time=0.20, Behavior=0.15
"""

from fastapi import APIRouter
from datetime import datetime
from schemas.models import (
    RiskScoreRequest,
    RiskScoreResponse,
    RiskLevel,
    MotionState,
    BehaviorFlag,
    ContributingFactor,
)

router = APIRouter(prefix="/risk", tags=["Risk Engine"])

# ──────────────────────────────────────────────
# Weight Constants (from FRD FR-08)
# ──────────────────────────────────────────────
MOTION_WEIGHT = 0.35
LOCATION_WEIGHT = 0.30
TIME_WEIGHT = 0.20
BEHAVIOR_WEIGHT = 0.15

# ──────────────────────────────────────────────
# Motion Score Mapping (from FRD FR-09)
# ──────────────────────────────────────────────
MOTION_SCORES = {
    MotionState.NORMAL_WALK: 10,
    MotionState.RUNNING: 60,
    MotionState.STRUGGLING: 80,
    MotionState.PHONE_DROPPED: 90,
    MotionState.STATIONARY: 20,  # base; boosted if isolated + night
    MotionState.VEHICLE: 30,
}

# ──────────────────────────────────────────────
# Behavior Score Mapping (from FRD FR-12)
# ──────────────────────────────────────────────
BEHAVIOR_SCORES = {
    BehaviorFlag.SCREEN_DARK_NO_MOTION: 70,
    BehaviorFlag.SUDDEN_AIRPLANE_MODE: 90,
    BehaviorFlag.RAPID_APP_SWITCHING: 20,
    BehaviorFlag.PHONE_UPSIDE_DOWN: 40,
}


def compute_motion_score(motion_state: MotionState, is_isolated: bool, is_night: bool) -> float:
    """
    FR-09: Motion score with contextual boost.
    Stationary in isolated zone at night = 50 (boosted from base 20).
    """
    base = MOTION_SCORES.get(motion_state, 10)

    if motion_state == MotionState.STATIONARY and is_isolated and is_night:
        return 50.0

    return float(base)


def compute_location_score(nearest_station_km: float | None, is_isolated: bool) -> float:
    """
    FR-10: Location score based on distance to nearest police station
    and isolated zone flag.

    Scoring logic:
    - Distance < 1km: 10
    - Distance 1-3km: 30
    - Distance 3-5km: 50
    - Distance 5-10km: 70
    - Distance > 10km: 90
    - Isolated zone adds +20 (capped at 100)
    """
    if nearest_station_km is None:
        # No distance data — assume moderate risk
        base = 50.0
    elif nearest_station_km < 1.0:
        base = 10.0
    elif nearest_station_km < 3.0:
        base = 30.0
    elif nearest_station_km < 5.0:
        base = 50.0
    elif nearest_station_km < 10.0:
        base = 70.0
    else:
        base = 90.0

    if is_isolated:
        base = min(base + 20.0, 100.0)

    return base


def compute_time_score(hour: int) -> float:
    """
    FR-11: Time-of-day score.
    9 PM – 5 AM (21-05): 80
    7 PM – 9 PM (19-21): 50
    5 AM – 7 AM (05-07): 40
    Daytime (07-19): 10
    """
    if 21 <= hour or hour < 5:
        return 80.0
    elif 19 <= hour < 21:
        return 50.0
    elif 5 <= hour < 7:
        return 40.0
    else:
        return 10.0


def compute_behavior_score(flags: list[BehaviorFlag]) -> float:
    """
    FR-12: Behavior score is the max of all active behavior flags.
    Using max (not sum) prevents score inflation from multiple minor flags.
    """
    if not flags:
        return 0.0

    return float(max(BEHAVIOR_SCORES.get(flag, 0) for flag in flags))


def determine_risk_level(score: int) -> RiskLevel:
    """Map numeric score to risk level enum."""
    if score <= 30:
        return RiskLevel.SAFE
    elif score <= 60:
        return RiskLevel.WATCHFUL
    elif score <= 80:
        return RiskLevel.ALERT
    else:
        return RiskLevel.EMERGENCY


@router.post("/risk-score", response_model=RiskScoreResponse)
async def calculate_risk_score(request: RiskScoreRequest):
    """
    Compute the SHESAFE risk score using the weighted formula.
    Called from the app every 10 seconds during active monitoring.

    The score is privacy-first: it's computed here but the raw data
    never persists on the server unless an alert fires.
    """
    # Parse time from timestamp
    try:
        dt = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
        hour = dt.hour
    except (ValueError, AttributeError):
        # Fallback: try time_of_day field
        if request.time_of_day:
            hour = int(request.time_of_day.split(":")[0])
        else:
            hour = 12  # Default to daytime if unparseable

    # Determine night flag for motion score boost
    is_night = (21 <= hour or hour < 5)

    # Compute individual scores
    motion_raw = compute_motion_score(request.motion_state, request.is_isolated_zone, is_night)
    location_raw = compute_location_score(request.nearest_station_distance_km, request.is_isolated_zone)
    time_raw = compute_time_score(hour)
    behavior_raw = compute_behavior_score(request.behavior_flags)

    # Compute weighted scores
    motion_weighted = MOTION_WEIGHT * motion_raw
    location_weighted = LOCATION_WEIGHT * location_raw
    time_weighted = TIME_WEIGHT * time_raw
    behavior_weighted = BEHAVIOR_WEIGHT * behavior_raw

    # Total score (clamped 0-100)
    total_score = int(min(100, max(0, round(
        motion_weighted + location_weighted + time_weighted + behavior_weighted
    ))))

    # Determine risk level
    level = determine_risk_level(total_score)

    # Build contributing factors for transparency
    factors = [
        ContributingFactor(
            factor="Motion",
            weight=MOTION_WEIGHT,
            raw_score=motion_raw,
            weighted_score=round(motion_weighted, 2),
        ),
        ContributingFactor(
            factor="Location",
            weight=LOCATION_WEIGHT,
            raw_score=location_raw,
            weighted_score=round(location_weighted, 2),
        ),
        ContributingFactor(
            factor="Time",
            weight=TIME_WEIGHT,
            raw_score=time_raw,
            weighted_score=round(time_weighted, 2),
        ),
        ContributingFactor(
            factor="Behavior",
            weight=BEHAVIOR_WEIGHT,
            raw_score=behavior_raw,
            weighted_score=round(behavior_weighted, 2),
        ),
    ]

    return RiskScoreResponse(
        score=total_score,
        level=level,
        contributing_factors=factors,
        motion_score=motion_raw,
        location_score=location_raw,
        time_score=time_raw,
        behavior_score=behavior_raw,
    )
