// SheSafe — API Configuration
// Change BACKEND_URL to your server's IP when testing on physical device
// Use your computer's local IP (not localhost) since the phone is a different device

// TO FIND YOUR IP: Open Terminal → type 'ifconfig | grep inet' → use the 192.168.x.x address
const BACKEND_URL = 'http://192.168.1.100:8000'; // ← CHANGE THIS TO YOUR COMPUTER'S IP

export default {
  BACKEND_URL,
  
  // API Endpoints
  RISK_SCORE: `${BACKEND_URL}/risk/risk-score`,
  FULL_PROTECTION: `${BACKEND_URL}/risk/full-protection`,
  CHECK_ZONE: `${BACKEND_URL}/risk/check-zone`,
  ZONES: `${BACKEND_URL}/risk/zones`,
  NEAREST_STATIONS: `${BACKEND_URL}/police/nearest-stations`,
  ALL_STATIONS: `${BACKEND_URL}/police/all-stations`,
  ALERT_FIRE: `${BACKEND_URL}/alert/fire`,
  ALERT_PING: `${BACKEND_URL}/alert/ping`,
  ALERT_SAFE: `${BACKEND_URL}/alert/safe`,
  ALERT_STATUS: `${BACKEND_URL}/alert/status`,
  PING: `${BACKEND_URL}/ping`,

  // Demo user config
  DEMO_USER: {
    name: 'Priya Sharma',
    phone: '+919876543210',
  },

  TRUSTED_CONTACTS: [
    { name: 'Radha Sharma', phone: '+919876543211', relation: 'Mother' },
    { name: 'Amit Sharma', phone: '+919876543212', relation: 'Brother' },
  ],

  // Vemana College coordinates (demo zone)
  DEMO_ZONE: {
    lat: 12.9340,
    lng: 77.6210,
    name: 'Vemana College of Engineering, Koramangala',
  },

  // Risk level thresholds
  RISK_LEVELS: {
    SAFE: { min: 0, max: 30, color: '#22c55e', label: 'Safe' },
    WATCHFUL: { min: 31, max: 60, color: '#f59e0b', label: 'Watchful' },
    ALERT: { min: 61, max: 80, color: '#f97316', label: 'Alert' },
    EMERGENCY: { min: 81, max: 100, color: '#ef4444', label: 'Emergency' },
  },
};
