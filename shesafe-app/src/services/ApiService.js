// SheSafe — API Service v2
// Unified service for all backend calls. Falls back gracefully offline.
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_URL = 'https://shesafe-production-8085.up.railway.app';
const URL_KEY = 'SHESAFE_BACKEND_URL';

let _baseUrl = null;

async function baseUrl() {
  if (_baseUrl) return _baseUrl;
  _baseUrl = (await AsyncStorage.getItem(URL_KEY)) || DEFAULT_URL;
  return _baseUrl;
}

export async function setBackendUrl(url) {
  _baseUrl = url;
  await AsyncStorage.setItem(URL_KEY, url);
}

async function get(path) {
  try {
    const res = await fetch(`${await baseUrl()}${path}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return await res.json();
  } catch (e) {
    console.warn('[API] GET', path, e.message);
    return null;
  }
}

async function post(path, body) {
  try {
    const res = await fetch(`${await baseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e) {
    console.warn('[API] POST', path, e.message);
    return null;
  }
}

const ApiService = {
  // Health check — returns { active_alerts: [], status: 'alive' }
  ping: () => get('/ping'),

  // Fire full emergency alert
  fireAlert: (body) => post('/alert/fire', body),

  // Send location ping during active alert
  sendPing: (alertId, lat, lng) => post('/alert/ping', {
    alert_id: alertId, lat, lng,
    timestamp: new Date().toISOString(),
  }),

  // Confirm I'm Safe
  confirmSafe: (alertId) => post('/alert/safe', { alert_id: alertId }),

  // Get alert status + location pings
  getAlertStatus: (alertId) => get(`/alert/status/${alertId}`),

  // Get 3 nearest police stations
  getNearestStations: (lat, lng) => post('/police/nearest-stations', { lat, lng }),

  // Compute risk score from backend
  computeRiskScore: (data) => post('/risk/risk-score', data),

  // Auth
  register: (body) => post('/auth/register', body),
  login: (body) => post('/auth/login', body),
  verifyPin: (phone, pin) => post('/auth/verify-pin', { phone, pin }),
};

export default ApiService;
