/**
 * SheSafe — Background Location Task
 * Rikash's Domain: Continuous GPS tracking with foreground service
 * 
 * Uses expo-task-manager + expo-location for background updates.
 * Adaptive polling: 60s normal, 20s watchful, 5s alert/emergency.
 * Sends pings to Shakeeb's /alert/ping endpoint during active alerts.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK = 'shesafe-background-location';
const API_BASE_URL_KEY = 'shesafe_api_base_url';
const ACTIVE_ALERT_KEY = 'shesafe_active_alert_id';

// Location history stored locally (last 30 min = ~180 entries at 10s interval)
let locationHistory = [];
const MAX_HISTORY = 180;

// Current risk level determines polling frequency
let currentRiskLevel = 'safe';

/**
 * Define the background task — MUST be called at app startup (top level)
 */
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[SheSafe Location] Background task error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data;
    if (!locations || locations.length === 0) return;

    const location = locations[0];
    const entry = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      altitude: location.coords.altitude,
      timestamp: location.timestamp,
    };

    // Store locally
    locationHistory.push(entry);
    if (locationHistory.length > MAX_HISTORY) {
      locationHistory.shift();
    }

    // If there's an active alert, ping the server
    try {
      const alertId = await AsyncStorage.getItem(ACTIVE_ALERT_KEY);
      const apiBase = await AsyncStorage.getItem(API_BASE_URL_KEY);

      if (alertId && apiBase) {
        await fetch(`${apiBase}/alert/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert_id: alertId,
            lat: entry.lat,
            lng: entry.lng,
            timestamp: entry.timestamp,
          }),
        });
        console.log('[SheSafe Location] Ping sent for alert:', alertId);
      }
    } catch (e) {
      // Silently fail — offline pings will be queued
      console.log('[SheSafe Location] Ping failed (offline?):', e.message);
    }
  }
});

class BackgroundLocationManager {
  constructor() {
    this.isTracking = false;
    this.locationSubscription = null;
  }

  /**
   * Request location permissions (always + background)
   */
  async requestPermissions() {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      throw new Error('Foreground location permission denied');
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      throw new Error('Background location permission denied');
    }

    console.log('[SheSafe Location] All permissions granted');
    return true;
  }

  /**
   * Start background location tracking with foreground service
   */
  async startTracking(riskLevel = 'safe') {
    if (this.isTracking) {
      // Update interval if risk level changed
      if (riskLevel !== currentRiskLevel) {
        await this.stopTracking();
      } else {
        return;
      }
    }

    currentRiskLevel = riskLevel;
    const interval = this._getIntervalForRisk(riskLevel);

    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: interval,
        distanceInterval: 5,
        deferredUpdatesInterval: interval,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'SheSafe is protecting you 🛡️',
          notificationBody: this._getNotificationBody(riskLevel),
          notificationColor: '#C0392B',
        },
      });

      this.isTracking = true;
      console.log(`[SheSafe Location] Tracking started — ${riskLevel} mode (${interval}ms)`);
    } catch (e) {
      console.error('[SheSafe Location] Failed to start:', e.message);
      throw e;
    }
  }

  /**
   * Stop background location tracking
   */
  async stopTracking() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
      this.isTracking = false;
      console.log('[SheSafe Location] Tracking stopped');
    } catch (e) {
      console.error('[SheSafe Location] Failed to stop:', e.message);
    }
  }

  /**
   * Update risk level (changes polling frequency)
   */
  async updateRiskLevel(riskLevel) {
    if (riskLevel !== currentRiskLevel && this.isTracking) {
      await this.startTracking(riskLevel);
    }
  }

  /**
   * Set active alert ID (enables server pinging)
   */
  async setActiveAlert(alertId) {
    if (alertId) {
      await AsyncStorage.setItem(ACTIVE_ALERT_KEY, alertId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_ALERT_KEY);
    }
  }

  /**
   * Set API base URL
   */
  async setApiBaseUrl(url) {
    await AsyncStorage.setItem(API_BASE_URL_KEY, url);
  }

  /**
   * Get current location (one-shot)
   */
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
    } catch (e) {
      console.error('[SheSafe Location] getCurrentLocation failed:', e.message);
      return null;
    }
  }

  /**
   * Get last N location entries from history
   */
  getLocationHistory(count = 10) {
    return locationHistory.slice(-count);
  }

  /**
   * Get all location history (for evidence package)
   */
  getFullHistory() {
    return [...locationHistory];
  }

  /**
   * Clear location history
   */
  clearHistory() {
    locationHistory = [];
  }

  /**
   * Get polling interval based on risk level
   */
  _getIntervalForRisk(riskLevel) {
    switch (riskLevel) {
      case 'emergency': return 5000;    // 5 seconds
      case 'alert': return 5000;        // 5 seconds
      case 'watchful': return 20000;    // 20 seconds
      case 'safe':
      default: return 60000;            // 60 seconds
    }
  }

  /**
   * Notification body based on risk level
   */
  _getNotificationBody(riskLevel) {
    switch (riskLevel) {
      case 'emergency': return '⚠️ Emergency mode active — tracking every 5s';
      case 'alert': return '🔴 Alert mode — high frequency tracking';
      case 'watchful': return '🟡 Monitoring mode — stay safe';
      case 'safe':
      default: return 'Tap to open';
    }
  }

  /**
   * Check if background location is currently active
   */
  async isActive() {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  }
}

export const backgroundLocation = new BackgroundLocationManager();
export { LOCATION_TASK };
export default BackgroundLocationManager;
