"""
SheSafe — False Alarm Filter
Multi-signal validation: requires 2+ elevated signals before full alert.
This is the core mechanism that eliminates single-event false triggers.
"""

# Thresholds
SIGNAL_ELEVATED_THRESHOLD = 55   # Score above this = "elevated"
FULL_ALERT_THRESHOLD = 75        # Final risk score for full alert
SOFT_ALERT_THRESHOLD = 50        # Score for soft alert (notify contacts, no police)

# Minimum signals that must be elevated for each alert level
SOFT_ALERT_MIN_SIGNALS = 1       # 1 signal = soft alert
FULL_ALERT_MIN_SIGNALS = 2       # 2+ signals = full alert (police notified)

# Struggling requires gyro confirmation
STRUGGLE_GYRO_MIN = 1.5          # rad/s minimum gyro for struggle to count


def validate_alert(
    motion_score: float,
    location_score: float,
    time_score: float,
    behavior_score: float,
    motion_state: str = "",
    gyro_magnitude: float = 0.0,
    consecutive_struggle_windows: int = 0,
) -> dict:
    """
    Validate whether sensor data justifies an alert.
    Returns: {level, reason, should_alert, risk_score}
    
    Level 0 = no alert
    Level 1 = soft alert (contacts notified, no police)
    Level 2 = full alert (police + contacts)
    """

    # ── Anti-false-alarm rules ────────────────────────────────────────────────

    # Rule 1: Struggling only counts if gyroscope also shows rotation
    if motion_state == "struggling" and gyro_magnitude < STRUGGLE_GYRO_MIN:
        # Reduce motion score — likely accidental jerk, not actual struggle
        motion_score = min(motion_score, 40)

    # Rule 2: Struggling requires 3 consecutive windows (6 seconds)
    if motion_state == "struggling" and consecutive_struggle_windows < 3:
        motion_score = min(motion_score, 55)

    # Rule 3: Phone dropped alone is not full alert (could be intentional)
    if motion_state == "phone_dropped" and behavior_score < 40:
        motion_score = min(motion_score, 60)

    # ── Count elevated signals ────────────────────────────────────────────────
    signals = {
        "motion": motion_score,
        "location": location_score,
        "time": time_score,
        "behavior": behavior_score,
    }

    elevated = {k: v for k, v in signals.items() if v >= SIGNAL_ELEVATED_THRESHOLD}
    elevated_count = len(elevated)

    # ── Compute weighted risk score ───────────────────────────────────────────
    risk_score = (
        0.35 * motion_score +
        0.30 * location_score +
        0.20 * time_score +
        0.15 * behavior_score
    )
    risk_score = round(min(100, risk_score), 1)

    # ── Determine alert level ─────────────────────────────────────────────────
    reasons = []

    if motion_state == "struggling":
        reasons.append("Struggle motion detected")
    elif motion_state == "phone_dropped":
        reasons.append("Phone dropped")
    elif motion_state == "running":
        reasons.append("Panic running detected")

    if location_score >= SIGNAL_ELEVATED_THRESHOLD:
        reasons.append("Isolated/high-risk location")
    if time_score >= SIGNAL_ELEVATED_THRESHOLD:
        reasons.append("High-risk time window")
    if behavior_score >= SIGNAL_ELEVATED_THRESHOLD:
        reasons.append("Suspicious phone behavior")

    # Manual triggers always get level 2
    if motion_state in ("manual_sos", "shake_trigger"):
        return {
            "level": 2,
            "risk_score": max(risk_score, 85),
            "should_alert": True,
            "reason": "Manual SOS triggered",
            "elevated_signals": elevated,
        }

    if elevated_count >= FULL_ALERT_MIN_SIGNALS and risk_score >= FULL_ALERT_THRESHOLD:
        return {
            "level": 2,
            "risk_score": risk_score,
            "should_alert": True,
            "reason": " + ".join(reasons) if reasons else "Multiple distress signals",
            "elevated_signals": elevated,
        }
    elif elevated_count >= SOFT_ALERT_MIN_SIGNALS and risk_score >= SOFT_ALERT_THRESHOLD:
        return {
            "level": 1,
            "risk_score": risk_score,
            "should_alert": True,
            "reason": " + ".join(reasons) if reasons else "Possible distress signal",
            "elevated_signals": elevated,
        }
    else:
        return {
            "level": 0,
            "risk_score": risk_score,
            "should_alert": False,
            "reason": "Normal activity",
            "elevated_signals": elevated,
        }


def get_risk_description(risk_score: float) -> dict:
    """Return human-readable risk description and color."""
    if risk_score >= 80:
        return {"label": "CRITICAL", "color": "#FF4757", "emoji": "🔴"}
    elif risk_score >= 60:
        return {"label": "HIGH", "color": "#FF6B35", "emoji": "🟠"}
    elif risk_score >= 40:
        return {"label": "MODERATE", "color": "#FFAB00", "emoji": "🟡"}
    elif risk_score >= 20:
        return {"label": "LOW", "color": "#2ED573", "emoji": "🟢"}
    else:
        return {"label": "SAFE", "color": "#2ED573", "emoji": "✅"}
