"""
SHESAFE Backend — Alert Dispatch API
Handles firing alerts to police stations and trusted contacts via Twilio SMS.
Also handles continuous location pings and "I'm Safe" flow.
"""

import uuid
import threading
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from core.config import settings

from schemas.models import (
    AlertFireRequest,
    AlertFireResponse,
    RecipientResult,
    LocationPingRequest,
    LocationPingResponse,
    ImSafeRequest,
    ImSafeResponse,
)

router = APIRouter(prefix="/alert", tags=["Alert Dispatch"])

# ──────────────────────────────────────────────
# In-memory alert store (replace with Firebase in production)
# ──────────────────────────────────────────────
active_alerts: dict = {}

# ──────────────────────────────────────────────
# Twilio client (lazy init)
# ──────────────────────────────────────────────
_twilio_client = None


def get_twilio_client():
    """Lazy-initialize the Twilio client."""
    global _twilio_client
    if _twilio_client is None and settings.is_twilio_configured():
        from twilio.rest import Client
        _twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    return _twilio_client


# ──────────────────────────────────────────────
# Firebase client (lazy init)
# ──────────────────────────────────────────────
_firebase_initialized = False


def init_firebase():
    """Initialize Firebase Admin SDK if credentials are available. Returns db client."""
    global _firebase_initialized
    if not _firebase_initialized and settings.is_firebase_configured():
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred, {
                "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
            })
            _firebase_initialized = True
            print("[SHESAFE] Firebase Admin SDK initialized.")
            return firestore.client()
        except Exception as e:
            print(f"[SHESAFE] Firebase init failed: {e}")
    return None



def save_alert_to_firestore(alert_id: str, alert_data: dict):
    """Save alert event to Firestore (non-blocking)."""
    if not _firebase_initialized:
        print(f"[SHESAFE] Firebase not initialized — skipping Firestore save for alert {alert_id}")
        return

    try:
        from firebase_admin import firestore
        db = firestore.client()
        db.collection("alerts").document(alert_id).set(alert_data)
        print(f"[SHESAFE] Alert {alert_id} saved to Firestore.")
    except Exception as e:
        print(f"[SHESAFE] Firestore save failed for alert {alert_id}: {e}")


# ──────────────────────────────────────────────
# SMS Templates (from FRD Section 7)
# ──────────────────────────────────────────────

def build_police_sms(req: AlertFireRequest, maps_link: str) -> str:
    """Build SMS content for police stations — exactly per FRD spec."""
    address_line = req.address or f"{req.lat}° N, {req.lng}° E"

    # Find primary emergency contact
    primary_contact = req.trusted_contacts[0] if req.trusted_contacts else None
    contact_line = ""
    if primary_contact:
        relation = primary_contact.relation or "Emergency Contact"
        contact_line = f"\nEmergency Contact: {primary_contact.phone} ({relation} - {primary_contact.name})"

    return (
        f"SHESAFE EMERGENCY ALERT\n"
        f"Name: {req.user_name}\n"
        f"Phone: {req.user_phone}\n"
        f"Location: {req.lat}° N, {req.lng}° E\n"
        f"Address: {address_line}\n"
        f"Time: {datetime.now(timezone.utc).strftime('%H:%M IST, %d %b %Y')}\n"
        f"Risk: HIGH — Multiple distress signals detected\n"
        f"Maps: {maps_link}\n"
        f"Trigger: {req.trigger_type.upper()}"
        f"{contact_line}"
    )


def build_contact_sms(req: AlertFireRequest, maps_link: str) -> str:
    """Build SMS content for trusted contacts — exactly per FRD spec."""
    address_line = req.address or f"{req.lat}, {req.lng}"

    return (
        f"SHESAFE SOS: {req.user_name} needs help.\n"
        f"Location: {address_line}\n"
        f"Maps: {maps_link}\n"
        f"Time: {datetime.now(timezone.utc).strftime('%H:%M IST, %d %b %Y')}\n"
        f"Risk Level: HIGH\n"
        f"Call her: {req.user_phone}"
    )


def send_sms(to: str, body: str) -> tuple[str, Optional[str], Optional[str]]:
    """
    Send SMS via Twilio. Returns (status, message_sid, error).
    If Twilio is not configured, simulates the send for demo/dev.
    """
    client = get_twilio_client()

    if client is None:
        # Demo mode — simulate SMS
        print(f"[SHESAFE DEMO SMS] To: {to}\n{body}\n{'─' * 40}")
        return ("sent_demo", f"DEMO_{uuid.uuid4().hex[:8]}", None)

    try:
        message = client.messages.create(
            body=body,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=to,
        )
        return ("sent", message.sid, None)
    except Exception as e:
        return ("failed", None, str(e))


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/fire", response_model=AlertFireResponse)
async def fire_alert(request: AlertFireRequest):
    """
    Fire a Level 3 emergency alert.
    Sends SMS to all 3 police stations + all trusted contacts SIMULTANEOUSLY
    using Python threading (all fire at once, not sequentially).

    Also saves the alert event to Firebase Firestore for the dashboard.
    """
    alert_id = f"SHESAFE_{uuid.uuid4().hex[:12].upper()}"
    maps_link = f"https://maps.google.com/?q={request.lat},{request.lng}"
    timestamp = datetime.now(timezone.utc).isoformat()

    # Build SMS messages
    police_sms = build_police_sms(request, maps_link)
    contact_sms = build_contact_sms(request, maps_link)

    # ── Send all SMS simultaneously using threads ──
    results: list[RecipientResult] = []
    threads: list[threading.Thread] = []
    results_lock = threading.Lock()

    def send_and_record(name: str, phone: str, body: str, recipient_type: str):
        status, sid, error = send_sms(phone, body)
        with results_lock:
            results.append(RecipientResult(
                name=name,
                phone=phone,
                type=recipient_type,
                sms_status=status,
                message_sid=sid,
                error=error,
            ))

    # Queue police station SMS
    for station in request.nearest_stations:
        t = threading.Thread(
            target=send_and_record,
            args=(station.name, station.phone, police_sms, "police"),
        )
        threads.append(t)

    # Queue trusted contact SMS
    for contact in request.trusted_contacts:
        t = threading.Thread(
            target=send_and_record,
            args=(contact.name, contact.phone, contact_sms, "contact"),
        )
        threads.append(t)

    # Fire all simultaneously
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)  # 30 second timeout per SMS

    # Determine overall status
    sent_count = sum(1 for r in results if "sent" in r.sms_status)
    total = len(results)

    if sent_count == total:
        overall_status = "dispatched"
    elif sent_count > 0:
        overall_status = "partial_failure"
    else:
        overall_status = "total_failure"

    # Store alert in memory (and Firestore if available)
    alert_data = {
        "alert_id": alert_id,
        "user_name": request.user_name,
        "user_phone": request.user_phone,
        "lat": request.lat,
        "lng": request.lng,
        "address": request.address,
        "risk_score": request.risk_score,
        "risk_level": request.risk_level.value,
        "trigger_type": request.trigger_type,
        "timestamp": timestamp,
        "maps_link": maps_link,
        "status": overall_status,
        "is_safe": False,
        "location_pings": [],
        "recipients": [r.model_dump() for r in results],
    }

    active_alerts[alert_id] = alert_data

    # Save to Firestore in background (non-blocking)
    threading.Thread(
        target=save_alert_to_firestore,
        args=(alert_id, alert_data),
    ).start()

    return AlertFireResponse(
        alert_id=alert_id,
        status=overall_status,
        recipients=results,
        timestamp=timestamp,
        google_maps_link=maps_link,
    )


@router.post("/ping", response_model=LocationPingResponse)
async def location_ping(request: LocationPingRequest):
    """
    Receive continuous location pings during an active alert.
    Every 30 seconds, the app sends updated GPS coordinates.
    These are stored for the trusted contact dashboard.
    """
    if request.alert_id not in active_alerts:
        raise HTTPException(status_code=404, detail=f"Alert {request.alert_id} not found")

    alert = active_alerts[request.alert_id]

    if alert.get("is_safe"):
        raise HTTPException(status_code=400, detail="Alert already resolved — user confirmed safe")

    # Append ping
    ping = {
        "lat": request.lat,
        "lng": request.lng,
        "timestamp": request.timestamp,
    }
    alert["location_pings"].append(ping)
    ping_number = len(alert["location_pings"])

    # Update latest location
    alert["lat"] = request.lat
    alert["lng"] = request.lng

    # Update Firestore in background
    if _firebase_initialized:
        def update_firestore():
            try:
                from firebase_admin import firestore
                db = firestore.client()
                db.collection("alerts").document(request.alert_id).update({
                    "lat": request.lat,
                    "lng": request.lng,
                    "location_pings": firestore.ArrayUnion([ping]),
                })
            except Exception as e:
                print(f"[SHESAFE] Firestore ping update failed: {e}")

        threading.Thread(target=update_firestore).start()

    return LocationPingResponse(
        status="recorded",
        ping_number=ping_number,
        alert_id=request.alert_id,
    )


@router.post("/safe", response_model=ImSafeResponse)
async def confirm_safe(request: ImSafeRequest):
    """
    FR-41/42: User confirms "I'm Safe".
    Marks the alert as resolved, stops location pings,
    and sends confirmation to all recipients.
    """
    if request.alert_id not in active_alerts:
        raise HTTPException(status_code=404, detail=f"Alert {request.alert_id} not found")

    alert = active_alerts[request.alert_id]

    if alert.get("is_safe"):
        raise HTTPException(status_code=400, detail="Alert already resolved")

    # Mark as safe
    alert["is_safe"] = True
    alert["safe_confirmed_at"] = datetime.now(timezone.utc).isoformat()

    # Send "I'm Safe" notification to all recipients
    safe_message = (
        f"SHESAFE UPDATE: {alert['user_name']} has confirmed she is SAFE.\n"
        f"Alert {request.alert_id} resolved at "
        f"{datetime.now(timezone.utc).strftime('%H:%M IST, %d %b %Y')}.\n"
        f"No further action needed."
    )

    notifications_sent = 0
    for recipient in alert.get("recipients", []):
        status, _, _ = send_sms(recipient["phone"], safe_message)
        if "sent" in status:
            notifications_sent += 1

    # Update Firestore
    if _firebase_initialized:
        def update_firestore():
            try:
                from firebase_admin import firestore
                db = firestore.client()
                db.collection("alerts").document(request.alert_id).update({
                    "is_safe": True,
                    "safe_confirmed_at": alert["safe_confirmed_at"],
                })
            except Exception as e:
                print(f"[SHESAFE] Firestore safe update failed: {e}")

        threading.Thread(target=update_firestore).start()

    return ImSafeResponse(
        status="safe_confirmed",
        alert_id=request.alert_id,
        notifications_sent=notifications_sent,
    )


@router.get("/status/{alert_id}")
async def get_alert_status(alert_id: str):
    """Get current status of an alert (used by trusted contact dashboard)."""
    if alert_id not in active_alerts:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert = active_alerts[alert_id]
    return {
        "alert_id": alert_id,
        "user_name": alert["user_name"],
        "user_phone": alert["user_phone"],
        "lat": alert["lat"],
        "lng": alert["lng"],
        "address": alert.get("address"),
        "risk_score": alert["risk_score"],
        "risk_level": alert["risk_level"],
        "trigger_type": alert["trigger_type"],
        "timestamp": alert["timestamp"],
        "maps_link": alert["maps_link"],
        "is_safe": alert["is_safe"],
        "location_pings": alert["location_pings"],
        "total_pings": len(alert["location_pings"]),
    }
