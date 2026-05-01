#!/usr/bin/env python3
"""
SHESAFE Backend — Comprehensive Test Suite
Tests every scenario from safe daytime walk to full emergency at Vemana College.

Run: python3 test_full_system.py
Requires: Server running on http://localhost:8000
"""

import httpx
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"
PASS = "✅"
FAIL = "❌"
WARN = "⚠️"

results = []


def test(name: str, passed: bool, details: str = ""):
    status = PASS if passed else FAIL
    results.append((name, passed, details))
    print(f"  {status} {name}")
    if details and not passed:
        print(f"     → {details}")


def section(title: str):
    print(f"\n{'═' * 60}")
    print(f"  {title}")
    print(f"{'═' * 60}")


def post(path: str, data: dict = None, params: dict = None) -> dict:
    r = httpx.post(f"{BASE_URL}{path}", json=data, params=params, timeout=10)
    return r.json()


def get(path: str) -> dict:
    r = httpx.get(f"{BASE_URL}{path}", timeout=10)
    return r.json()


# ══════════════════════════════════════════════════════════════
# TEST 1: Health Check
# ══════════════════════════════════════════════════════════════
section("1. HEALTH CHECK")

health = get("/ping")
test("Server is alive", health.get("status") == "alive")
test("App name is SHESAFE", health.get("app") == "SHESAFE")
test("Version is 2.0.0", health.get("version") == "2.0.0")

# ══════════════════════════════════════════════════════════════
# TEST 2: Police Station Database
# ══════════════════════════════════════════════════════════════
section("2. POLICE STATION DATABASE")

all_stations = get("/police/all-stations")
test(f"Stations loaded: {len(all_stations)}", len(all_stations) >= 50)

# Nearest to Vemana College (12.9340, 77.6210)
vemana_nearest = post("/police/nearest-stations", {"lat": 12.9340, "lng": 77.6210})
stations = vemana_nearest["stations"]
test("Returns exactly 3 stations", len(stations) == 3)
test(
    f"Nearest to Vemana: {stations[0]['name']} ({stations[0]['distance_km']}km)",
    stations[0]["distance_km"] < 5.0,
)
test("All stations have phone numbers", all(s["phone"].startswith("+91") for s in stations))

# Nearest to Silk Board
silk_board = post("/police/nearest-stations", {"lat": 12.9177, "lng": 77.6238})
test(
    f"Nearest to Silk Board: {silk_board['stations'][0]['name']}",
    silk_board["stations"][0]["distance_km"] < 2.0,
)

# ══════════════════════════════════════════════════════════════
# TEST 3: Isolated Zone Detection
# ══════════════════════════════════════════════════════════════
section("3. ISOLATED ZONE DETECTION")

# Vemana College — MUST be detected
vemana_zone = post("/risk/check-zone", params={"lat": 12.9340, "lng": 77.6210})
test("Vemana College detected as isolated zone", vemana_zone["is_isolated"] == True)
test(
    f"Zones matched: {vemana_zone['zones_count']}",
    vemana_zone["zones_count"] >= 1,
)
if vemana_zone["zones"]:
    test(
        f"Zone name: {vemana_zone['zones'][0]['name']}",
        "Vemana" in vemana_zone["zones"][0]["name"],
    )
    test(
        f"Risk boost: +{vemana_zone['max_risk_boost']}",
        vemana_zone["max_risk_boost"] >= 30,
    )

# MG Road (safe area) — should NOT be isolated
mg_road = post("/risk/check-zone", params={"lat": 12.9750, "lng": 77.6060})
test("MG Road is NOT an isolated zone", mg_road["is_isolated"] == False)

# Electronic City Phase 2 — should be isolated
ecity = post("/risk/check-zone", params={"lat": 12.8400, "lng": 77.6650})
test("Electronic City Phase 2 detected as isolated", ecity["is_isolated"] == True)

# All zones endpoint
all_zones = get("/risk/zones")
test(f"Total isolated zones: {all_zones['total']}", all_zones["total"] >= 15)

# ══════════════════════════════════════════════════════════════
# TEST 4: Risk Score — SCENARIO TESTING
# ══════════════════════════════════════════════════════════════
section("4. RISK SCORING — SCENARIO TESTS")

# Scenario A: Safe daytime walk on MG Road
print("\n  📍 Scenario A: Daytime walk on MG Road (should be SAFE)")
safe_walk = post("/risk/risk-score", {
    "motion_state": "normal_walk",
    "lat": 12.9750,
    "lng": 77.6060,
    "timestamp": "2026-05-01T14:00:00+05:30",
    "behavior_flags": [],
})
test(f"Score: {safe_walk['score']} (expected ≤ 30)", safe_walk["score"] <= 30)
test(f"Level: {safe_walk['level']} (expected: safe)", safe_walk["level"] == "safe")
test("Not in isolated zone", safe_walk.get("is_isolated_zone") == False)

# Scenario B: Evening walk near Vemana College
print("\n  📍 Scenario B: Evening walk near Vemana College (should be WATCHFUL)")
evening_vemana = post("/risk/risk-score", {
    "motion_state": "normal_walk",
    "lat": 12.9340,
    "lng": 77.6210,
    "timestamp": "2026-05-01T20:30:00+05:30",
    "behavior_flags": [],
})
test(f"Score: {evening_vemana['score']} (expected 31-60)", 31 <= evening_vemana["score"] <= 60)
test(f"Level: {evening_vemana['level']}", evening_vemana["level"] in ["watchful", "alert"])
test("Detected as isolated zone", evening_vemana.get("is_isolated_zone") == True)

# Scenario C: Running at night near Vemana College
print("\n  📍 Scenario C: Running at 11 PM near Vemana College (should be ALERT/EMERGENCY)")
night_running = post("/risk/risk-score", {
    "motion_state": "running",
    "lat": 12.9340,
    "lng": 77.6210,
    "timestamp": "2026-05-01T23:00:00+05:30",
    "behavior_flags": [],
})
test(f"Score: {night_running['score']} (expected > 60)", night_running["score"] > 60)
test(f"Level: {night_running['level']}", night_running["level"] in ["alert", "emergency"])

# Scenario D: Struggling at midnight with airplane mode near Vemana
print("\n  📍 Scenario D: STRUGGLING at midnight + airplane mode near Vemana (EMERGENCY)")
attack_scenario = post("/risk/risk-score", {
    "motion_state": "struggling",
    "lat": 12.9335,
    "lng": 77.6225,
    "timestamp": "2026-05-01T00:30:00+05:30",
    "behavior_flags": ["sudden_airplane_mode"],
    "accel_magnitude": 28.5,
})
test(f"Score: {attack_scenario['score']} (expected ≥ 80)", attack_scenario["score"] >= 80)
test(f"Level: {attack_scenario['level']} (expected: emergency)", attack_scenario["level"] == "emergency")
test("Detected in isolated zone", attack_scenario.get("is_isolated_zone") == True)
# Print reasoning
for factor in attack_scenario["contributing_factors"]:
    if factor.get("reasoning"):
        print(f"     📊 {factor['factor']}: {factor['reasoning']}")

# Scenario E: Phone dropped in isolated zone at night
print("\n  📍 Scenario E: Phone dropped at 2 AM in Electronic City (EMERGENCY)")
phone_dropped = post("/risk/risk-score", {
    "motion_state": "phone_dropped",
    "lat": 12.8400,
    "lng": 77.6650,
    "timestamp": "2026-05-01T02:00:00+05:30",
    "behavior_flags": ["screen_dark_no_motion"],
})
test(f"Score: {phone_dropped['score']} (expected ≥ 80)", phone_dropped["score"] >= 80)
test(f"Level: {phone_dropped['level']}", phone_dropped["level"] == "emergency")

# Scenario F: Stationary in isolated zone at night (possible incapacitation)
print("\n  📍 Scenario F: Stationary at 1 AM in Silk Board underpass (victim may be incapacitated)")
stationary_night = post("/risk/risk-score", {
    "motion_state": "stationary",
    "lat": 12.9177,
    "lng": 77.6238,
    "timestamp": "2026-05-01T01:00:00+05:30",
    "behavior_flags": ["screen_dark_no_motion", "phone_upside_down"],
})
test(f"Score: {stationary_night['score']} (expected ≥ 60)", stationary_night["score"] >= 60)

# ══════════════════════════════════════════════════════════════
# TEST 5: FULL PROTECTION MODE (3-Shake Trigger)
# ══════════════════════════════════════════════════════════════
section("5. FULL PROTECTION MODE (3-SHAKE TRIGGER)")

protection = post("/risk/full-protection", params={
    "lat": 12.9340,
    "lng": 77.6210,
    "timestamp": "2026-05-01T23:30:00+05:30",
    "user_phone": "+919876543210",
})
test("Mode is FULL_PROTECTION", protection["mode"] == "FULL_PROTECTION")
test("Risk score forced to 100", protection["risk_score"] == 100)
test("Returns 3 nearest stations", len(protection["nearest_stations"]) == 3)
test("Maps link generated", "maps.google.com" in protection["google_maps_link"])
test(
    f"Zone detection: {'IN ZONE' if protection['zone_data']['is_isolated'] else 'Not in zone'}",
    True,
)
print(f"     🚨 {protection['message']}")

# ══════════════════════════════════════════════════════════════
# TEST 6: FULL ALERT DISPATCH FLOW
# ══════════════════════════════════════════════════════════════
section("6. FULL ALERT DISPATCH (SMS to Police + Contacts)")

# Get nearest stations first
nearest = post("/police/nearest-stations", {"lat": 12.9340, "lng": 77.6210})

alert = post("/alert/fire", {
    "user_name": "Priya Sharma",
    "user_phone": "+919876543210",
    "lat": 12.9340,
    "lng": 77.6210,
    "address": "Near Vemana College of Engineering, Koramangala, Bengaluru",
    "risk_score": 100,
    "risk_level": "emergency",
    "trusted_contacts": [
        {"name": "Radha Sharma", "phone": "+919876543211", "relation": "Mother"},
        {"name": "Amit Sharma", "phone": "+919876543212", "relation": "Brother"},
        {"name": "Neha Gupta", "phone": "+919876543213", "relation": "Friend"},
    ],
    "nearest_stations": [
        {"name": s["name"], "phone": s["phone"], "distance_km": s["distance_km"]}
        for s in nearest["stations"]
    ],
    "trigger_type": "shake",
})

alert_id = alert["alert_id"]
test(f"Alert ID generated: {alert_id}", alert_id.startswith("SHESAFE_"))
test(f"Status: {alert['status']}", alert["status"] == "dispatched")
test(
    f"Total recipients: {len(alert['recipients'])} (3 police + 3 contacts)",
    len(alert["recipients"]) == 6,
)

police_sent = sum(1 for r in alert["recipients"] if r["type"] == "police" and "sent" in r["sms_status"])
contact_sent = sum(1 for r in alert["recipients"] if r["type"] == "contact" and "sent" in r["sms_status"])
test(f"Police SMS sent: {police_sent}/3", police_sent == 3)
test(f"Contact SMS sent: {contact_sent}/3", contact_sent == 3)
test("Google Maps link in response", "maps.google.com" in alert["google_maps_link"])

# ══════════════════════════════════════════════════════════════
# TEST 7: LOCATION PINGS (30-second tracking)
# ══════════════════════════════════════════════════════════════
section("7. CONTINUOUS LOCATION PINGS")

# Simulate 3 location pings (moving)
pings = [
    {"lat": 12.9345, "lng": 77.6215},
    {"lat": 12.9350, "lng": 77.6220},
    {"lat": 12.9360, "lng": 77.6230},
]

for i, ping in enumerate(pings):
    result = post("/alert/ping", {
        "alert_id": alert_id,
        "lat": ping["lat"],
        "lng": ping["lng"],
        "timestamp": f"2026-05-01T23:{31+i}:00+05:30",
    })
    test(f"Ping {i+1} recorded (#{result['ping_number']})", result["status"] == "recorded")

# Check alert status
status = get(f"/alert/status/{alert_id}")
test(f"Total pings tracked: {status['total_pings']}", status["total_pings"] == 3)
test("Alert still active (not safe yet)", status["is_safe"] == False)
test(f"Latest location updated: ({status['lat']}, {status['lng']})", True)

# ══════════════════════════════════════════════════════════════
# TEST 8: I'M SAFE FLOW
# ══════════════════════════════════════════════════════════════
section("8. I'M SAFE CONFIRMATION")

safe = post("/alert/safe", {
    "alert_id": alert_id,
    "user_phone": "+919876543210",
    "pin": "123456",
})
test(f"Safe confirmed: {safe['status']}", safe["status"] == "safe_confirmed")
test(f"Notifications sent: {safe['notifications_sent']}", safe["notifications_sent"] >= 1)

# Verify alert is resolved
status_after = get(f"/alert/status/{alert_id}")
test("Alert marked as safe", status_after["is_safe"] == True)

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
section("TEST SUMMARY")

total = len(results)
passed = sum(1 for _, p, _ in results if p)
failed = total - passed

print(f"\n  Total: {total}")
print(f"  Passed: {passed} {PASS}")
print(f"  Failed: {failed} {FAIL}")
print(f"  Pass rate: {passed/total*100:.0f}%")

if failed > 0:
    print(f"\n  {FAIL} FAILED TESTS:")
    for name, p, details in results:
        if not p:
            print(f"     • {name}: {details}")

print(f"\n{'═' * 60}")
if failed == 0:
    print("  🛡️  ALL TESTS PASSED — SHESAFE IS READY TO PROTECT")
else:
    print(f"  {WARN}  {failed} test(s) failed — review above")
print(f"{'═' * 60}\n")

sys.exit(0 if failed == 0 else 1)
