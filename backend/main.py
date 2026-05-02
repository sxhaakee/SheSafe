"""
SHESAFE Backend — FastAPI Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from core.database import init_db
from core.supabase_client import is_configured as supabase_configured
from api.police import router as police_router
from api.risk import router as risk_router
from api.alerts import router as alerts_router, init_firebase
from api.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all services on startup."""
    print(f"[{settings.APP_NAME}] Starting backend v{settings.APP_VERSION}...")

    # SQLite police station database
    init_db()
    print(f"[{settings.APP_NAME}] Police station database ready.")

    # Supabase (persistent user/alert storage)
    if supabase_configured():
        print(f"[{settings.APP_NAME}] Supabase connected — persistent storage active.")
    else:
        print(f"[{settings.APP_NAME}] Supabase NOT configured — running with in-memory store only.")

    # Alert notification system
    init_firebase()

    print(f"[{settings.APP_NAME}] ✅ Backend ready (Internet-based alerts via Supabase).")
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

# Allow the React Native app to connect from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(police_router)
app.include_router(risk_router)
app.include_router(alerts_router)


@app.get("/ping")
async def ping():
    """
    Health check + active alert polling.
    Police/family apps call this every 5 seconds.
    Reads from BOTH in-memory store and Supabase to ensure alerts survive restarts.
    """
    from api.alerts import active_alerts
    from core.supabase_client import get_active_alerts

    # In-memory alerts
    memory_ids = {aid for aid, data in active_alerts.items() if not data.get("is_safe", False)}

    # Supabase alerts (source of truth — survives backend restarts)
    supabase_alerts = get_active_alerts()
    supabase_ids = {a["alert_id"] for a in supabase_alerts}

    # Merge both sets — hydrate in-memory from Supabase if missing
    for sa in supabase_alerts:
        aid = sa["alert_id"]
        if aid not in active_alerts:
            # Hydrate in-memory cache from Supabase
            active_alerts[aid] = {
                **sa,
                "location_pings": sa.get("location_pings") or [],
                "recipients": sa.get("recipients") or [],
                "evidence_urls": sa.get("evidence_urls") or [],
            }

    all_active = list(memory_ids | supabase_ids)

    return {
        "status": "alive",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "supabase_configured": supabase_configured(),
        "active_alerts": all_active,
        "total_alerts": len(all_active),
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
            "evidence_upload": "POST /alert/evidence",
        },
        "docs": "/docs",
    }
