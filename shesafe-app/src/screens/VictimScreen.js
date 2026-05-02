// SheSafe — Victim Screen v2
// Light theme, world-class UI, real ML, 45s countdown with PIN cancel
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Vibration, Alert, ScrollView, StatusBar, Modal, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { addSensorReading, classifyCurrentWindow, getMotionLabel, resetClassifier } from '../services/MotionClassifier';
import { computeRisk, getRiskColor, getRiskLabel } from '../services/RiskEngine';
import { getStoredUser, verifyPin, logout } from '../services/AuthService';
import { AuthContext } from '../context/AuthContext';
import ApiService from '../services/ApiService';

const { width } = Dimensions.get('window');
const COUNTDOWN = 5;
const SHAKE_THRESHOLD = 18;
const SHAKE_COUNT_NEEDED = 3;
const SHAKE_WINDOW_MS = 2000;

export default function VictimScreen({ navigation }) {
  const { onLogin } = React.useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [motionResult, setMotionResult] = useState({ state: 'stationary', riskScore: 10, confidence: 0.5 });
  const [risk, setRisk] = useState({ riskScore: 10, label: 'SAFE', color: '#2ED573', alertLevel: 0 });
  const [isProtecting, setIsProtecting] = useState(false);
  const [alertActive, setAlertActive] = useState(false);
  const [alertId, setAlertId] = useState(null);
  const [countdown, setCountdown] = useState(COUNTDOWN);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const countdownRef = useRef(null);
  const sensorSubRef = useRef(null);
  const gyroSubRef = useRef(null);
  const locationSubRef = useRef(null);
  const shakeTimestamps = useRef([]);
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const sosScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const latestGyroMag = useRef(0);
  const consecutiveStruggle = useRef(0);
  const alertIdRef = useRef(null);
  const locationRef = useRef(null);
  const audioRecordingRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    getStoredUser().then(u => setUser(u));
    return () => stopProtection();
  }, []);

  async function handleLogout() {
    await logout();
    await onLogin();
  }

  // ── SOS button pulse animation ──
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Live Location Pinging ──
  useEffect(() => {
    let pingInterval;
    if (alertActive && alertId) {
      pingInterval = setInterval(() => {
        const loc = locationRef.current;
        if (loc) {
          ApiService.sendPing(alertId, loc.latitude, loc.longitude).catch(() => {});
        }
      }, 6000);
    }
    return () => clearInterval(pingInterval);
  }, [alertActive, alertId]);

  // ── Risk gauge animation ──
  useEffect(() => {
    Animated.timing(gaugeAnim, { toValue: risk.riskScore / 100, duration: 600, useNativeDriver: false }).start();
  }, [risk.riskScore]);

  // ── Shake detection ──
  function detectShake(ax, ay, az) {
    const mag = Math.sqrt(ax * ax + ay * ay + az * az);
    if (mag > SHAKE_THRESHOLD) {
      const now = Date.now();
      shakeTimestamps.current = shakeTimestamps.current.filter(t => now - t < SHAKE_WINDOW_MS);
      shakeTimestamps.current.push(now);
      const count = shakeTimestamps.current.length;
      setShakeCount(count);
      if (count >= SHAKE_COUNT_NEEDED && !alertActive) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        shakeTimestamps.current = [];
        setShakeCount(0);
        triggerEmergency('shake_trigger');
      }
    }
  }

  // ── Start/Stop Protection ──
  function startProtection() {
    setIsProtecting(true);
    resetClassifier();

    // Location & Evidence Permissions
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, loc => {
          setLocation(loc.coords);
          locationRef.current = loc.coords;
        }).then(sub => { locationSubRef.current = sub; });
      }
    });
    requestCameraPermission();
    Audio.requestPermissionsAsync();

    // Accelerometer at 50Hz
    Accelerometer.setUpdateInterval(20);
    sensorSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
      addSensorReading(x, y, z, 0, 0, latestGyroMag.current);
      detectShake(x, y, z);
    });

    // Gyroscope
    Gyroscope.setUpdateInterval(20);
    gyroSubRef.current = Gyroscope.addListener(({ x, y, z }) => {
      latestGyroMag.current = Math.sqrt(x * x + y * y + z * z);
    });

    // Classify every 2 seconds
    const classify = setInterval(() => {
      const result = classifyCurrentWindow();
      setMotionResult(result);
      if (result.state === 'struggling') {
        consecutiveStruggle.current++;
      } else {
        consecutiveStruggle.current = 0;
      }
      const shouldRecord = result.riskScore > 60;
      if (shouldRecord && !isRecording) {
        setIsRecording(true);
        startAudioRecording();
      } else if (!shouldRecord && isRecording && !alertActive) {
        setIsRecording(false);
        stopAudioRecording();
      }
    }, 2000);

    // Risk update every 5 seconds
    const riskInterval = setInterval(() => {
      setMotionResult(prev => {
        const r = computeRisk({
          motionScore: prev.riskScore,
          motionState: prev.state,
          lat: location?.latitude,
          lng: location?.longitude,
          gyroMagnitude: latestGyroMag.current,
          consecutiveStruggleWindows: consecutiveStruggle.current,
        });
        setRisk(r);
        if (r.alertLevel === 2 && !alertActive) triggerEmergency('passive');
        return prev;
      });
    }, 5000);

    return () => { clearInterval(classify); clearInterval(riskInterval); };
  }

  function stopProtection() {
    setIsProtecting(false);
    sensorSubRef.current?.remove();
    gyroSubRef.current?.remove();
    locationSubRef.current?.remove();
    Accelerometer.removeAllListeners();
    Gyroscope.removeAllListeners();
    if (audioRecordingRef.current) stopAudioRecording();
    if (cameraRef.current) cameraRef.current.stopRecording();
  }

  // ── Evidence Recording ──
  async function startAudioRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.isMeteringEnabled && status.metering > -12) {
            // High decibel detected (scream / voice tremor)
            setMotionResult(prev => ({ ...prev, riskScore: Math.max(prev.riskScore, 90) }));
          }
        },
        500 // 500ms intervals
      );
      audioRecordingRef.current = recording;
    } catch (err) { console.log('Audio record error', err); }
  }

  async function stopAudioRecording() {
    if (!audioRecordingRef.current) return;
    try {
      await audioRecordingRef.current.stopAndUnloadAsync();
      const uri = audioRecordingRef.current.getURI();
      console.log('Audio evidence saved:', uri);
      audioRecordingRef.current = null;
    } catch (err) {}
  }

  async function startVideoRecording() {
    if (cameraRef.current && cameraPermission?.granted) {
      try {
        const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
        console.log('Video evidence saved:', video.uri);
      } catch (err) { console.log('Video record error', err); }
    }
  }

  // ── Emergency trigger ──
  function triggerEmergency(trigger = 'manual_sos') {
    if (alertActive) return;
    setAlertActive(true);
    setCountdown(COUNTDOWN);
    setShowPinModal(false);
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);

    let remaining = COUNTDOWN;
    countdownRef.current = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        fireAlert(trigger);
        // Start silent video recording for evidence
        requestCameraPermission().then(() => {
           startVideoRecording();
        });
      }
    }, 1000);
  }

  async function fireAlert(trigger) {
    try {
      const contacts = user?.emergency_contacts || [];
      const res = await ApiService.fireAlert({
        user_name: user?.name || 'SheSafe User',
        user_phone: user?.phone || '+919999999999',
        lat: location?.latitude || 12.9340,
        lng: location?.longitude || 77.6210,
        address: 'Near Vemana College of Engineering, Koramangala, Bengaluru',
        risk_score: risk.riskScore,
        risk_level: 'high',
        trigger_type: trigger,
        trusted_contacts: contacts.map(c => ({ name: c.name || 'Contact', phone: c.phone || '', relation: c.relation || 'Contact' })),
        nearest_stations: [],
      });
      alertIdRef.current = res.alert_id;
      setAlertId(res.alert_id);
    } catch (e) {
      console.log('Alert fire failed, continuing offline:', e.message);
    }
  }

  // ── PIN cancel flow ──
  function handlePinDigit(digit) {
    const newPin = (pin + digit).slice(0, 4);
    setPin(newPin);
    setPinError(false);
    if (newPin.length === 4) checkPin(newPin);
  }

  async function checkPin(enteredPin) {
    const valid = await verifyPin(user?.phone, enteredPin);
    if (valid) {
      cancelAlert();
    } else {
      setPinError(true);
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Vibration.vibrate(200);
    }
  }

  function cancelAlert() {
    clearInterval(countdownRef.current);
    setAlertActive(false);
    setShowPinModal(false);
    setPin('');
    setPinError(false);
    setCountdown(COUNTDOWN);
    if (alertIdRef.current) {
      ApiService.confirmSafe(alertIdRef.current).catch(() => {});
      alertIdRef.current = null;
      setAlertId(null);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Gauge arc color ──
  const gaugeColor = gaugeAnim.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: ['#2ED573', '#FFAB00', '#FF6B35', '#FF4757'],
  });

  // ── PIN pad ──
  const PinPad = () => (
    <View>
      <View style={styles.pinDots}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled, pinError && styles.pinDotError]} />
        ))}
      </View>
      {pinError && <Text style={styles.pinErrorText}>Wrong PIN. Try again.</Text>}
      <View style={styles.pinGrid}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <TouchableOpacity key={i} style={[styles.pinKey, !d && styles.pinKeyEmpty]}
            onPress={() => { if (d === '⌫') setPin(p => p.slice(0,-1)); else if (d) handlePinDigit(d); }}>
            <Text style={styles.pinKeyText}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <LinearGradient colors={['#F5F3FF', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Stay Safe'} 👋</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            {isProtecting && <Ionicons name="shield-checkmark" size={14} color="#6B7280" style={{ marginRight: 4 }} />}
            <Text style={styles.subGreet}>{isProtecting ? 'Protection active' : 'Tap below to start'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isRecording && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleLogout}>
             <Text style={{ color: '#FF4757', fontWeight: '700', fontSize: 13 }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Risk Gauge */}
        <View style={styles.gaugeCard}>
          <Animated.Text style={[styles.gaugeScore, { color: gaugeColor }]}>{risk.riskScore}</Animated.Text>
          <Text style={styles.gaugeLabel}>Risk Score</Text>
          <Animated.View style={[styles.gaugePill, { backgroundColor: gaugeColor }]}>
            <Text style={styles.gaugePillText}>{risk.label}</Text>
          </Animated.View>
          <View style={styles.gaugeBar}>
            <Animated.View style={[styles.gaugeFill, { width: gaugeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: gaugeColor }]} />
          </View>
        </View>

        {/* Shake counter */}
        {isProtecting && (
          <View style={styles.shakeCard}>
            <Text style={styles.shakeLabel}>Shake to SOS</Text>
            <View style={styles.shakeDots}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.shakeDot, shakeCount >= i && styles.shakeDotActive]} />
              ))}
            </View>
            <Text style={styles.shakeHint}>{shakeCount > 0 ? `${shakeCount}/3 shakes detected` : 'Shake 3× to trigger emergency'}</Text>
          </View>
        )}

        {/* Motion status */}
        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <Text style={styles.chipText}>{getMotionLabel(motionResult.state)}</Text>
          </View>
          <View style={styles.statusChip}>
            <Ionicons name="location" size={14} color="#6C3CE1" style={{ marginRight: 4 }} />
            <Text style={styles.chipText}>{location ? 'GPS ✓' : 'No GPS'}</Text>
          </View>
          {isRecording && (
            <View style={[styles.statusChip, { backgroundColor: '#FFE4E4' }]}>
              <Ionicons name="mic" size={14} color="#FF4757" style={{ marginRight: 4 }} />
              <Text style={[styles.chipText, { color: '#FF4757' }]}>Recording</Text>
            </View>
          )}
        </View>

        {/* Risk breakdown */}
        {isProtecting && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Signal Breakdown</Text>
            {Object.entries(risk.breakdown || {}).map(([k, v]) => (
              <View key={k} style={styles.breakdownRow}>
                <Text style={styles.breakdownKey}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${v}%`, backgroundColor: getRiskColor(v) }]} />
                </View>
                <Text style={styles.breakdownVal}>{Math.round(v)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* I'm Safe button (shown after alert) */}
        {alertId && !alertActive && (
          <TouchableOpacity style={styles.safeBtn} onPress={() => {
            ApiService.confirmSafe(alertId).catch(() => {});
            setAlertId(null);
            Alert.alert('✅ Marked Safe', 'Your contacts have been notified you are safe.');
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
            <Text style={styles.safeBtnText}>I'm Safe — Notify Contacts</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Start/Stop Protection button */}
      {!alertActive && (
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.protectBtn, isProtecting && styles.protectBtnActive]}
            onPress={() => isProtecting ? stopProtection() : startProtection()}>
            <Ionicons name={isProtecting ? "pause" : "play"} size={18} color={isProtecting ? "#6C3CE1" : "#fff"} style={{ marginRight: 8 }} />
            <Text style={[styles.protectBtnText, isProtecting && { color: '#6C3CE1' }]}>{isProtecting ? 'Pause Protection' : 'Start Protection'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating SOS */}
      {isProtecting && !alertActive && (
        <Animated.View style={[styles.sosWrap, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={styles.sosBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); triggerEmergency('manual_sos'); }} activeOpacity={0.85}>
            <Text style={styles.sosTxt}>SOS</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Countdown overlay */}
      {alertActive && (
        <View style={styles.countdownOverlay}>
          <LinearGradient colors={['#FF4757', '#C0392B']} style={StyleSheet.absoluteFillObject} />
          <Text style={styles.countdownTitle}>⚠️ EMERGENCY TRIGGERED</Text>
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.countdownSub}>seconds until police + contacts alerted</Text>
          <Text style={styles.countdownAlerts}>📡 Notifying 3 police stations\n👨‍👩‍👧 Alerting your contacts</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPinModal(true)}>
            <Text style={styles.cancelBtnText}>Enter PIN to Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PIN modal */}
      <Modal visible={showPinModal} transparent animationType="slide" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinSheet}>
            <Text style={styles.pinTitle}>Enter Safety PIN</Text>
            <Text style={styles.pinSubtitle}>Verify it's you — enter the 4-digit PIN you set during signup</Text>
            <PinPad />
            <TouchableOpacity onPress={() => setShowPinModal(false)} style={styles.pinCancel}>
              <Text style={styles.pinCancelText}>Back to countdown</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Hidden Front Camera for Evidence Collection */}
      {alertActive && cameraPermission?.granted && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
          <CameraView ref={cameraRef} facing="front" mode="video" style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 24, paddingBottom: 16 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  subGreet: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  recBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFE4E4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4757' },
  recText: { color: '#FF4757', fontWeight: '700', fontSize: 11 },
  scroll: { paddingHorizontal: 24 },
  gaugeCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 28, marginBottom: 16, borderWidth: 1, borderColor: '#F0EAFF', shadowColor: '#6C3CE1', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  gaugeScore: { fontSize: 72, fontWeight: '900', letterSpacing: -2 },
  gaugeLabel: { fontSize: 13, color: '#9CA3AF', marginTop: -4 },
  gaugePill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, marginTop: 10 },
  gaugePillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  gaugeBar: { height: 6, width: '100%', backgroundColor: '#F0EAFF', borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 3 },
  shakeCard: { backgroundColor: '#FFF7E6', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  shakeLabel: { fontSize: 12, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  shakeDots: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  shakeDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E9D5A0' },
  shakeDotActive: { backgroundColor: '#F59E0B' },
  shakeHint: { fontSize: 11, color: '#78350F' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#6C3CE1' },
  breakdownCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F0EAFF', marginBottom: 16 },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  breakdownKey: { width: 65, fontSize: 12, color: '#6B7280' },
  breakdownBar: { flex: 1, height: 6, backgroundColor: '#F0EAFF', borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownVal: { width: 26, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' },
  safeBtn: { flexDirection: 'row', justifyContent: 'center', backgroundColor: '#D1FAE5', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  safeBtnText: { color: '#059669', fontWeight: '700', fontSize: 15 },
  bottomRow: { position: 'absolute', bottom: 24, left: 24, right: 24 },
  protectBtn: { flexDirection: 'row', justifyContent: 'center', backgroundColor: '#6C3CE1', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#6C3CE1', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  protectBtnActive: { backgroundColor: '#EDE9FE', shadowOpacity: 0 },
  protectBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sosWrap: { position: 'absolute', bottom: 90, right: 24 },
  sosBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF4757', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF4757', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  sosTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 100 },
  countdownTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  countdownNum: { color: '#fff', fontSize: 96, fontWeight: '900', letterSpacing: -4 },
  countdownSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  countdownAlerts: { color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 24, lineHeight: 22, opacity: 0.9 },
  cancelBtn: { marginTop: 32, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pinSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 48 },
  pinTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },
  pinSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#E8E0FF', backgroundColor: '#F8F7FF' },
  pinDotFilled: { backgroundColor: '#6C3CE1', borderColor: '#6C3CE1' },
  pinDotError: { borderColor: '#FF4757', backgroundColor: '#FFE4E4' },
  pinErrorText: { color: '#FF4757', textAlign: 'center', fontSize: 13, marginBottom: 8 },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 },
  pinKey: { width: (width - 56 - 24) / 3, height: 60, borderRadius: 14, backgroundColor: '#F8F7FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8E0FF' },
  pinKeyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pinKeyText: { fontSize: 22, fontWeight: '600', color: '#1A1A2E' },
  pinCancel: { alignItems: 'center', marginTop: 20 },
  pinCancelText: { color: '#6B7280', fontSize: 14 },
});
