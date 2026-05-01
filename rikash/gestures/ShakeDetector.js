/**
 * SheSafe — Shake Gesture Detection
 * Rikash's Domain: Detects 3 rapid shakes to trigger emergency alert
 * 
 * 3 shakes within 2 seconds at threshold > 18 m/s² = trigger
 * Configurable sensitivity: Low / Medium / High
 */

import { Accelerometer } from 'expo-sensors';

const SENSITIVITY_PRESETS = {
  LOW: { threshold: 25, shakesRequired: 4, windowMs: 2500 },
  MEDIUM: { threshold: 18, shakesRequired: 3, windowMs: 2000 },
  HIGH: { threshold: 12, shakesRequired: 2, windowMs: 2000 },
};

class ShakeDetector {
  constructor() {
    this.subscription = null;
    this.sensitivity = 'MEDIUM';
    this.shakeTimestamps = [];
    this.lastShakeMagnitude = 0;
    this.cooldownActive = false;
    this.cooldownMs = 5000; // 5-second cooldown after trigger
    this.onShakeTriggered = null;
    this.isRunning = false;
    
    // Debounce: minimum time between individual shake counts
    this.lastShakeTime = 0;
    this.minShakeInterval = 200; // 200ms between shakes
  }

  /**
   * Start shake detection
   * @param {Function} onShakeTriggered - Callback when shake gesture detected
   * @param {string} sensitivity - 'LOW' | 'MEDIUM' | 'HIGH'
   */
  start(onShakeTriggered, sensitivity = 'MEDIUM') {
    if (this.isRunning) return;
    this.isRunning = true;
    this.onShakeTriggered = onShakeTriggered;
    this.sensitivity = sensitivity;

    Accelerometer.setUpdateInterval(20); // 50Hz

    this.subscription = Accelerometer.addListener(({ x, y, z }) => {
      this._processShake(x, y, z);
    });

    console.log(`[SheSafe Shake] Started with ${sensitivity} sensitivity`);
  }

  /**
   * Stop shake detection
   */
  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isRunning = false;
    this.shakeTimestamps = [];
    console.log('[SheSafe Shake] Stopped');
  }

  /**
   * Update sensitivity on-the-fly
   */
  setSensitivity(sensitivity) {
    if (SENSITIVITY_PRESETS[sensitivity]) {
      this.sensitivity = sensitivity;
      console.log(`[SheSafe Shake] Sensitivity set to ${sensitivity}`);
    }
  }

  /**
   * Process accelerometer data for shake detection
   */
  _processShake(x, y, z) {
    if (this.cooldownActive) return;

    const now = Date.now();
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const config = SENSITIVITY_PRESETS[this.sensitivity];

    // Check if magnitude exceeds threshold
    if (magnitude > config.threshold) {
      // Debounce: don't count shakes too close together
      if (now - this.lastShakeTime < this.minShakeInterval) return;
      
      this.lastShakeTime = now;
      this.shakeTimestamps.push(now);
      this.lastShakeMagnitude = magnitude;

      // Remove old timestamps outside the window
      this.shakeTimestamps = this.shakeTimestamps.filter(
        (t) => now - t < config.windowMs
      );

      // Check if enough shakes within window
      if (this.shakeTimestamps.length >= config.shakesRequired) {
        this._triggerShake();
      }
    }
  }

  /**
   * Fire the shake trigger
   */
  _triggerShake() {
    console.log('[SheSafe Shake] SHAKE GESTURE DETECTED — Triggering alert!');
    
    // Reset
    this.shakeTimestamps = [];
    
    // Activate cooldown
    this.cooldownActive = true;
    setTimeout(() => {
      this.cooldownActive = false;
    }, this.cooldownMs);

    // Fire callback
    if (this.onShakeTriggered) {
      this.onShakeTriggered({
        timestamp: Date.now(),
        magnitude: this.lastShakeMagnitude,
        sensitivity: this.sensitivity,
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      sensitivity: this.sensitivity,
      ...SENSITIVITY_PRESETS[this.sensitivity],
      isRunning: this.isRunning,
      cooldownActive: this.cooldownActive,
    };
  }
}

export const shakeDetector = new ShakeDetector();
export { SENSITIVITY_PRESETS };
export default ShakeDetector;
