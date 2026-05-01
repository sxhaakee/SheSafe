// SheSafe — Auth Service v4 (Offline-First)
// Registration and login work 100% locally on the device.
// No backend dependency for auth — eliminating all network issues.
import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = 'SHESAFE_USERS';   // all registered users
const USER_KEY = 'SHESAFE_USER';     // currently logged in user
const TOKEN_KEY = 'SHESAFE_TOKEN';   // current session token

// ── Get all registered users from local storage ──
async function _getAllUsers() {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function _saveAllUsers(users) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Register ──
export async function register(params) {
  const { name, phone, email, password, role, pin } = params;

  if (!name || !phone || !email || !password || !role) {
    throw new Error('Please fill in all required fields.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  if (role === 'victim' && (!pin || pin.length !== 4)) {
    throw new Error('Please set a 4-digit safety PIN.');
  }

  const users = await _getAllUsers();

  if (users[phone]) {
    throw new Error('This phone number is already registered. Try signing in.');
  }

  const user = {
    name,
    phone,
    email,
    role,
    password, // stored locally only — acceptable for hackathon demo
    pin: pin || '',
    emergencyContacts: params.emergencyContacts || [],
    badgeNumber: params.badgeNumber || '',
    stationName: params.stationName || '',
    victimPhone: params.victimPhone || '',
    relationship: params.relationship || '',
    createdAt: new Date().toISOString(),
  };

  users[phone] = user;
  await _saveAllUsers(users);

  const token = `local-token-${Date.now()}`;
  const safeUser = { name, phone, email, role };
  await _save(token, safeUser);

  // Try to sync to backend in background (non-blocking)
  _syncToBackend(params).catch(() => {});

  return { success: true, token, user: safeUser };
}

// ── Login ──
export async function login(params) {
  const { phone, password } = params;

  if (!phone || !password) {
    throw new Error('Please enter your phone number and password.');
  }

  const users = await _getAllUsers();
  const user = users[phone];

  if (!user) {
    throw new Error('Phone number not registered. Please sign up first.');
  }

  if (user.password !== password) {
    throw new Error('Incorrect password. Please try again.');
  }

  const token = `local-token-${Date.now()}`;
  const safeUser = { name: user.name, phone: user.phone, email: user.email, role: user.role };
  await _save(token, safeUser);

  return { success: true, token, user: safeUser };
}

// ── Verify PIN ──
export async function verifyPin(phone, pin) {
  if (!phone || !pin) return false;
  const users = await _getAllUsers();
  const user = users[phone];
  if (!user) return false;
  return user.pin === pin;
}

// ── Logout ──
export async function logout() {
  await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
}

// ── Session helpers ──
async function _save(token, user) {
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

// ── Background sync to backend (best-effort, non-blocking) ──
async function _syncToBackend(params) {
  try {
    const ApiService = require('./ApiService').default;
    await ApiService.register({
      name: params.name,
      phone: params.phone,
      email: params.email,
      password: params.password,
      role: params.role,
      pin: params.pin || '',
      emergency_contacts: params.emergencyContacts || [],
      badge_number: params.badgeNumber || '',
      station_name: params.stationName || '',
      victim_phone: params.victimPhone || '',
      relationship: params.relationship || '',
    });
  } catch {
    // Silently ignore — local auth is the primary source of truth
  }
}
