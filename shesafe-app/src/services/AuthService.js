// SheSafe — Auth Service v3
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './ApiService';

const USER_KEY = 'SHESAFE_USER';
const TOKEN_KEY = 'SHESAFE_TOKEN';

export async function register(params) {
  const data = await ApiService.register({
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

  if (!data) throw new Error('Cannot reach the server. Check your internet connection and try again.');
  if (data.error) throw new Error(data.detail || 'Registration failed. Please try again.');
  if (!data.success) throw new Error(data.detail || data.message || 'Registration failed.');

  await _save(data.token, data.user);
  return data;
}

export async function login(params) {
  const data = await ApiService.login({ phone: params.phone, password: params.password });

  if (!data) throw new Error('Cannot reach the server. Check your internet connection.');
  if (data.error) throw new Error(data.detail || 'Login failed. Check your credentials.');
  if (!data.success) throw new Error(data.detail || data.message || 'Login failed.');

  await _save(data.token, data.user);
  return data;
}

export async function verifyPin(phone, pin) {
  if (!phone || !pin) return false;
  const res = await ApiService.verifyPin(phone, pin);
  return res?.valid === true;
}

export async function logout() {
  await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
}

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
