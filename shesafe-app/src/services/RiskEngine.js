// SheSafe — Multi-Signal Risk Engine (Demo-Optimised)
// Thresholds lowered so demo triggers reliably at real-world motion levels.

const WEIGHTS = { motion: 0.40, location: 0.25, time: 0.20, behavior: 0.15 };
const ELEVATED = 40;   // Signal counts as elevated above this
const FULL_ALERT = 55; // Final weighted score for full alert (was 75 — too high)
const SOFT_ALERT = 35; // Score for soft alert (contacts only)

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
  // DEMO: Simulate 2 AM (deep night) — guaranteed high risk
  return 85;
}

function getLocationScore(lat, lng) {
  // DEMO: Simulate isolated zone with no nearby police
  return 85;
}

function getBehaviorScore(flags = {}) {
  let score = 20; // Base behavior score (phone in pocket = slightly elevated)
  if (flags.screenDarkAndStill) score += 40;
  if (flags.airplaneModeOn) score += 90;
  if (flags.headphonesDisconnected) score += 20;
  if (flags.appBackgrounded) score += 10;
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

  // Gyro confirmation still required but threshold relaxed for demo
  if (motionState === 'struggling' && gyroMagnitude < 0.3) {
    adjustedMotion = Math.min(adjustedMotion, 75);
  }
  // Need 1+ consecutive window (was 3) — more responsive for demo
  if (motionState === 'struggling' && consecutiveStruggleWindows < 1) {
    adjustedMotion = Math.min(adjustedMotion, 80);
  }
  // Dropped phone — still reduce slightly
  if (motionState === 'phone_dropped' && getBehaviorScore(behaviorFlags) < 30) {
    adjustedMotion = Math.min(adjustedMotion, 65);
  }

  const locationScore = getLocationScore(lat, lng, nearestPoliceDistanceM);
  const timeScore = getTimeScore();
  const behaviorScore = getBehaviorScore(behaviorFlags);

  // Weighted final score
  const riskScore = Math.round(
    WEIGHTS.motion * adjustedMotion +
    WEIGHTS.location * locationScore +
    WEIGHTS.time * timeScore +
    WEIGHTS.behavior * behaviorScore
  );

  // Count elevated signals
  const signals = { motion: adjustedMotion, location: locationScore, time: timeScore, behavior: behaviorScore };
  const elevatedCount = Object.values(signals).filter(v => v >= ELEVATED).length;

  // Determine alert level (manual always triggers full)
  const isManual = ['manual_sos', 'shake_trigger'].includes(motionState);

  let alertLevel = 0;
  if (isManual || (elevatedCount >= 2 && riskScore >= FULL_ALERT)) {
    alertLevel = 2; // Full alert → police + contacts
  } else if (elevatedCount >= 1 && riskScore >= SOFT_ALERT) {
    alertLevel = 1; // Soft alert → contacts only
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
