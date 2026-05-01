/**
 * SheSafe — Sensor Service
 * Real accelerometer + gyroscope data processing with ML-like motion classification.
 * Adapted from Rikash's SensorManager for Expo Go compatibility.
 */
import { Accelerometer, Gyroscope } from 'expo-sensors';

export const MOTION_STATES = {
  STATIONARY: 'stationary',
  NORMAL_WALK: 'normal_walk',
  RUNNING: 'running',
  STRUGGLING: 'struggling',
  PHONE_DROPPED: 'phone_dropped',
  VEHICLE: 'vehicle',
};

const MOTION_LABELS = {
  stationary: '🧍 Stationary',
  normal_walk: '🚶 Normal Walk',
  running: '🏃 Running',
  struggling: '⚠️ Struggling',
  phone_dropped: '📱 Phone Dropped',
  vehicle: '🚗 In Vehicle',
};

// Thresholds calibrated from real phone sensor data
// Expo reports accelerometer in G-force (1G ≈ 9.8 m/s²)
const THRESHOLDS = {
  STATIONARY_G: 0.15,        // Near 1G (gravity only), deviation < 0.15G
  WALK_G: 0.4,               // Walking creates 0.2-0.5G variations
  RUNNING_G: 1.2,            // Running creates 1.0-2.0G spikes
  STRUGGLING_G: 1.8,         // Struggling creates erratic > 1.5G
  DROP_SPIKE_G: 2.5,         // Sudden spike before free-fall
  DROP_FREEFALL_G: 0.3,      // Near 0G during free-fall
  DIRECTION_CHANGE_THRESHOLD: 25, // For struggle detection
};

class SensorService {
  constructor() {
    this.accelSub = null;
    this.gyroSub = null;
    this.isRunning = false;

    // Sensor data buffers
    this.accelBuffer = [];     // Last 5 sec (50Hz = 250 samples)
    this.gyroBuffer = [];
    this.magnitudeBuffer = []; // Last 2 sec for classification

    // Motion state
    this.currentState = MOTION_STATES.STATIONARY;
    this.currentMagnitude = 0;
    this.peakMagnitude = 0;
    this.avgMagnitude = 0;

    // Shake detection
    this.shakeCount = 0;
    this.lastShakeTime = 0;
    this.onShakeTriggered = null;

    // Drop detection
    this.dropPhase = 'none'; // 'none' | 'spike' | 'freefall'
    this.spikeTime = null;

    // Direction analysis for struggle
    this.directionBuffer = [];

    // Callbacks
    this.onStateChange = null;
    this.onDataUpdate = null;
  }

  async start(callbacks = {}) {
    if (this.isRunning) return;

    const { accelerometer, gyroscope } = await SensorService.checkAvailability();
    if (!accelerometer) {
      console.warn('[Sensors] Accelerometer not available');
      return false;
    }

    this.onStateChange = callbacks.onStateChange || null;
    this.onDataUpdate = callbacks.onDataUpdate || null;
    this.onShakeTriggered = callbacks.onShakeTriggered || null;
    this.isRunning = true;

    // 50Hz sampling
    Accelerometer.setUpdateInterval(20);
    if (gyroscope) Gyroscope.setUpdateInterval(20);

    this.accelSub = Accelerometer.addListener(this._processAccel.bind(this));
    if (gyroscope) {
      this.gyroSub = Gyroscope.addListener(this._processGyro.bind(this));
    }

    console.log('[Sensors] Started at 50Hz');
    return true;
  }

  stop() {
    if (this.accelSub) { this.accelSub.remove(); this.accelSub = null; }
    if (this.gyroSub) { this.gyroSub.remove(); this.gyroSub = null; }
    this.isRunning = false;
    console.log('[Sensors] Stopped');
  }

  _processAccel({ x, y, z }) {
    const now = Date.now();
    // Expo reports in G-force. Magnitude of gravity-removed acceleration:
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const deviation = Math.abs(magnitude - 1.0); // Deviation from gravity (1G)

    this.currentMagnitude = magnitude;

    // Buffer management
    this.magnitudeBuffer.push({ magnitude, deviation, timestamp: now });
    if (this.magnitudeBuffer.length > 100) this.magnitudeBuffer.shift(); // 2 sec

    this.accelBuffer.push({ x, y, z, magnitude, timestamp: now });
    if (this.accelBuffer.length > 250) this.accelBuffer.shift(); // 5 sec

    this.directionBuffer.push({ x, y, z, timestamp: now });
    if (this.directionBuffer.length > 50) this.directionBuffer.shift(); // 1 sec

    // === SHAKE DETECTION (3 shakes in 2 seconds) ===
    if (deviation > 1.5) { // Strong shake > 1.5G deviation
      if (now - this.lastShakeTime > 300) { // Debounce 300ms
        this.shakeCount++;
        this.lastShakeTime = now;

        if (this.shakeCount >= 3) {
          this.shakeCount = 0;
          if (this.onShakeTriggered) {
            this.onShakeTriggered();
          }
        }
      }
    }
    // Reset shake counter if gap > 2 seconds
    if (now - this.lastShakeTime > 2000) {
      this.shakeCount = 0;
    }

    // === PHONE DROP DETECTION ===
    if (this.dropPhase === 'none' && deviation > THRESHOLDS.DROP_SPIKE_G) {
      this.dropPhase = 'spike';
      this.spikeTime = now;
    } else if (this.dropPhase === 'spike') {
      if (now - this.spikeTime > 2000) {
        this.dropPhase = 'none';
      } else if (magnitude < THRESHOLDS.DROP_FREEFALL_G) {
        this._setState(MOTION_STATES.PHONE_DROPPED);
        this.dropPhase = 'none';
        return;
      }
    }

    // === MOTION CLASSIFICATION (every 500ms for efficiency) ===
    if (this.magnitudeBuffer.length >= 25) { // At least 0.5 sec of data
      this._classifyMotion();
    }

    // Fire data update callback (throttled)
    if (this.onDataUpdate && this.magnitudeBuffer.length % 25 === 0) {
      this._computeStats();
      this.onDataUpdate({
        state: this.currentState,
        label: MOTION_LABELS[this.currentState],
        magnitude: this.currentMagnitude.toFixed(2),
        avgMagnitude: this.avgMagnitude.toFixed(2),
        peakMagnitude: this.peakMagnitude.toFixed(2),
        accelX: x.toFixed(3),
        accelY: y.toFixed(3),
        accelZ: z.toFixed(3),
        shakeCount: this.shakeCount,
      });
    }
  }

  _processGyro({ x, y, z }) {
    const now = Date.now();
    this.gyroBuffer.push({ x, y, z, timestamp: now });
    if (this.gyroBuffer.length > 250) this.gyroBuffer.shift();
  }

  _classifyMotion() {
    const recent = this.magnitudeBuffer.slice(-50); // Last 1 second
    const avgDev = recent.reduce((sum, r) => sum + r.deviation, 0) / recent.length;
    const maxDev = Math.max(...recent.map(r => r.deviation));

    // === STRUGGLING: High + erratic ===
    if (avgDev > THRESHOLDS.STRUGGLING_G && this._isDirectionRandom()) {
      this._setState(MOTION_STATES.STRUGGLING);
      return;
    }

    // === RUNNING: Sustained high acceleration ===
    if (avgDev > THRESHOLDS.RUNNING_G) {
      this._setState(MOTION_STATES.RUNNING);
      return;
    }

    // === VEHICLE: Moderate, smooth, low-frequency vibration ===
    if (avgDev > THRESHOLDS.WALK_G && avgDev < THRESHOLDS.RUNNING_G && !this._isDirectionRandom()) {
      const gyroMag = this.gyroBuffer.length > 0
        ? this.gyroBuffer.slice(-50).reduce((s, g) =>
            s + Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z), 0) / Math.min(50, this.gyroBuffer.length)
        : 0;
      if (gyroMag < 1.0) {
        this._setState(MOTION_STATES.VEHICLE);
        return;
      }
    }

    // === WALKING: Moderate rhythmic acceleration ===
    if (avgDev > THRESHOLDS.STATIONARY_G && avgDev <= THRESHOLDS.RUNNING_G) {
      this._setState(MOTION_STATES.NORMAL_WALK);
      return;
    }

    // === STATIONARY: Near-zero deviation from gravity ===
    if (avgDev <= THRESHOLDS.STATIONARY_G) {
      this._setState(MOTION_STATES.STATIONARY);
    }
  }

  _isDirectionRandom() {
    if (this.directionBuffer.length < 20) return false;
    const recent = this.directionBuffer.slice(-20);
    let changes = 0;
    for (let i = 1; i < recent.length; i++) {
      if (Math.sign(recent[i].x) !== Math.sign(recent[i-1].x)) changes++;
      if (Math.sign(recent[i].y) !== Math.sign(recent[i-1].y)) changes++;
      if (Math.sign(recent[i].z) !== Math.sign(recent[i-1].z)) changes++;
    }
    return changes > THRESHOLDS.DIRECTION_CHANGE_THRESHOLD;
  }

  _setState(newState) {
    if (newState !== this.currentState) {
      const oldState = this.currentState;
      this.currentState = newState;
      if (this.onStateChange) {
        this.onStateChange(newState, oldState);
      }
    }
  }

  _computeStats() {
    if (this.magnitudeBuffer.length === 0) return;
    const mags = this.magnitudeBuffer.map(r => r.magnitude);
    this.avgMagnitude = mags.reduce((a, b) => a + b, 0) / mags.length;
    this.peakMagnitude = Math.max(...mags);
  }

  getReport() {
    this._computeStats();
    return {
      motion_state: this.currentState,
      accel_magnitude: this.peakMagnitude * 9.8, // Convert G to m/s² for backend
      timestamp: new Date().toISOString(),
      avg_magnitude: this.avgMagnitude,
      peak_magnitude: this.peakMagnitude,
    };
  }

  static async checkAvailability() {
    const [accel, gyro] = await Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
    ]);
    return { accelerometer: accel, gyroscope: gyro };
  }
}

export const sensorService = new SensorService();
export default SensorService;
