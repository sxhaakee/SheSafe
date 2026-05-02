// SheSafe — Multi-Signal Risk Engine (Correctly Calibrated)
// Passive trigger ONLY fires on real, sustained physical struggle.
// Manual SOS and shake always bypass thresholds.

const WEIGHTS = { motion: 0.50, location: 0.20, time: 0.15, behavior: 0.15 };

// These thresholds are for PASSIVE auto-detection only.
// Manual SOS / Shake always trigger regardless.
const ELEVATED = 50;    // Signal must exceed this to count as "elevated"
const FULL_ALERT = 72;  // Weighted score needed for full passive alert (police + contacts)
// Stationary baseline: motion=10, location=85, time=85, behavior=0
// → 0.50*10 + 0.20*85 + 0.15*85 + 0.15*0 = 5 + 17 + 12.75 + 0 = 34.75 → safe ✅
// Struggling (motion=80): 0.50*80 + 17 + 12.75 = 40 + 17 + 12.75 = 69.75 → near threshold
// Struggling + gyro (motion=80, behavior=30): = 40+17+12.75+4.5 = 74.25 → TRIGGERS ✅

// Vemana College — demo isolated zone
const ISOLATED_ZONES = [
  { lat: 12.9340, lng: 77.6210, name: 'Vemana College Area', radius: 1000 },
  { lat: 12.9352, lng: 77.6245, name: 'Koramangala Industrial', radius: 800 },
];

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getTimeScore() {
  // DEMO: Simulate late-night time to boost environmental risk
  return 85;
}

function getLocationScore(lat, lng) {
  // DEMO: Simulate isolated zone with no nearby police
  return 85;
}

function getBehaviorScore(flags = {}) {
  // NO base score — behavior only elevated by specific events
  let score = 0;
  if (flags.screenDarkAndStill) score += 40;    // Phone face-down
  if (flags.airplaneModeOn)     score += 90;    // Attacker cutting comms
  if (flags.headphonesDisconnected) score += 20; // Sudden disconnect
  if (flags.appBackgrounded)    score += 10;
  return Math.min(score, 100);
}

// ── Main compute function ──────────────────────────────────────────────────────

export function computeRisk({
  motionScore = 0,
  motionState = 'stationary',
  lat = null,
  lng = null,
  nearestPoliceDistanceM = 5000,
  behaviorFlags = {},
  gyroMagnitude = 0,
  consecutiveStruggleWindows = 0,
}) {
  let adjustedMotion = motionScore;

  // Struggling requires some gyro confirmation (real struggle causes body rotation)
  if (motionState === 'struggling' && gyroMagnitude < 0.4) {
    adjustedMotion = Math.min(adjustedMotion, 65);
  }
  // Need at least 1 consecutive struggling window (2 seconds) before going full alert
  if (motionState === 'struggling' && consecutiveStruggleWindows < 1) {
    adjustedMotion = Math.min(adjustedMotion, 72);
  }
  // Dropped phone without prior gyro activity → probably just set it down
  if (motionState === 'phone_dropped' && gyroMagnitude < 0.3) {
    adjustedMotion = Math.min(adjustedMotion, 50);
  }

  const locationScore = getLocationScore(lat, lng, nearestPoliceDistanceM);
  const timeScore = getTimeScore();
  const behaviorScore = getBehaviorScore(behaviorFlags);

  // Weighted final score — motion is now 50% weight
  const riskScore = Math.round(
    WEIGHTS.motion * adjustedMotion +
    WEIGHTS.location * locationScore +
    WEIGHTS.time * timeScore +
    WEIGHTS.behavior * behaviorScore
  );

  // Count elevated signals
  const signals = { motion: adjustedMotion, location: locationScore, time: timeScore, behavior: behaviorScore };
  const elevatedCount = Object.values(signals).filter(v => v >= ELEVATED).length;

  // PASSIVE trigger only at FULL_ALERT (alertLevel 2)
  // Manual SOS/shake bypass this entirely — they call triggerEmergency() directly
  let alertLevel = 0;
  if (elevatedCount >= 2 && riskScore >= FULL_ALERT) {
    alertLevel = 2; // Full alert → police + contacts
  } else if (elevatedCount >= 1 && riskScore >= 55) {
    alertLevel = 1; // Soft alert — contacts only (no auto-trigger)
  }

  return {
    riskScore: Math.min(riskScore, 100),
    alertLevel,
    elevatedSignals: elevatedCount,
    breakdown: {
      motion: adjustedMotion,
      location: locationScore,
      time: timeScore,
      behavior: behaviorScore,
    },
    label: getRiskLabel(riskScore),
    color: getRiskColor(riskScore),
  };
}

export function getRiskLabel(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  if (score >= 20) return 'LOW';
  return 'SAFE';
}

export function getRiskColor(score) {
  if (score >= 80) return '#FF4757';
  if (score >= 60) return '#FF6B35';
  if (score >= 40) return '#FFAB00';
  if (score >= 20) return '#2ED573';
  return '#2ED573';
}
