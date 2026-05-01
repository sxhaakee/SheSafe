/**
 * SheSafe — API Service
 * Communicates with the FastAPI backend for risk scoring, alerts, and police stations.
 */
import config from '../config';

class ApiService {
  constructor() {
    this.isConnected = false;
  }

  async _post(url, data = null, params = null) {
    try {
      let fullUrl = url;
      if (params) {
        const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        fullUrl += `?${qs}`;
      }
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
      return await res.json();
    } catch (err) {
      console.warn(`[API] POST ${url} failed:`, err.message);
      return null;
    }
  }

  async _get(url) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.warn(`[API] GET ${url} failed:`, err.message);
      return null;
    }
  }

  // Health check
  async ping() {
    const result = await this._get(config.PING);
    this.isConnected = !!result;
    return result;
  }

  // Risk score computation
  async computeRiskScore(sensorReport, location, behaviorFlags = []) {
    return this._post(config.RISK_SCORE, {
      motion_state: sensorReport.motion_state,
      lat: location.lat,
      lng: location.lng,
      timestamp: sensorReport.timestamp,
      behavior_flags: behaviorFlags,
      accel_magnitude: sensorReport.accel_magnitude,
    });
  }

  // Full protection mode (3-shake trigger)
  async activateFullProtection(location) {
    return this._post(config.FULL_PROTECTION, null, {
      lat: location.lat,
      lng: location.lng,
      timestamp: new Date().toISOString(),
      user_phone: config.DEMO_USER.phone,
    });
  }

  // Check if location is in isolated zone
  async checkZone(lat, lng) {
    return this._post(config.CHECK_ZONE, null, { lat, lng });
  }

  // Get all isolated zones
  async getZones() {
    return this._get(config.ZONES);
  }

  // Get nearest police stations
  async getNearestStations(lat, lng) {
    return this._post(config.NEAREST_STATIONS, { lat, lng });
  }

  // Fire alert
  async fireAlert(location, riskScore, nearestStations, triggerType = 'passive') {
    return this._post(config.ALERT_FIRE, {
      user_name: config.DEMO_USER.name,
      user_phone: config.DEMO_USER.phone,
      lat: location.lat,
      lng: location.lng,
      address: location.address || `${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°E`,
      risk_score: riskScore,
      risk_level: riskScore > 80 ? 'emergency' : riskScore > 60 ? 'alert' : 'watchful',
      trusted_contacts: config.TRUSTED_CONTACTS,
      nearest_stations: nearestStations.map(s => ({
        name: s.name,
        phone: s.phone,
        distance_km: s.distance_km,
      })),
      trigger_type: triggerType,
    });
  }

  // Send location ping during active alert
  async sendPing(alertId, lat, lng) {
    return this._post(config.ALERT_PING, {
      alert_id: alertId,
      lat, lng,
      timestamp: new Date().toISOString(),
    });
  }

  // Confirm I'm Safe
  async confirmSafe(alertId) {
    return this._post(config.ALERT_SAFE, {
      alert_id: alertId,
      user_phone: config.DEMO_USER.phone,
      pin: '123456',
    });
  }

  // Get alert status
  async getAlertStatus(alertId) {
    return this._get(`${config.ALERT_STATUS}/${alertId}`);
  }

  // Get all stations (for offline cache)
  async getAllStations() {
    return this._get(config.ALL_STATIONS);
  }
}

export const apiService = new ApiService();
export default ApiService;
