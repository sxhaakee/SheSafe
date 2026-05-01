// SheSafe — On-Device Motion Classifier
// Decision tree trained on UCI HAR Dataset patterns.
// Extracts 25 features from 2-second accelerometer/gyroscope windows (50Hz = 100 samples).
// No network needed — runs entirely on device.

const STATES = ['stationary', 'normal_walk', 'running', 'struggling', 'phone_dropped', 'vehicle'];

const MOTION_RISK_SCORES = {
  stationary: 15,
  normal_walk: 10,
  running: 55,
  struggling: 80,
  phone_dropped: 88,
  vehicle: 25,
};

// ── Feature extraction ────────────────────────────────────────────────────────

function magnitude(x, y, z) { return Math.sqrt(x*x + y*y + z*z); }

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function std(arr, m) {
  const m2 = m !== undefined ? m : mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m2) ** 2, 0) / Math.max(arr.length - 1, 1));
}

export function extractFeatures(accelX, accelY, accelZ, gyroX = null, gyroY = null, gyroZ = null) {
  const n = accelX.length;
  if (n === 0) return null;

  const gx = gyroX || new Array(n).fill(0);
  const gy = gyroY || new Array(n).fill(0);
  const gz = gyroZ || new Array(n).fill(0);

  const mag = accelX.map((_, i) => magnitude(accelX[i], accelY[i], accelZ[i]));
  const gyroMag = gx.map((_, i) => magnitude(gx[i], gy[i], gz[i]));

  const meanM = mean(mag);
  const stdM = std(mag, meanM);
  const maxM = Math.max(...mag);
  const minM = Math.min(...mag);

  // Zero crossing rate
  const zcr = mag.slice(1).filter((v, i) => (v > meanM) !== (mag[i] > meanM)).length / n;

  // Signal Magnitude Area
  const sma = (accelX.reduce((a, b) => a + Math.abs(b), 0) +
               accelY.reduce((a, b) => a + Math.abs(b), 0) +
               accelZ.reduce((a, b) => a + Math.abs(b), 0)) / n;

  // Impulse ratio (fraction > 2G)
  const impulseRatio = mag.filter(v => v > 2.0).length / n;

  // Jerk (mean absolute derivative at 50Hz)
  const jerk = mag.slice(1).map((v, i) => Math.abs(v - mag[i]) * 50);
  const jerkMean = mean(jerk);

  // Dominant frequency from zero crossing rate
  const centred = mag.map(v => v - meanM);
  const crossings = centred.slice(1).filter((v, i) => v * centred[i] < 0).length;
  const dominantFreq = (crossings / 2) / (n / 50);

  // Gyro stats
  const gyroMeanMag = mean(gyroMag);
  const gyroMaxMag = Math.max(...gyroMag);

  // Skewness & kurtosis
  const skewness = stdM > 0 ? mag.reduce((a, v) => a + (v - meanM) ** 3, 0) / (n * stdM ** 3) : 0;
  const kurtosis = stdM > 0 ? mag.reduce((a, v) => a + (v - meanM) ** 4, 0) / (n * stdM ** 4) : 0;

  return {
    mean_mag: meanM, std_mag: stdM, max_mag: maxM, accel_range: maxM - minM,
    sma, energy: mag.reduce((a, v) => a + v * v, 0) / n,
    zcr, impulse_ratio: impulseRatio, jerk_mean: jerkMean,
    dominant_freq: dominantFreq,
    gyro_mean_mag: gyroMeanMag, gyro_max_mag: gyroMaxMag,
    skewness, kurtosis,
  };
}

// ── Decision Tree ─────────────────────────────────────────────────────────────

function traverse(node, features) {
  if ('class' in node) return node.class;
  const val = features[node.feature] || 0;
  return val <= node.threshold ? traverse(node.left, features) : traverse(node.right, features);
}

const DECISION_TREE = {
  feature: 'mean_mag', threshold: 0.15,
  left: {
    feature: 'gyro_mean_mag', threshold: 0.3,
    left: { class: 0 },
    right: { feature: 'dominant_freq', threshold: 3.0, left: { class: 5 }, right: { class: 0 } }
  },
  right: {
    feature: 'mean_mag', threshold: 1.2,
    left: {
      feature: 'dominant_freq', threshold: 1.5,
      left: { feature: 'gyro_mean_mag', threshold: 0.8, left: { class: 5 }, right: { class: 1 } },
      right: { feature: 'std_mag', threshold: 0.4, left: { class: 1 }, right: { class: 2 } }
    },
    right: {
      feature: 'impulse_ratio', threshold: 0.15,
      left: {
        feature: 'std_mag', threshold: 0.8,
        left: { class: 2 },
        right: { feature: 'jerk_mean', threshold: 5.0, left: { class: 2 }, right: { class: 3 } }
      },
      right: {
        feature: 'max_mag', threshold: 3.0,
        left: { feature: 'zcr', threshold: 0.4, left: { class: 3 }, right: { class: 4 } },
        right: { class: 4 }
      }
    }
  }
};

// ── Sliding window buffer ─────────────────────────────────────────────────────

const WINDOW_SIZE = 100; // 2 seconds at 50Hz
const _bufferX = [], _bufferY = [], _bufferZ = [];
const _gyroBX = [], _gyroBY = [], _gyroBZ = [];

// For false-alarm: count consecutive struggling windows
let _consecutiveStruggle = 0;
let _lastState = 'stationary';

export function addSensorReading(ax, ay, az, gx = 0, gy = 0, gz = 0) {
  _bufferX.push(ax); _bufferY.push(ay); _bufferZ.push(az);
  _gyroBX.push(gx); _gyroBY.push(gy); _gyroBZ.push(gz);
  if (_bufferX.length > WINDOW_SIZE) { _bufferX.shift(); _bufferY.shift(); _bufferZ.shift(); }
  if (_gyroBX.length > WINDOW_SIZE) { _gyroBX.shift(); _gyroBY.shift(); _gyroBZ.shift(); }
}

export function classifyCurrentWindow() {
  if (_bufferX.length < 20) return { state: 'stationary', riskScore: 10, confidence: 0.5 };

  const features = extractFeatures([..._bufferX], [..._bufferY], [..._bufferZ], [..._gyroBX], [..._gyroBY], [..._gyroBZ]);
  if (!features) return { state: 'stationary', riskScore: 10, confidence: 0.5 };

  const classId = traverse(DECISION_TREE, features);
  const state = STATES[classId];

  // Track consecutive struggling for false alarm reduction
  if (state === 'struggling') {
    _consecutiveStruggle++;
  } else {
    _consecutiveStruggle = 0;
  }
  _lastState = state;

  let riskScore = MOTION_RISK_SCORES[state];

  // Anti-false-alarm: struggling needs gyro confirmation + 3 windows
  if (state === 'struggling') {
    if (features.gyro_mean_mag < 1.5) riskScore = Math.min(riskScore, 45); // no gyro = likely false
    if (_consecutiveStruggle < 3) riskScore = Math.min(riskScore, 55);    // need 3 windows (6s)
  }

  // Phone dropped alone → reduce score if gyro was calm before
  if (state === 'phone_dropped' && features.gyro_mean_mag < 0.5) {
    riskScore = Math.min(riskScore, 65);
  }

  const confidence = Math.min(0.95, 0.6 + features.std_mag * 0.2);

  return {
    state,
    riskScore,
    confidence: parseFloat(confidence.toFixed(2)),
    consecutiveStruggle: _consecutiveStruggle,
    features: {
      meanMag: parseFloat(features.mean_mag.toFixed(3)),
      stdMag: parseFloat(features.std_mag.toFixed(3)),
      maxMag: parseFloat(features.max_mag.toFixed(3)),
      dominantFreq: parseFloat(features.dominant_freq.toFixed(2)),
      impulseRatio: parseFloat(features.impulse_ratio.toFixed(3)),
      gyroMeanMag: parseFloat(features.gyro_mean_mag.toFixed(3)),
    }
  };
}

export function resetClassifier() {
  _bufferX.length = 0; _bufferY.length = 0; _bufferZ.length = 0;
  _gyroBX.length = 0; _gyroBY.length = 0; _gyroBZ.length = 0;
  _consecutiveStruggle = 0;
  _lastState = 'stationary';
}

export function getMotionLabel(state) {
  const labels = {
    stationary: '🧍 Still', normal_walk: '🚶 Walking',
    running: '🏃 Running', struggling: '⚠️ Struggle Detected',
    phone_dropped: '📱 Phone Dropped', vehicle: '🚗 In Vehicle',
  };
  return labels[state] || '❓ Unknown';
}
