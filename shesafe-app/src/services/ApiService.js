// SheSafe — API Service v3
// Single source of truth for backend URL. No AsyncStorage caching to avoid stale URL bugs.

const BASE_URL = 'https://shesafe-cqp5.onrender.com';
const TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function get(path) {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: true, status: res.status, detail: err.detail || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (e) {
    console.warn('[API] GET', path, e.message);
    return null;
  }
}

async function post(path, body) {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: true, status: res.status, detail: err.detail || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (e) {
    console.warn('[API] POST', path, e.message);
    return null;
  }
}

const ApiService = {
  BASE_URL,

  // Health check
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
  updateProfile: (body) => post('/auth/update-profile', body),
  resetPassword: (body) => post('/auth/reset-password', body),
};

export default ApiService;
