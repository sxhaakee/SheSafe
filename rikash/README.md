# SheSafe — Rikash's Domain (Nervous System)

> Sensors, device integrations, data pipelines, background tasks, police station database, trusted contact dashboard.

---

## 📁 Directory Structure

```
rikash/
├── index.js                    # Barrel export — single import point
├── SheSafeOrchestrator.js      # Master orchestrator (glue layer)
│
├── sensors/
│   └── SensorManager.js        # Accelerometer + Gyroscope at 50Hz
│
├── gestures/
│   └── ShakeDetector.js         # Shake gesture → 3 shakes in 2s = trigger
│
├── location/
│   └── BackgroundLocationManager.js  # GPS tracking + foreground service
│
├── network/
│   └── NetworkManager.js        # Online/offline + SMS fallback + API dispatch
│
├── evidence/
│   └── EvidenceRecorder.js      # Silent audio recording + upload
│
├── maps/
│   └── OfflineMapManager.js     # Tile pre-caching for offline maps
│
├── data/
│   ├── police_stations.json     # 55 Karnataka stations (app fallback)
│   ├── police_stations.db       # SQLite DB (give to Shakeeb)
│   └── create_db.py             # Script to regenerate the DB
│
└── dashboard/                   # Trusted Contact Dashboard (Next.js)
    ├── pages/
    │   ├── index.js
    │   └── dashboard/[alert_id].js   # Real-time alert tracking page
    ├── lib/firebase.js
    ├── styles/globals.css
    ├── .env.example
    ├── next.config.js
    └── package.json
```

---

## 🔌 For Shakira (Frontend Integration)

### Quick Start — One Import

```javascript
import {
  sensorManager,
  shakeDetector,
  backgroundLocation,
  networkManager,
  evidenceRecorder,
  offlineMapManager,
  SheSafeOrchestrator,
} from '../rikash';
import orchestrator from '../rikash/SheSafeOrchestrator';
```

### Initialize Everything in App.js

```javascript
// Call ONCE at app startup, after onboarding is complete
await orchestrator.initialize({
  apiBaseUrl: 'https://shesafe-api.railway.app',  // Shakeeb's URL
  shakeSensitivity: 'MEDIUM',  // LOW | MEDIUM | HIGH
});

// Save user profile (from onboarding screen)
await orchestrator.saveProfile({
  name: 'Priya Sharma',
  phone: '+919876543210',
  trusted_contacts: [
    { name: 'Mom', phone: '+919876543211' },
    { name: 'Anita', phone: '+919876543212' },
  ],
});
```

### Hook into UI Callbacks

```javascript
// Risk score updates (every 10 seconds)
orchestrator.onRiskUpdate = (score, level, factors) => {
  // score: 0-100
  // level: 'safe' | 'watchful' | 'alert' | 'emergency'
  // factors: ['running', 'late_night', ...]
  setRiskScore(score);
  setRiskLevel(level);
};

// Shake trigger detected
orchestrator.onShakeTrigger = (data) => {
  // Navigate to countdown screen
  navigation.navigate('AlertCountdown');
};

// Alert dispatched results
orchestrator.onAlertDispatched = (result) => {
  // result.alertId, result.results, result.nearestStations
  navigation.navigate('AlertFired', { data: result });
};

// Network status changes
orchestrator.onNetworkChange = (status) => {
  // status.isConnected, status.type
  setIsOnline(status.isConnected);
};

// Evidence recording status
orchestrator.onRecordingStatus = (status) => {
  // status.isRecording, status.durationMs
  setRecordingActive(status.isRecording);
};
```

### When Countdown Hits Zero

```javascript
// In your AlertCountdown screen, when timer reaches 0:
const result = await orchestrator.fireAlert();
// result = { alertId, results: { sms_police, sms_contacts, api_success } }
```

### When User Presses "I'm Safe"

```javascript
await orchestrator.confirmSafe();
```

### Shake Sensitivity (Settings Screen)

```javascript
orchestrator.updateShakeSensitivity('HIGH'); // LOW | MEDIUM | HIGH
```

---

## 🔌 For Shakeeb (Backend Integration)

### Police Station Database

The SQLite file is at: `rikash/data/police_stations.db`

```sql
-- Table schema
CREATE TABLE police_stations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    phone TEXT NOT NULL,
    jurisdiction TEXT
);

-- Index for spatial queries
CREATE INDEX idx_lat_lng ON police_stations (lat, lng);

-- 55 stations across Karnataka
-- Bengaluru (38), Mysuru (4), Mangaluru (2), Hubli-Dharwad (2),
-- Belgaum (1), Gulbarga (1), Shimoga (1), Davangere (1),
-- Tumkur (1), Raichur (1), Bijapur (1), Bellary (1), Silk Board (1)
```

### API Contracts I'm Calling

**1. Risk Score** — called every 10 seconds
```
POST /risk-score
Body: {
  "motion_state": "Normal Walk" | "Running" | "Struggling" | "Stationary" | "Phone-Dropped",
  "lat": 12.9716,
  "lng": 77.5946,
  "timestamp": "2026-05-01T23:47:00+05:30",
  "time_of_day": "late_night" | "evening" | "early_morning" | "day",
  "behavior_flags": ["struggling", "phone_dropped"]
}
Response: {
  "score": 73,
  "level": "alert",
  "contributing_factors": ["running", "late_night", "isolated_zone"]
}
```

**2. Nearest Stations** — called when alert fires
```
POST /nearest-stations
Body: { "lat": 12.9716, "lng": 77.5946 }
Response: [
  { "name": "Silk Board PS", "address": "...", "phone": "+91...", "distance_km": 1.2 },
  { "name": "Madiwala PS", "address": "...", "phone": "+91...", "distance_km": 2.1 },
  { "name": "Koramangala PS", "address": "...", "phone": "+91...", "distance_km": 2.8 }
]
```

**3. Alert Dispatch** — called when countdown hits 0
```
POST /alert/fire
Body: {
  "user_name": "Priya Sharma",
  "user_phone": "+919876543210",
  "lat": 12.9716,
  "lng": 77.5946,
  "address": "Near Silk Board, Bengaluru",
  "risk_level": "emergency",
  "trusted_contacts": [{"name": "Mom", "phone": "+91..."}],
  "nearest_stations": [{"name": "...", "phone": "...", "address": "..."}],
  "evidence_url": "https://...",
  "risk_score": 85
}
```

**4. Location Ping** — every 30 seconds during active alert
```
POST /alert/ping
Body: {
  "alert_id": "alert_1714581120000",
  "lat": 12.9720,
  "lng": 77.5950,
  "timestamp": 1714581150000
}
```

**5. I'm Safe** — when user confirms safety
```
POST /alert/safe
Body: {
  "user_name": "Priya Sharma",
  "user_phone": "+919876543210",
  "timestamp": "2026-05-01T23:55:00+05:30"
}
```

### Firebase Collections Expected

```
Firestore:
  alerts/{alert_id}
    - user_name, user_phone, lat, lng, address
    - risk_level, risk_score, timestamp
    - evidence_url, status ("active" | "resolved")

  alerts/{alert_id}/pings/{ping_id}
    - lat, lng, timestamp

  users/{user_id}
    - name, phone, trusted_contacts[], pin_hash
```

---

## 🌐 Dashboard Deployment (Vercel)

```bash
cd rikash/dashboard

# 1. Copy env file and fill in Firebase credentials
cp .env.example .env.local

# 2. Test locally
npm run dev

# 3. Deploy to Vercel
npx vercel --prod
```

The dashboard URL is included in alert SMS messages:
```
https://shesafe-dashboard.vercel.app/dashboard/alert_1714581120000
```

No login needed — the alert_id in the URL acts as a secure token.

---

## 🏗️ Module Details

| Module | File | What It Does |
|--------|------|-------------|
| **SensorManager** | `sensors/SensorManager.js` | 50Hz accelerometer + gyroscope, classifies 5 motion states |
| **ShakeDetector** | `gestures/ShakeDetector.js` | 3 shakes in 2s = trigger, configurable sensitivity |
| **BackgroundLocation** | `location/BackgroundLocationManager.js` | GPS tracking with foreground service, adaptive polling |
| **NetworkManager** | `network/NetworkManager.js` | Always-SMS + API-when-online dual coverage |
| **EvidenceRecorder** | `evidence/EvidenceRecorder.js` | Silent audio, starts at risk>60, uploads on alert |
| **OfflineMapManager** | `maps/OfflineMapManager.js` | Pre-cache tiles during onboarding |
| **Orchestrator** | `SheSafeOrchestrator.js` | Wires everything together, single entry point |
| **Dashboard** | `dashboard/` | Next.js real-time tracking page for trusted contacts |
| **Police Data** | `data/` | 55 Karnataka stations as JSON + SQLite |

---

## ⚡ Key Design Decisions

1. **SMS is non-negotiable** — NetworkManager ALWAYS sends native SMS regardless of API success
2. **Offline-first scoring** — SheSafeOrchestrator has a local risk formula when API is unreachable
3. **Offline queue** — API calls queued when offline, auto-flushed when connectivity returns
4. **Adaptive polling** — Location interval changes: 60s (safe) → 20s (watchful) → 5s (emergency)
5. **Evidence starts early** — Recording begins at risk score 60, not at alert fire
6. **Cooldown on shake** — 5-second cooldown after trigger prevents accidental double-fires
7. **Haversine fallback** — Local nearest-station calculation when API is unreachable

---

## 🔥 Integration Checkpoints

- [ ] **Hour 6**: Shakeeb's `/alert/fire` API live and tested
- [ ] **Hour 10**: Shake trigger → API call → SMS received on test phone
- [ ] **Hour 14**: Full flow end-to-end on at least one phone
- [ ] **Hour 20**: All phones tested, dashboard live on Vercel
