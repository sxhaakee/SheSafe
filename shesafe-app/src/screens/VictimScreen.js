/**
 * SheSafe — VICTIM SCREEN (Main Dashboard)
 * Shows: Real-time risk score, sensor data, SOS button, shake detection status
 * This is the primary screen the victim uses.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Vibration, Alert, Animated, Dimensions, StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { sensorService } from '../services/SensorService';
import { apiService } from '../services/ApiService';
import config from '../config';

const { width } = Dimensions.get('window');

export default function VictimScreen() {
  // State
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('safe');
  const [motionState, setMotionState] = useState('stationary');
  const [motionLabel, setMotionLabel] = useState('🧍 Stationary');
  const [sensorData, setSensorData] = useState({});
  const [location, setLocation] = useState(null);
  const [isInZone, setIsInZone] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [connected, setConnected] = useState(false);
  const [alertActive, setAlertActive] = useState(false);
  const [alertId, setAlertId] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [factors, setFactors] = useState([]);
  const [stations, setStations] = useState([]);
  const [log, setLog] = useState([]);

  // Refs
  const riskInterval = useRef(null);
  const pingInterval = useRef(null);
  const countdownInterval = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;

  // Add log entry
  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Pulse animation for SOS button
  useEffect(() => {
    if (alertActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [alertActive]);

  // Check backend connection
  useEffect(() => {
    const check = async () => {
      const result = await apiService.ping();
      setConnected(!!result);
      if (result) addLog('✅ Backend connected');
      else addLog('❌ Backend offline — check IP in config.js');
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get location permission and start tracking
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is needed for SheSafe to work');
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
    setLocation(coords);
    return coords;
  };

  // Start monitoring
  const startMonitoring = async () => {
    addLog('🔄 Starting SheSafe monitoring...');

    // Get location
    const coords = await getLocation();
    if (!coords) return;
    addLog(`📍 Location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);

    // Check zone
    const zone = await apiService.checkZone(coords.lat, coords.lng);
    if (zone?.is_isolated) {
      setIsInZone(true);
      setZoneName(zone.zones[0]?.name || 'Unknown Zone');
      addLog(`⚠️ IN ISOLATED ZONE: ${zone.zones[0]?.name}`);
    }

    // Get nearest stations
    const stationResult = await apiService.getNearestStations(coords.lat, coords.lng);
    if (stationResult?.stations) {
      setStations(stationResult.stations);
      addLog(`🏛️ Nearest: ${stationResult.stations[0]?.name} (${stationResult.stations[0]?.distance_km}km)`);
    }

    // Start sensors
    const started = await sensorService.start({
      onStateChange: (newState, oldState) => {
        setMotionState(newState);
        addLog(`🔄 Motion: ${oldState} → ${newState}`);
      },
      onDataUpdate: (data) => {
        setSensorData(data);
        setMotionLabel(data.label);
      },
      onShakeTriggered: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
        addLog('🚨 3-SHAKE DETECTED — FULL PROTECTION MODE!');
        triggerFullProtection();
      },
    });

    if (!started) {
      addLog('❌ Sensors not available');
      return;
    }
    addLog('📡 Sensors active (50Hz)');

    // Start risk scoring loop (every 10 seconds)
    riskInterval.current = setInterval(async () => {
      const report = sensorService.getReport();
      const loc = await getLocation();
      if (!loc || !connected) return;

      const result = await apiService.computeRiskScore(report, loc);
      if (result) {
        setRiskScore(result.score);
        setRiskLevel(result.level);
        setFactors(result.contributing_factors || []);
        setIsInZone(result.is_isolated_zone || false);

        Animated.timing(scoreAnim, {
          toValue: result.score,
          duration: 500,
          useNativeDriver: false,
        }).start();

        // Auto-alert if score > 80 and no active alert
        if (result.score > 80 && !alertActive) {
          addLog(`🚨 Score ${result.score} > 80 — triggering alert countdown!`);
          startCountdown(loc);
        }
      }
    }, 10000);

    setIsMonitoring(true);
    addLog('✅ Monitoring active — scoring every 10 seconds');
  };

  // Stop monitoring
  const stopMonitoring = () => {
    sensorService.stop();
    if (riskInterval.current) clearInterval(riskInterval.current);
    if (pingInterval.current) clearInterval(pingInterval.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setIsMonitoring(false);
    setRiskScore(0);
    setRiskLevel('safe');
    addLog('⏹️ Monitoring stopped');
  };

  // 45-second countdown before alert fires
  const startCountdown = (loc) => {
    setCountdown(45);
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current);
          fireAlert(loc, 'passive');
          return 0;
        }
        if (prev <= 10) Vibration.vibrate(200);
        return prev - 1;
      });
    }, 1000);
  };

  // Cancel countdown
  const cancelCountdown = () => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setCountdown(0);
    addLog('✅ Countdown cancelled — you are safe');
  };

  // Full protection mode (shake trigger)
  const triggerFullProtection = async () => {
    const loc = location || await getLocation();
    if (!loc) return;

    const result = await apiService.activateFullProtection(loc);
    if (result) {
      setRiskScore(100);
      setRiskLevel('emergency');
      addLog(`🚨 FULL PROTECTION: Score 100, ${result.nearest_stations?.length} stations ready`);
      fireAlert(loc, 'shake');
    }
  };

  // Fire the alert
  const fireAlert = async (loc, trigger) => {
    const result = await apiService.fireAlert(loc, riskScore || 100, stations, trigger);
    if (result) {
      setAlertActive(true);
      setAlertId(result.alert_id);
      addLog(`🔴 ALERT DISPATCHED: ${result.alert_id}`);
      addLog(`📨 ${result.recipients?.length} recipients notified`);
      Vibration.vibrate([0, 500, 200, 500]);

      // Start location pings every 30 seconds
      pingInterval.current = setInterval(async () => {
        const newLoc = await getLocation();
        if (newLoc && result.alert_id) {
          await apiService.sendPing(result.alert_id, newLoc.lat, newLoc.lng);
          addLog(`📡 Ping sent: ${newLoc.lat.toFixed(4)}, ${newLoc.lng.toFixed(4)}`);
        }
      }, 30000);
    }
  };

  // I'm Safe
  const confirmSafe = async () => {
    if (!alertId) return;
    const result = await apiService.confirmSafe(alertId);
    if (result) {
      setAlertActive(false);
      if (pingInterval.current) clearInterval(pingInterval.current);
      addLog(`✅ SAFE confirmed — ${result.notifications_sent} notified`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Manual SOS
  const manualSOS = () => {
    Alert.alert(
      '🚨 SOS Alert',
      'This will immediately alert police and your trusted contacts. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'SEND SOS', style: 'destructive', onPress: async () => {
          const loc = location || await getLocation();
          if (loc) {
            setRiskScore(100);
            setRiskLevel('emergency');
            fireAlert(loc, 'manual');
          }
        }},
      ]
    );
  };

  const getRiskColor = () => {
    if (riskScore <= 30) return '#22c55e';
    if (riskScore <= 60) return '#f59e0b';
    if (riskScore <= 80) return '#f97316';
    return '#ef4444';
  };

  const getRiskBg = () => {
    if (riskScore <= 30) return '#f0fdf4';
    if (riskScore <= 60) return '#fffbeb';
    if (riskScore <= 80) return '#fff7ed';
    return '#fef2f2';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4c1d95" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛡️ SheSafe</Text>
        <View style={[styles.connDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Risk Score Display */}
        <View style={[styles.riskCard, { backgroundColor: getRiskBg() }]}>
          <Text style={styles.riskLabel}>RISK SCORE</Text>
          <Text style={[styles.riskScore, { color: getRiskColor() }]}>{riskScore}</Text>
          <Text style={[styles.riskLevel, { color: getRiskColor() }]}>
            {riskLevel.toUpperCase()}
          </Text>
          {isInZone && (
            <View style={styles.zoneBadge}>
              <Text style={styles.zoneText}>⚠️ ISOLATED ZONE: {zoneName}</Text>
            </View>
          )}
        </View>

        {/* Sensor Data */}
        <View style={styles.sensorCard}>
          <Text style={styles.cardTitle}>📡 Live Sensor Data</Text>
          <Text style={styles.motionBig}>{motionLabel}</Text>
          <View style={styles.sensorGrid}>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>X</Text>
              <Text style={styles.sensorValue}>{sensorData.accelX || '0.000'}</Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Y</Text>
              <Text style={styles.sensorValue}>{sensorData.accelY || '0.000'}</Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Z</Text>
              <Text style={styles.sensorValue}>{sensorData.accelZ || '0.000'}</Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>|G|</Text>
              <Text style={styles.sensorValue}>{sensorData.magnitude || '0.00'}</Text>
            </View>
          </View>
          {sensorData.shakeCount > 0 && (
            <Text style={styles.shakeWarning}>
              🫨 Shakes: {sensorData.shakeCount}/3
            </Text>
          )}
        </View>

        {/* Scoring Breakdown */}
        {factors.length > 0 && (
          <View style={styles.factorsCard}>
            <Text style={styles.cardTitle}>📊 Score Breakdown</Text>
            {factors.map((f, i) => (
              <View key={i} style={styles.factorRow}>
                <Text style={styles.factorName}>{f.factor}</Text>
                <View style={styles.factorBar}>
                  <View style={[styles.factorFill, {
                    width: `${f.raw_score}%`,
                    backgroundColor: f.raw_score > 60 ? '#ef4444' : f.raw_score > 30 ? '#f59e0b' : '#22c55e'
                  }]} />
                </View>
                <Text style={styles.factorScore}>{f.weighted_score}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownTitle}>⏱️ Alert in</Text>
            <Text style={styles.countdownNumber}>{countdown}s</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelCountdown}>
              <Text style={styles.cancelText}>CANCEL (I'm Safe)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Location */}
        {location && (
          <View style={styles.locationCard}>
            <Text style={styles.cardTitle}>📍 Location</Text>
            <Text style={styles.locationText}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Text>
            {stations.length > 0 && (
              <Text style={styles.stationText}>
                🏛️ Nearest: {stations[0].name} ({stations[0].distance_km}km)
              </Text>
            )}
          </View>
        )}

        {/* Log */}
        <View style={styles.logCard}>
          <Text style={styles.cardTitle}>📋 Activity Log</Text>
          {log.slice(0, 15).map((entry, i) => (
            <Text key={i} style={styles.logEntry}>{entry}</Text>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomBar}>
        {!isMonitoring ? (
          <TouchableOpacity style={styles.startBtn} onPress={startMonitoring}>
            <Text style={styles.startText}>▶ START PROTECTION</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            {alertActive ? (
              <TouchableOpacity style={styles.safeBtn} onPress={confirmSafe}>
                <Text style={styles.safeBtnText}>✅ I'M SAFE</Text>
              </TouchableOpacity>
            ) : (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity style={styles.sosBtn} onPress={manualSOS}>
                  <Text style={styles.sosText}>SOS</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
            <TouchableOpacity style={styles.stopBtn} onPress={stopMonitoring}>
              <Text style={styles.stopText}>⏹ STOP</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0523' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#4c1d95',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  connDot: { width: 12, height: 12, borderRadius: 6 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  riskCard: {
    borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: '#e5e7eb',
  },
  riskLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 2 },
  riskScore: { fontSize: 72, fontWeight: '900', marginVertical: 4 },
  riskLevel: { fontSize: 18, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  zoneBadge: {
    marginTop: 12, backgroundColor: '#fef2f2', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#fca5a5',
  },
  zoneText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },

  sensorCard: {
    backgroundColor: '#1e1145', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  cardTitle: { color: '#a78bfa', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  motionBig: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  sensorGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  sensorItem: { alignItems: 'center' },
  sensorLabel: { color: '#8b5cf6', fontSize: 11, fontWeight: '700' },
  sensorValue: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: 'monospace' },
  shakeWarning: {
    color: '#f59e0b', fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 10,
  },

  factorsCard: { backgroundColor: '#1e1145', borderRadius: 16, padding: 16, marginBottom: 16 },
  factorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  factorName: { color: '#d4d4d8', fontSize: 12, width: 65, fontWeight: '600' },
  factorBar: {
    flex: 1, height: 8, backgroundColor: '#27272a', borderRadius: 4, marginHorizontal: 8,
  },
  factorFill: { height: '100%', borderRadius: 4 },
  factorScore: { color: '#fff', fontSize: 12, width: 35, textAlign: 'right', fontWeight: '700' },

  countdownCard: {
    backgroundColor: '#7f1d1d', borderRadius: 20, padding: 30, alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: '#ef4444',
  },
  countdownTitle: { color: '#fca5a5', fontSize: 16, fontWeight: '700' },
  countdownNumber: { color: '#fff', fontSize: 64, fontWeight: '900' },
  cancelBtn: {
    marginTop: 16, backgroundColor: '#22c55e', paddingHorizontal: 30, paddingVertical: 14,
    borderRadius: 12,
  },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  locationCard: { backgroundColor: '#1e1145', borderRadius: 16, padding: 16, marginBottom: 16 },
  locationText: { color: '#d4d4d8', fontSize: 13, fontFamily: 'monospace' },
  stationText: { color: '#a78bfa', fontSize: 13, marginTop: 6, fontWeight: '600' },

  logCard: { backgroundColor: '#1e1145', borderRadius: 16, padding: 16, marginBottom: 16 },
  logEntry: { color: '#a1a1aa', fontSize: 11, marginBottom: 3, fontFamily: 'monospace' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1e1145', paddingHorizontal: 20, paddingVertical: 16,
    paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#2e2060',
  },
  startBtn: {
    backgroundColor: '#7c3aed', paddingVertical: 18, borderRadius: 16, alignItems: 'center',
  },
  startText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  sosBtn: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  sosText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  stopBtn: {
    backgroundColor: '#27272a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
  },
  stopText: { color: '#a1a1aa', fontSize: 14, fontWeight: '700' },
  safeBtn: {
    backgroundColor: '#22c55e', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 16,
  },
  safeBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
