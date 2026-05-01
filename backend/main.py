"""
SHESAFE Backend — FastAPI Entry Point
The brain of the SHESAFE passive women safety system.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from core.database import init_db
from api.police import router as police_router
from api.risk import router as risk_router
from api.alerts import router as alerts_router, init_firebase
from api.auth import router as auth_router

# Global Firebase db reference (set by init_firebase, used by auth module)
db = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and Firebase on startup."""
    print(f"[{settings.APP_NAME}] Starting backend v{settings.APP_VERSION}...")

    # Initialize SQLite police station DB
    init_db()
    print(f"[{settings.APP_NAME}] Police station database ready.")

    # Initialize Firebase (if credentials exist)
    global db
    db = init_firebase()

    # Check Twilio
    if settings.is_twilio_configured():
        print(f"[{settings.APP_NAME}] Twilio configured — SMS will be sent live.")
    else:
        print(f"[{settings.APP_NAME}] Twilio NOT configured — running in DEMO mode (SMS simulated).")

    print(f"[{settings.APP_NAME}] ✅ Backend ready. All systems operational.")
    yield
    print(f"[{settings.APP_NAME}] Shutting down...")


app = FastAPI(
    title="SHESAFE API",
    description=(
        "Backend for the SHESAFE passive women safety system. "
        "Handles risk scoring, police station lookups, alert dispatch, "
        "and real-time location tracking."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# ── CORS — Allow React Native app to connect from any origin ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount routers ──
app.include_router(auth_router)
app.include_router(police_router)
app.include_router(risk_router)
app.include_router(alerts_router)


# ── Health check ──
@app.get("/ping")
async def ping():
    """Health check endpoint. Also returns active alert IDs for mobile app polling."""
    from api.alerts import active_alerts
    active = [aid for aid, data in active_alerts.items() if not data.get("is_safe", False)]
    return {
        "status": "alive",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "twilio_configured": settings.is_twilio_configured(),
        "firebase_configured": settings.is_firebase_configured(),
        "active_alerts": active,
        "total_alerts": len(active_alerts),
    }


@app.get("/")
async def root():
    """Root endpoint with API overview."""
    return {
        "name": "SHESAFE API",
        "version": settings.APP_VERSION,
        "endpoints": {
            "health": "GET /ping",
            "nearest_stations": "POST /police/nearest-stations",
            "all_stations": "GET /police/all-stations",
            "risk_score": "POST /risk/risk-score",
            "fire_alert": "POST /alert/fire",
            "location_ping": "POST /alert/ping",
            "confirm_safe": "POST /alert/safe",
            "alert_status": "GET /alert/status/{alert_id}",
        },
        "docs": "/docs",
    }
