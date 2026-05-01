/**
 * SheSafe — LOCAL Risk Engine (runs entirely on phone)
 * No backend needed. Computes risk score using sensor data + GPS + time.
 * This is the offline fallback that makes the demo work without WiFi.
 */

// Isolated zones database (same as backend)
const ISOLATED_ZONES = [
  { name: 'Vemana College of Engineering', lat: 12.9340, lng: 77.6210, radius: 500, boost: 30, incidents: 12 },
  { name: 'Vemana Internal Roads (Night)', lat: 12.9335, lng: 77.6225, radius: 200, boost: 40, incidents: 8 },
  { name: 'Koramangala 6th Block Back Lanes', lat: 12.9347, lng: 77.6160, radius: 300, boost: 25, incidents: 6 },
  { name: 'Silk Board Flyover Underbelly', lat: 12.9177, lng: 77.6238, radius: 300, boost: 25, incidents: 9 },
  { name: 'Electronic City Phase 2', lat: 12.8400, lng: 77.6650, radius: 400, boost: 30, incidents: 11 },
  { name: 'KR Market Back Alleys', lat: 12.9627, lng: 77.5780, radius: 300, boost: 30, incidents: 15 },
  { name: 'Majestic Bus Stand', lat: 12.9770, lng: 77.5713, radius: 400, boost: 25, incidents: 18 },
  { name: 'Marathahalli Bridge Underpass', lat: 12.9560, lng: 77.7010, radius: 200, boost: 25, incidents: 5 },
  { name: 'BTM Layout Lake Road', lat: 12.9100, lng: 77.6150, radius: 250, boost: 20, incidents: 5 },
  { name: 'Hebbal Lake Surroundings', lat: 12.0350, lng: 77.5920, radius: 350, boost: 20, incidents: 4 },
];

// Nearest police stations (hardcoded for Bengaluru demo)
const POLICE_STATIONS = [
  { name: 'Koramangala PS', phone: '+918022942290', lat: 12.9352, lng: 77.6245 },
  { name: 'Madiwala PS', phone: '+918022942450', lat: 12.9226, lng: 77.6200 },
  { name: 'Silk Board PS', phone: '+918022942440', lat: 12.9177, lng: 77.6238 },
  { name: 'BTM Layout PS', phone: '+918022942280', lat: 12.9166, lng: 77.6101 },
  { name: 'HSR Layout PS', phone: '+918022942300', lat: 12.9116, lng: 77.6389 },
  { name: 'Indiranagar PS', phone: '+918022942310', lat: 12.9784, lng: 77.6408 },
  { name: 'Jayanagar PS', phone: '+918022942260', lat: 12.9308, lng: 77.5838 },
];

// Haversine distance in meters
function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function distanceKm(lat1, lon1, lat2, lon2) {
  return distanceM(lat1, lon1, lat2, lon2) / 1000;
}

// Check isolated zones
export function checkZone(lat, lng) {
  const matches = [];
  for (const zone of ISOLATED_ZONES) {
    const dist = distanceM(lat, lng, zone.lat, zone.lng);
    if (dist <= zone.radius) {
      matches.push({ ...zone, distance: Math.round(dist) });
    }
  }
  return {
    isIsolated: matches.length > 0,
    zones: matches,
    maxBoost: matches.length > 0 ? Math.max(...matches.map(z => z.boost)) : 0,
    totalIncidents: matches.reduce((s, z) => s + z.incidents, 0),
  };
}

// Get nearest 3 police stations
export function getNearestStations(lat, lng) {
  return POLICE_STATIONS
    .map(s => ({ ...s, distance_km: Math.round(distanceKm(lat, lng, s.lat, s.lng) * 100) / 100 }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 3);
}

// Motion score
const MOTION_SCORES = {
  stationary: 20, normal_walk: 10, running: 60,
  struggling: 80, phone_dropped: 90, vehicle: 30,
};

function motionScore(state, isIsolated, isNight, accelMag) {
  let base = MOTION_SCORES[state] || 10;
  let reason = `Motion: ${state} → ${base}`;

  if (state === 'stationary' && isIsolated && isNight) {
    return { score: 50, reason: 'STATIONARY in isolated zone at NIGHT' };
  }
  if (state === 'struggling' && accelMag > 25) {
    const boost = Math.min(10, (accelMag - 25) * 2);
    return { score: Math.min(100, base + boost), reason: `STRUGGLING with high acceleration (${accelMag.toFixed(1)})` };
  }
  if (state === 'phone_dropped' && isIsolated) {
    return { score: 95, reason: 'PHONE DROPPED in isolated zone' };
  }
  if (state === 'running' && isNight) {
    return { score: 70, reason: 'RUNNING at night' };
  }
  return { score: base, reason };
}

// Location score
function locationScore(lat, lng) {
  const zone = checkZone(lat, lng);
  const nearest = getNearestStations(lat, lng);
  const stationDist = nearest[0]?.distance_km || 50;

  let base = stationDist < 1 ? 10 : stationDist < 3 ? 30 : stationDist < 5 ? 50 : stationDist < 10 ? 70 : 90;
  let reason = `Nearest station: ${stationDist}km → ${base}`;

  if (zone.isIsolated) {
    base = Math.max(60, Math.min(100, base + zone.maxBoost));
    if (zone.totalIncidents >= 10) base = Math.min(100, base + 10);
    reason = `⚠️ ISOLATED: ${zone.zones[0].name}. Boost +${zone.maxBoost}. Score: ${base}`;
  }

  return { score: base, reason, zone, stations: nearest };
}

// Time score
function timeScore() {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 4) return { score: 90, reason: `DEEP NIGHT (${hour}:00)` };
  if (hour >= 21) return { score: 75, reason: `Late night (${hour}:00)` };
  if (hour < 5) return { score: 70, reason: `Pre-dawn (${hour}:00)` };
  if (hour >= 19) return { score: 50, reason: `Evening (${hour}:00)` };
  if (hour < 7) return { score: 40, reason: `Early morning (${hour}:00)` };
  if (hour >= 17) return { score: 20, reason: `Late afternoon (${hour}:00)` };
  return { score: 10, reason: `Daytime (${hour}:00)` };
}

// Behavior score
function behaviorScore(flags) {
  if (!flags || flags.length === 0) return { score: 0, reason: 'No anomalies' };
  const scores = { screen_dark_no_motion: 70, sudden_airplane_mode: 90, phone_upside_down: 40 };
  const max = Math.max(...flags.map(f => scores[f] || 0));
  return { score: max, reason: `Anomaly: ${flags.join(', ')} → ${max}` };
}

// Main risk computation
export function computeRiskScore(sensorReport, lat, lng, behaviorFlags = []) {
  const hour = new Date().getHours();
  const isNight = hour >= 21 || hour < 5;
  const locResult = locationScore(lat, lng);
  const isIsolated = locResult.zone.isIsolated;
  const accelMag = (sensorReport.accel_magnitude || sensorReport.peak_magnitude || 1) * 9.8;

  const motion = motionScore(sensorReport.motion_state, isIsolated, isNight, accelMag);
  const loc = locResult;
  const time = timeScore();
  const behavior = behaviorScore(behaviorFlags);

  const total = Math.min(100, Math.max(0, Math.round(
    0.35 * motion.score + 0.30 * loc.score + 0.20 * time.score + 0.15 * behavior.score
  )));

  let level = 'safe';
  if (total > 80) level = 'emergency';
  else if (total > 60) level = 'alert';
  else if (total > 30) level = 'watchful';

  return {
    score: total,
    level,
    is_isolated_zone: isIsolated,
    zone_data: locResult.zone,
    nearest_stations: locResult.stations,
    contributing_factors: [
      { factor: 'Motion', weight: 0.35, raw_score: motion.score, weighted_score: Math.round(0.35 * motion.score * 100) / 100, reasoning: motion.reason },
      { factor: 'Location', weight: 0.30, raw_score: loc.score, weighted_score: Math.round(0.30 * loc.score * 100) / 100, reasoning: loc.reason },
      { factor: 'Time', weight: 0.20, raw_score: time.score, weighted_score: Math.round(0.20 * time.score * 100) / 100, reasoning: time.reason },
      { factor: 'Behavior', weight: 0.15, raw_score: behavior.score, weighted_score: Math.round(0.15 * behavior.score * 100) / 100, reasoning: behavior.reason },
    ],
    motion_score: motion.score,
    location_score: loc.score,
    time_score: time.score,
    behavior_score: behavior.score,
  };
}

export default { computeRiskScore, checkZone, getNearestStations, POLICE_STATIONS, ISOLATED_ZONES };
