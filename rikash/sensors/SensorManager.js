/**
 * SheSafe — Accelerometer & Gyroscope Integration
 * Rikash's Domain: Sensor data processing + motion classification
 * 
 * Classifies motion states: Normal Walk, Running, Struggling, Stationary, Phone-Dropped
 * Sends motion state to Shakeeb's risk score API every 10 seconds
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';

// Motion state constants
export const MOTION_STATES = {
  STATIONARY: 'Stationary',
  NORMAL_WALK: 'Normal Walk',
  RUNNING: 'Running',
  STRUGGLING: 'Struggling',
  PHONE_DROPPED: 'Phone-Dropped',
  VEHICLE: 'Vehicle',
};

// Thresholds for classification
const THRESHOLDS = {
  RUNNING_MAG: 18,         // m/s² sustained
  STRUGGLING_MAG: 25,      // m/s² spikes with random direction
  STATIONARY_MAG: 1,       // m/s² near-zero
  PHONE_DROPPED_MAG: 0.5,  // near-zero after sudden spike
  RUNNING_DURATION: 3000,  // 3 seconds
  STATIONARY_NIGHT_DURATION: 60000, // 60 seconds
  DROP_SPIKE_THRESHOLD: 30, // sudden spike before drop
};

class SensorManager {
  constructor() {
    this.accelSubscription = null;
    this.gyroSubscription = null;
    this.accelHistory = [];     // last N readings
    this.gyroHistory = [];
    this.motionState = MOTION_STATES.STATIONARY;
    this.stateCallbacks = [];
    this.isRunning = false;
    
    // Tracking vars for classification
    this.highMagStartTime = null;
    this.stationaryStartTime = null;
    this.lastMagnitude = 9.8;
    this.dropDetectionPhase = 'none'; // 'none' | 'spike' | 'freefall'
    this.spikeTime = null;
    
    // Buffer for direction randomness analysis
    this.directionBuffer = [];
    
    // 10-second reporting interval
    this.reportInterval = null;
    this.onMotionStateUpdate = null;
  }

  /**
   * Start sensor sampling at 50Hz (20ms interval)
   */
  start(onMotionStateUpdate) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.onMotionStateUpdate = onMotionStateUpdate;

    // Set update intervals to 20ms (50Hz)
    Accelerometer.setUpdateInterval(20);
    Gyroscope.setUpdateInterval(20);

    // Subscribe to accelerometer
    this.accelSubscription = Accelerometer.addListener((data) => {
      this._processAccelData(data);
    });

    // Subscribe to gyroscope
    this.gyroSubscription = Gyroscope.addListener((data) => {
      this._processGyroData(data);
    });

    // Report motion state every 10 seconds
    this.reportInterval = setInterval(() => {
      this._reportMotionState();
    }, 10000);

    console.log('[SheSafe Sensors] Started at 50Hz');
  }

  /**
   * Stop all sensor subscriptions
   */
  stop() {
    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }
    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    this.isRunning = false;
    console.log('[SheSafe Sensors] Stopped');
  }

  /**
   * Process accelerometer data and classify motion
   */
  _processAccelData({ x, y, z }) {
    const now = Date.now();
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // Store in history (keep last 250 readings = 5 seconds at 50Hz)
    this.accelHistory.push({ x, y, z, magnitude, timestamp: now });
    if (this.accelHistory.length > 250) {
      this.accelHistory.shift();
    }

    // Store direction for randomness analysis
    this.directionBuffer.push({ x, y, z, timestamp: now });
    if (this.directionBuffer.length > 100) {
      this.directionBuffer.shift();
    }

    // ---- Phone-Dropped Detection ----
    if (this.dropDetectionPhase === 'none' && magnitude > THRESHOLDS.DROP_SPIKE_THRESHOLD) {
      this.dropDetectionPhase = 'spike';
      this.spikeTime = now;
    } else if (this.dropDetectionPhase === 'spike') {
      if (now - this.spikeTime > 2000) {
        this.dropDetectionPhase = 'none'; // timeout
      } else if (magnitude < THRESHOLDS.PHONE_DROPPED_MAG) {
        // Sudden spike then near-zero = phone dropped
        this.motionState = MOTION_STATES.PHONE_DROPPED;
        this.dropDetectionPhase = 'none';
        this.lastMagnitude = magnitude;
        return;
      }
    }

    // ---- Struggling Detection ----
    if (magnitude > THRESHOLDS.STRUGGLING_MAG && this._isDirectionRandom()) {
      this.motionState = MOTION_STATES.STRUGGLING;
      this.lastMagnitude = magnitude;
      return;
    }

    // ---- Running Detection ----
    if (magnitude > THRESHOLDS.RUNNING_MAG) {
      if (!this.highMagStartTime) {
        this.highMagStartTime = now;
      } else if (now - this.highMagStartTime >= THRESHOLDS.RUNNING_DURATION) {
        this.motionState = MOTION_STATES.RUNNING;
      }
    } else {
      this.highMagStartTime = null;
    }

    // ---- Stationary Detection ----
    if (magnitude < THRESHOLDS.STATIONARY_MAG) {
      if (!this.stationaryStartTime) {
        this.stationaryStartTime = now;
      }
      // If near-zero for extended period
      if (now - this.stationaryStartTime > 5000) {
        this.motionState = MOTION_STATES.STATIONARY;
      }
    } else {
      this.stationaryStartTime = null;
    }

    // ---- Normal Walk (default when magnitude is 9-15) ----
    if (magnitude >= THRESHOLDS.STATIONARY_MAG && magnitude < THRESHOLDS.RUNNING_MAG) {
      if (this.motionState !== MOTION_STATES.STRUGGLING && 
          this.motionState !== MOTION_STATES.PHONE_DROPPED) {
        this.motionState = MOTION_STATES.NORMAL_WALK;
      }
    }

    this.lastMagnitude = magnitude;
  }

  /**
   * Check if recent acceleration directions are random (indicates struggling)
   */
  _isDirectionRandom() {
    if (this.directionBuffer.length < 20) return false;
    
    const recent = this.directionBuffer.slice(-20);
    let directionChanges = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      
      // Check sign changes in each axis
      if (Math.sign(prev.x) !== Math.sign(curr.x)) directionChanges++;
      if (Math.sign(prev.y) !== Math.sign(curr.y)) directionChanges++;
      if (Math.sign(prev.z) !== Math.sign(curr.z)) directionChanges++;
    }
    
    // High direction changes = random/erratic movement
    return directionChanges > 30;
  }

  /**
   * Process gyroscope data (used for enhanced classification)
   */
  _processGyroData({ x, y, z }) {
    const now = Date.now();
    this.gyroHistory.push({ x, y, z, timestamp: now });
    if (this.gyroHistory.length > 250) {
      this.gyroHistory.shift();
    }
  }

  /**
   * Report current motion state (called every 10 seconds)
   */
  _reportMotionState() {
    if (this.onMotionStateUpdate) {
      const report = {
        motion_state: this.motionState,
        timestamp: Date.now(),
        avg_magnitude: this._getAverageMagnitude(),
        peak_magnitude: this._getPeakMagnitude(),
      };
      this.onMotionStateUpdate(report);
    }
  }

  /**
   * Get average magnitude over recent history
   */
  _getAverageMagnitude() {
    if (this.accelHistory.length === 0) return 0;
    const sum = this.accelHistory.reduce((acc, r) => acc + r.magnitude, 0);
    return sum / this.accelHistory.length;
  }

  /**
   * Get peak magnitude over recent history
   */
  _getPeakMagnitude() {
    if (this.accelHistory.length === 0) return 0;
    return Math.max(...this.accelHistory.map(r => r.magnitude));
  }

  /**
   * Get current motion state
   */
  getCurrentState() {
    return this.motionState;
  }

  /**
   * Check if sensors are available
   */
  static async checkAvailability() {
    const [accelAvail, gyroAvail] = await Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
    ]);
    return { accelerometer: accelAvail, gyroscope: gyroAvail };
  }
}

// Export singleton instance
export const sensorManager = new SensorManager();
export default SensorManager;
