# SheSafe 🛡️

**Passive women safety system** — AI-powered risk scoring, emergency alerts, and real-time location sharing.

---

## Monorepo Structure

```
SHESAFE/
├── backend/          # FastAPI + Supabase — risk engine, alerts, auth
├── shesafe-app/      # React Native (Expo) — the mobile app
└── rikash/           # Advanced sensor module — shake detection, evidence recording, offline maps
```

---

## Backend (`/backend`)

**Stack:** FastAPI · Supabase (PostgreSQL) · Twilio · SQLite (police stations)

### Quick Start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in your credentials
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/ping` | Health check |
| `POST` | `/risk/risk-score` | Compute location risk score |
| `POST` | `/alert/fire` | Fire emergency alert |
| `POST` | `/alert/ping` | Update live location |
| `POST` | `/alert/safe` | Confirm safety |
| `POST` | `/police/nearest-stations` | Find nearby police stations |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key |
| `JWT_SECRET` | ✅ | Secret for signing auth tokens |
| `TWILIO_ACCOUNT_SID` | Optional | Leave empty for demo/simulated SMS |
| `TWILIO_AUTH_TOKEN` | Optional | |
| `TWILIO_PHONE_NUMBER` | Optional | |

---

## Mobile App (`/shesafe-app`)

**Stack:** React Native · Expo · Firebase Auth · AsyncStorage

### Quick Start

```bash
cd shesafe-app
npm install
# Set your backend IP in src/config.js → BACKEND_URL
npx expo start
```

Run on a physical device via **Expo Go** or build an APK:
```bash
eas build --platform android --profile preview
```

### App Architecture

```
src/
├── screens/
│   ├── auth/           # Welcome, Login, Signup, ForgotPassword
│   ├── VictimScreen    # Main protection dashboard
│   ├── PoliceScreen    # Police alert dashboard
│   ├── ContactScreen   # Trusted contact tracking view
│   └── ProfileScreen   # User profile & settings
├── services/
│   ├── ApiService      # HTTP calls to the backend
│   ├── AuthService     # Login/logout + local session
│   ├── SensorService   # Accelerometer + audio monitoring
│   ├── RiskEngine      # Local risk computation fallback
│   └── FirebaseConfig  # Firebase initialisation
└── context/
    └── AuthContext     # Global auth state
```

---

## Deployment

The backend is configured for both **Render** (`render.yaml`) and **Railway** (`backend/railway.json`).

Set the following env vars in your deployment dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
