/**
 * SheSafe — Rikash's Module Index
 * Central barrel export for all sensor, network, and integration modules
 * 
 * Usage in Shakira's screens:
 *   import { sensorManager, shakeDetector, backgroundLocation, ... } from '../rikash';
 */

// ---- Sensors ----
export { sensorManager, MOTION_STATES } from './sensors/SensorManager';

// ---- Gestures ----
export { shakeDetector, SENSITIVITY_PRESETS } from './gestures/ShakeDetector';

// ---- Background Location ----
export { backgroundLocation, LOCATION_TASK } from './location/BackgroundLocationManager';

// ---- Network + SMS Fallback ----
export { networkManager } from './network/NetworkManager';

// ---- Evidence Recording ----
export { evidenceRecorder } from './evidence/EvidenceRecorder';

// ---- Offline Maps ----
export { offlineMapManager } from './maps/OfflineMapManager';

// ---- Orchestrator (see below) ----
export { SheSafeOrchestrator } from './SheSafeOrchestrator';
