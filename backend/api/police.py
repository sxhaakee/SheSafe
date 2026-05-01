"""
SHESAFE Backend — Police Station API
Nearest-3 police station lookup using Haversine distance.
"""

import math
from fastapi import APIRouter
from core.database import get_db_connection
from schemas.models import (
    NearestStationsRequest,
    NearestStationsResponse,
    PoliceStationResponse,
)

router = APIRouter(prefix="/police", tags=["Police Stations"])


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points
    on Earth using the Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371.0  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@router.post("/nearest-stations", response_model=NearestStationsResponse)
async def get_nearest_stations(request: NearestStationsRequest):
    """
    Find the 3 nearest police stations to the given GPS coordinates.
    Uses Haversine formula for accurate distance calculation.

    Why 3 stations:
    - Station 1: closest to incident origin
    - Station 2: covers likely direction of travel
    - Station 3: covers alternate escape routes
    All three create a jurisdictional net.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM police_stations")
    rows = cursor.fetchall()
    conn.close()

    # Calculate distance for every station and sort
    stations_with_distance = []
    for row in rows:
        distance = haversine_distance(
            request.lat, request.lng,
            row["latitude"], row["longitude"]
        )
        stations_with_distance.append(
            PoliceStationResponse(
                id=row["id"],
                name=row["name"],
                address=row["address"],
                phone=row["phone"],
                latitude=row["latitude"],
                longitude=row["longitude"],
                distance_km=round(distance, 2),
                jurisdiction=row["jurisdiction"],
                city=row["city"],
            )
        )

    # Sort by distance and take top 3
    stations_with_distance.sort(key=lambda s: s.distance_km)
    nearest_three = stations_with_distance[:3]

    return NearestStationsResponse(
        stations=nearest_three,
        query_lat=request.lat,
        query_lng=request.lng,
    )


@router.get("/all-stations")
async def get_all_stations():
    """Return all police stations in the database. Used by the app for local caching."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM police_stations")
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "address": row["address"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "phone": row["phone"],
            "jurisdiction": row["jurisdiction"],
            "city": row["city"],
        }
        for row in rows
    ]
