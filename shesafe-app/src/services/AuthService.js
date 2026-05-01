// SheSafe — AuthService v5
// PRIMARY: Calls backend API (Render + Supabase) for real persistence
// FALLBACK: AsyncStorage for offline resilience
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND = 'https://shesafe-cqp5.onrender.com';
const USER_KEY = 'SHESAFE_USER';
const TOKEN_KEY = 'SHESAFE_TOKEN';

// ── Session helpers ────────────────────────────────────────────────────────

async function _saveSession(token, user) {
  await AsyncStorage.setItem(TOKEN_KEY, token || '');
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function getStoredToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function isAuthenticated() {
  return (await getStoredUser()) !== null;
}

export async function logout() {
  await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
}

// ── API helper ────────────────────────────────────────────────────────────

async function _apiFetch(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Check your internet connection.');
    throw err;
  }
}

// ── Register ───────────────────────────────────────────────────────────────

export async function register(params) {
  const { name, phone, email, password, role, pin,
          emergencyContacts, badgeNumber, stationName, victimPhone, relationship } = params;

  // Client-side validation
  if (!name?.trim() || !phone?.trim() || !email?.trim() || !password?.trim() || !role) {
    throw new Error('Please fill in all required fields.');
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (role === 'victim' && (!pin || pin.length !== 4)) throw new Error('Please set a 4-digit safety PIN.');

  // Call backend (primary)
  const data = await _apiFetch('/auth/register', {
    name: name.trim(), phone: phone.trim(), email: email.trim(),
    password, role, pin: pin || '',
    emergency_contacts: emergencyContacts || [],
    badge_number: badgeNumber || '',
    station_name: stationName || '',
    victim_phone: victimPhone || '',
    relationship: relationship || '',
  });

  await _saveSession(data.token, data.user);
  return data;
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function login(params) {
  const { phone, password } = params;

  if (!phone?.trim() || !password?.trim()) {
    throw new Error('Please enter your phone number and password.');
  }

  // Call backend (source of truth)
  const data = await _apiFetch('/auth/login', {
    phone: phone.trim(), password,
  });

  await _saveSession(data.token, data.user);
  return data;
}

// ── Verify PIN ─────────────────────────────────────────────────────────────

export async function verifyPin(phone, pin) {
  try {
    const data = await _apiFetch('/auth/verify-pin', { phone, pin });
    return data.valid === true;
  } catch { return false; }
}
