/**
 * SheSafe — Orchestrator
 * Rikash's Domain: Glue layer that coordinates all modules
 * 
 * This is the main entry point Shakira calls from App.js.
 * It wires sensors → risk scoring → location → alerts together.
 */

import { sensorManager, MOTION_STATES } from './sensors/SensorManager';
import { shakeDetector } from './gestures/ShakeDetector';
import { backgroundLocation } from './location/BackgroundLocationManager';
import { networkManager } from './network/NetworkManager';
import { evidenceRecorder } from './evidence/EvidenceRecorder';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_KEY = 'shesafe_api_base_url';
const USER_PROFILE_KEY = 'shesafe_user_profile';

class SheSafeOrchestrator {
  constructor() {
    this.isInitialized = false;
    this.currentRiskScore = 0;
    this.currentRiskLevel = 'safe';
    this.riskUpdateInterval = null;
    this.apiBaseUrl = null;

    // Callbacks for Shakira's UI
    this.onRiskUpdate = null;        // (score, level, factors) => void
    this.onShakeTrigger = null;      // (data) => void
    this.onAlertDispatched = null;   // (results) => void
    this.onNetworkChange = null;     // (status) => void
    this.onRecordingStatus = null;   // (status) => void
  }

  /**
   * Initialize all systems — call once at app startup
   */
  async initialize(config = {}) {
    if (this.isInitialized) return;

    const {
      apiBaseUrl = 'https://shesafe-api.railway.app',
      shakeSensitivity = 'MEDIUM',
    } = config;

    this.apiBaseUrl = apiBaseUrl;
    await AsyncStorage.setItem(API_BASE_KEY, apiBaseUrl);

    // 1. Start network monitoring
    networkManager.startMonitoring((status) => {
      if (this.onNetworkChange) this.onNetworkChange(status);
    });

    // 2. Request permissions & start location
    try {
      await backgroundLocation.requestPermissions();
      await backgroundLocation.setApiBaseUrl(apiBaseUrl);
      await backgroundLocation.startTracking('safe');
    } catch (e) {
      console.warn('[SheSafe Orchestrator] Location permission issue:', e.message);
    }

    // 3. Start sensor data collection
    sensorManager.start((motionReport) => {
      this._onMotionUpdate(motionReport);
    });

    // 4. Start shake detection
    shakeDetector.start((shakeData) => {
      this._onShakeDetected(shakeData);
    }, shakeSensitivity);

    // 5. Set up evidence recorder status callback
    evidenceRecorder.onRecordingStatusUpdate = (status) => {
      if (this.onRecordingStatus) this.onRecordingStatus(status);
    };

    // 6. Start periodic risk scoring (every 10 seconds)
    this.riskUpdateInterval = setInterval(() => {
      this._computeAndSendRiskScore();
    }, 10000);

    this.isInitialized = true;
    console.log('[SheSafe Orchestrator] All systems initialized');
  }

  /**
   * Shutdown all systems
   */
  async shutdown() {
    sensorManager.stop();
    shakeDetector.stop();
    await backgroundLocation.stopTracking();
    networkManager.stopMonitoring();
    await evidenceRecorder.cleanup();

    if (this.riskUpdateInterval) {
      clearInterval(this.riskUpdateInterval);
      this.riskUpdateInterval = null;
    }

    this.isInitialized = false;
    console.log('[SheSafe Orchestrator] All systems shut down');
  }

  /**
   * Handle motion state updates from sensors
   */
  async _onMotionUpdate(motionReport) {
    // If motion indicates danger, adjust risk
    const dangerStates = [MOTION_STATES.RUNNING, MOTION_STATES.STRUGGLING, MOTION_STATES.PHONE_DROPPED];
    
    if (dangerStates.includes(motionReport.motion_state)) {
      // Start evidence recording if not already active
      if (!evidenceRecorder.isRecording && this.currentRiskScore > 60) {
        await evidenceRecorder.startRecording();
      }
    }
  }

  /**
   * Handle shake gesture detection
   */
  _onShakeDetected(shakeData) {
    console.log('[SheSafe Orchestrator] SHAKE DETECTED — initiating alert flow');
    
    if (this.onShakeTrigger) {
      this.onShakeTrigger(shakeData);
    }
    // Shakira's UI handles the 45-second countdown from here
  }

  /**
   * Compute risk score and send to backend
   */
  async _computeAndSendRiskScore() {
    try {
      const location = await backgroundLocation.getCurrentLocation();
      const motionState = sensorManager.getCurrentState();
      const now = new Date();
      const hour = now.getHours();

      // Build behavior flags
      const behaviorFlags = [];
      if (motionState === MOTION_STATES.PHONE_DROPPED) behaviorFlags.push('phone_dropped');
      if (motionState === MOTION_STATES.STRUGGLING) behaviorFlags.push('struggling');
      if (motionState === MOTION_STATES.RUNNING) behaviorFlags.push('running');

      // Determine time_of_day category
      let timeOfDay = 'day';
      if (hour >= 21 || hour < 5) timeOfDay = 'late_night';
      else if (hour >= 19) timeOfDay = 'evening';
      else if (hour < 7) timeOfDay = 'early_morning';

      const payload = {
        motion_state: motionState,
        lat: location?.lat || 0,
        lng: location?.lng || 0,
        timestamp: now.toISOString(),
        time_of_day: timeOfDay,
        behavior_flags: behaviorFlags,
      };

      // Send to Shakeeb's risk score API
      const { isConnected } = await networkManager.checkStatus();
      
      if (isConnected && this.apiBaseUrl) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/risk-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const data = await response.json();
            this.currentRiskScore = data.score;
            this.currentRiskLevel = data.level;

            // Update location tracking frequency
            await backgroundLocation.updateRiskLevel(data.level);

            // Start evidence recording at risk > 60
            if (data.score > 60 && !evidenceRecorder.isRecording) {
              await evidenceRecorder.startRecording();
            }

            // Auto-trigger at risk > 80 (passive trigger)
            if (data.score > 80) {
              this._onShakeDetected({
                timestamp: Date.now(),
                trigger: 'passive',
                riskScore: data.score,
              });
            }

            // Notify UI
            if (this.onRiskUpdate) {
              this.onRiskUpdate(data.score, data.level, data.contributing_factors);
            }
          }
        } catch (e) {
          // Offline — compute a basic local score
          this._computeLocalRiskScore(payload);
        }
      } else {
        // Offline — compute locally
        this._computeLocalRiskScore(payload);
      }
    } catch (e) {
      console.error('[SheSafe Orchestrator] Risk computation error:', e.message);
    }
  }

  /**
   * Basic on-device risk scoring when offline
   * Simplified version of Shakeeb's backend formula
   */
  _computeLocalRiskScore(payload) {
    let motionScore = 10;
    switch (payload.motion_state) {
      case MOTION_STATES.STRUGGLING: motionScore = 80; break;
      case MOTION_STATES.PHONE_DROPPED: motionScore = 90; break;
      case MOTION_STATES.RUNNING: motionScore = 60; break;
      case MOTION_STATES.STATIONARY: motionScore = 30; break;
      default: motionScore = 10;
    }

    let timeScore = 10;
    switch (payload.time_of_day) {
      case 'late_night': timeScore = 80; break;
      case 'evening': timeScore = 50; break;
      case 'early_morning': timeScore = 40; break;
      default: timeScore = 10;
    }

    // Weighted formula: Motion=0.35, Time=0.20, Location=0.30, Behavior=0.15
    // Simplified without location & behavior data
    const score = Math.round(
      (0.50 * motionScore) + (0.35 * timeScore) + (0.15 * 20)
    );
    const clampedScore = Math.min(100, Math.max(0, score));

    let level = 'safe';
    if (clampedScore > 80) level = 'emergency';
    else if (clampedScore > 60) level = 'alert';
    else if (clampedScore > 30) level = 'watchful';

    this.currentRiskScore = clampedScore;
    this.currentRiskLevel = level;

    if (this.onRiskUpdate) {
      this.onRiskUpdate(clampedScore, level, ['offline_mode', payload.motion_state]);
    }
  }

  /**
   * Fire the full emergency alert — called by Shakira after countdown expires
   */
  async fireAlert() {
    // Get current data
    const location = await backgroundLocation.getCurrentLocation();
    const profile = JSON.parse(await AsyncStorage.getItem(USER_PROFILE_KEY) || '{}');

    // Stop evidence recording and get URI
    const evidenceResult = await evidenceRecorder.stopRecording();

    // Get nearest stations from API or local JSON
    let nearestStations = [];
    try {
      const { isConnected } = await networkManager.checkStatus();
      if (isConnected && this.apiBaseUrl) {
        const resp = await fetch(`${this.apiBaseUrl}/nearest-stations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: location?.lat, lng: location?.lng }),
        });
        if (resp.ok) {
          nearestStations = await resp.json();
        }
      }
    } catch (e) {
      console.log('[SheSafe Orchestrator] Using fallback stations');
    }

    // If no stations from API, use local fallback
    if (nearestStations.length === 0) {
      nearestStations = await this._getLocalNearestStations(location?.lat, location?.lng);
    }

    // Build alert payload
    const alertData = {
      user_name: profile.name || 'SheSafe User',
      user_phone: profile.phone || '',
      lat: location?.lat || 0,
      lng: location?.lng || 0,
      address: location?.address || '',
      risk_level: this.currentRiskLevel,
      trusted_contacts: profile.trusted_contacts || [],
      nearest_stations: nearestStations,
      evidence_url: evidenceResult?.uri || null,
      risk_score: this.currentRiskScore,
    };

    // Dispatch via NetworkManager (handles SMS + API dual coverage)
    const results = await networkManager.dispatchAlert(alertData);

    // Set active alert for location pinging
    const alertId = `alert_${Date.now()}`;
    await backgroundLocation.setActiveAlert(alertId);

    // Switch to emergency tracking frequency
    await backgroundLocation.updateRiskLevel('emergency');

    // Upload evidence if we have it
    if (evidenceResult?.uri && this.apiBaseUrl) {
      evidenceRecorder.uploadViaApi(evidenceResult.uri, alertId, this.apiBaseUrl);
    }

    // Notify UI
    if (this.onAlertDispatched) {
      this.onAlertDispatched({
        alertId,
        results,
        nearestStations,
        alertData,
      });
    }

    console.log('[SheSafe Orchestrator] ALERT DISPATCHED:', alertId);
    return { alertId, results };
  }

  /**
   * "I'm Safe" — cancel active alert
   */
  async confirmSafe() {
    // Stop emergency tracking
    await backgroundLocation.updateRiskLevel('safe');
    await backgroundLocation.setActiveAlert(null);

    // Stop evidence recording if still active
    if (evidenceRecorder.isRecording) {
      await evidenceRecorder.stopRecording();
    }

    // Reset risk score
    this.currentRiskScore = 0;
    this.currentRiskLevel = 'safe';

    // Notify contacts via API
    try {
      const { isConnected } = await networkManager.checkStatus();
      if (isConnected && this.apiBaseUrl) {
        const profile = JSON.parse(await AsyncStorage.getItem(USER_PROFILE_KEY) || '{}');
        await fetch(`${this.apiBaseUrl}/alert/safe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_name: profile.name,
            user_phone: profile.phone,
            timestamp: new Date().toISOString(),
          }),
        });
      }
    } catch (e) {
      // Best effort
    }

    if (this.onRiskUpdate) {
      this.onRiskUpdate(0, 'safe', ['confirmed_safe']);
    }

    console.log('[SheSafe Orchestrator] User confirmed safe — all systems reset');
  }

  /**
   * Local nearest-station lookup using bundled JSON
   * Haversine distance calculation
   */
  async _getLocalNearestStations(lat, lng) {
    if (!lat || !lng) return [];

    try {
      // Import bundled police station data
      const stations = require('./data/police_stations.json');

      // Calculate distances using Haversine
      const withDistance = stations.map((s) => ({
        ...s,
        distance_km: this._haversine(lat, lng, s.lat, s.lng),
      }));

      // Sort by distance and take nearest 3
      withDistance.sort((a, b) => a.distance_km - b.distance_km);
      return withDistance.slice(0, 3);
    } catch (e) {
      console.error('[SheSafe Orchestrator] Local station lookup failed:', e.message);
      return [];
    }
  }

  /**
   * Haversine formula — distance between two GPS points in km
   */
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this._toRad(lat2 - lat1);
    const dLon = this._toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  _toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Save user profile (called from Shakira's onboarding)
   */
  async saveProfile(profile) {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  }

  /**
   * Update shake sensitivity
   */
  updateShakeSensitivity(level) {
    shakeDetector.setSensitivity(level);
  }
}

const orchestrator = new SheSafeOrchestrator();
export { SheSafeOrchestrator };
export default orchestrator;
