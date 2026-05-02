// SheSafe — Police Dashboard Screen v3
// Fixed: map no longer exits app, loud siren on alert, logs + recipients visible
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Linking, RefreshControl, StatusBar, Animated, Vibration, ScrollView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { getStoredUser, logout } from '../services/AuthService';
import { AuthContext } from '../context/AuthContext';
import ApiService from '../services/ApiService';

const POLL_MS = 5000; // poll every 5s for faster response

function RiskBadge({ score }) {
  const color = score >= 80 ? '#FF4757' : score >= 60 ? '#FF6B35' : score >= 40 ? '#FFAB00' : '#2ED573';
  const label = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MED' : 'LOW';
  return <View style={[styles.riskBadge, { backgroundColor: color + '20' }]}><Text style={[styles.riskBadgeText, { color }]}>{label} {score}</Text></View>;
}

function AlertCard({ alert, onRespond }) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
  }, []);

  const timeSince = (ts) => {
    const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  };

  const policeRecipients = (alert.recipients || []).filter(r => r.type === 'police');
  const contactRecipients = (alert.recipients || []).filter(r => r.type === 'contact');

  return (
    <Animated.View style={[styles.alertCard, alert.is_safe && styles.alertCardSafe, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.alertTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.alertNameRow}>
            <Text style={styles.alertName}>{alert.user_name}</Text>
            <RiskBadge score={alert.risk_score} />
          </View>
          <Text style={styles.alertPhone}>{alert.user_phone}</Text>
        </View>
        {alert.is_safe && <View style={styles.safePill}><Text style={styles.safePillText}>✓ Safe</Text></View>}
      </View>

      <View style={styles.alertMeta}>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={12} color="#374151" />
          <Text style={styles.alertAddr} numberOfLines={1}>{alert.address || `${alert.lat?.toFixed(4)}, ${alert.lng?.toFixed(4)}`}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time" size={12} color="#6B7280" />
          <Text style={styles.alertTime}>{timeSince(alert.timestamp)} • {alert.trigger_type?.toUpperCase()}</Text>
        </View>
        {alert.total_pings > 0 && (
          <View style={styles.metaRow}>
            <Ionicons name="radio" size={12} color="#1D4ED8" />
            <Text style={styles.alertPings}>{alert.total_pings} location updates received</Text>
          </View>
        )}
      </View>

      {/* Notification Log */}
      {(policeRecipients.length > 0 || contactRecipients.length > 0) && (
        <View style={styles.logBox}>
          <Text style={styles.logTitle}>📋 Dispatch Log</Text>
          {policeRecipients.map((r, i) => (
            <View key={i} style={styles.logRow}>
              <Ionicons name="business" size={11} color="#1D4ED8" />
              <Text style={styles.logText}>{r.name} — <Text style={{ color: 'sent' in r.sms_status ? '#059669' : '#FF4757' }}>{r.sms_status}</Text></Text>
            </View>
          ))}
          {contactRecipients.map((r, i) => (
            <View key={i} style={styles.logRow}>
              <Ionicons name="person" size={11} color="#6C3CE1" />
              <Text style={styles.logText}>{r.name} ({r.phone}) — <Text style={{ color: r.sms_status?.includes('sent') ? '#059669' : '#FF4757' }}>{r.sms_status}</Text></Text>
            </View>
          ))}
        </View>
      )}

      {/* Evidence Files */}
      {alert.evidence_urls?.length > 0 && (
        <View style={styles.evidenceBox}>
          <Text style={styles.logTitle}>🎥 Evidence Files ({alert.evidence_urls.length})</Text>
          {alert.evidence_urls.map((ev, i) => {
            const isDemo = ev.url?.startsWith('DEMO://');
            const sizeKB = ev.size_bytes ? `${(ev.size_bytes / 1024).toFixed(0)} KB` : '';
            return (
              <TouchableOpacity
                key={i}
                style={[styles.evidenceRow, isDemo && { opacity: 0.5 }]}
                onPress={() => !isDemo && Linking.openURL(ev.url)}
                disabled={isDemo}
              >
                <Ionicons
                  name={ev.type === 'audio' ? 'mic' : 'videocam'}
                  size={16}
                  color={ev.type === 'audio' ? '#6C3CE1' : '#1D4ED8'}
                />
                <Text style={styles.evidenceText}>
                  {ev.type === 'audio' ? '🎤 Audio Recording' : '🎥 Video Recording'}
                  {sizeKB ? `  •  ${sizeKB}` : ''}
                </Text>
                {!isDemo && (
                  <Ionicons name="open-outline" size={14} color="#6B7280" />
                )}
                {isDemo && <Text style={styles.demoTag}>DEMO</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!alert.is_safe && (
        <View style={styles.alertActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${alert.user_phone}`)}>
            <Ionicons name="call" size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
            <Text style={styles.callBtnText}>Call Victim</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(alert.maps_link || `https://maps.google.com/?q=${alert.lat},${alert.lng}`)}>
            <Ionicons name="navigate" size={14} color="#6C3CE1" style={{ marginRight: 4 }} />
            <Text style={styles.mapBtnText}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond(alert)}>
            <Ionicons name="checkmark-done" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.respondBtnText}>Responding</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

export default function PoliceScreen() {
  const { onLogin } = React.useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const pollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sirenRef = useRef(null);
  const wasAlertingRef = useRef(false);

  useEffect(() => {
    getStoredUser().then(setUser);
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, POLL_MS);
    Audio.requestPermissionsAsync();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      clearInterval(pollRef.current);
      pulse.stop();
      Vibration.cancel();
      stopSiren();
    };
  }, []);

  async function playSiren() {
    try {
      if (sirenRef.current) return;
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        allowsRecordingIOS: false,
      });
      // Use a reliable public emergency tone (Google's public sound library)
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      sirenRef.current = sound;
    } catch (e) {
      console.log('Siren audio failed, using vibration only:', e.message);
      // Vibration is already running as fallback — no crash
      sirenRef.current = null;
    }
  }

  async function stopSiren() {
    if (sirenRef.current) {
      try {
        await sirenRef.current.stopAsync();
        await sirenRef.current.unloadAsync();
      } catch {}
      sirenRef.current = null;
    }
  }

  async function handleLogout() {
    await logout();
    await onLogin();
  }

  async function fetchAlerts() {
    try {
      const data = await ApiService.ping();
      if (data?.active_alerts?.length > 0) {
        const details = await Promise.all(
          data.active_alerts.map(id => ApiService.getAlertStatus(id).catch(() => null))
        );
        const validAlerts = details.filter(Boolean).sort((a, b) => b.risk_score - a.risk_score);
        setAlerts(validAlerts);

        const hasActive = validAlerts.some(a => !a.is_safe);
        if (hasActive) {
          Vibration.vibrate([0, 600, 200, 600], true);
          if (!wasAlertingRef.current) {
            wasAlertingRef.current = true;
            playSiren();
          }
        } else {
          Vibration.cancel();
          if (wasAlertingRef.current) {
            wasAlertingRef.current = false;
            stopSiren();
          }
        }
      } else {
        setAlerts([]);
        Vibration.cancel();
        if (wasAlertingRef.current) {
          wasAlertingRef.current = false;
          stopSiren();
        }
      }
      setLastUpdate(new Date());
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }

  function simulateAlert() {
    const demo = {
      alert_id: 'DEMO_001',
      user_name: 'Priya Sharma',
      user_phone: '+919876543210',
      lat: 12.9340, lng: 77.6210,
      address: 'Near Vemana College of Engineering, Koramangala, Bengaluru',
      risk_score: 87, risk_level: 'high',
      trigger_type: 'shake_trigger',
      timestamp: new Date().toISOString(),
      maps_link: 'https://maps.google.com/?q=12.9340,77.6210',
      is_safe: false, total_pings: 3,
      recipients: [
        { name: 'Koramangala Police Station', phone: '+918022951000', type: 'police', sms_status: 'sent_demo' },
        { name: 'HSR Layout Police Station',  phone: '+918022571060', type: 'police', sms_status: 'sent_demo' },
        { name: 'Radha Sharma',               phone: '+919876543211', type: 'contact', sms_status: 'sent_demo' },
      ],
    };
    setAlerts([demo]);
    playSiren();
    Vibration.vibrate([0, 600, 200, 600], true);
  }

  const activeAlerts = alerts.filter(a => !a.is_safe);
  const resolvedAlerts = alerts.filter(a => a.is_safe);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <LinearGradient colors={['#EFF6FF', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="business" size={20} color="#1A1A2E" style={{ marginRight: 6 }} />
            <Text style={styles.title}>Police Dashboard</Text>
          </View>
          <Text style={styles.subtitle}>{user?.station_name || 'Alert Monitor'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={styles.headerRight}>
            <View style={[styles.dot, { backgroundColor: activeAlerts.length > 0 ? '#FF4757' : '#2ED573' }]} />
            <Text style={styles.dotLabel}>{activeAlerts.length > 0 ? 'ACTIVE' : 'CLEAR'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={{ color: '#FF4757', fontWeight: '700', fontSize: 13 }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#FFE4E4' }]}>
          <Text style={[styles.statNum, { color: '#FF4757' }]}>{activeAlerts.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.statNum, { color: '#059669' }]}>{resolvedAlerts.length}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.statNum, { color: '#1D4ED8', fontSize: 14 }]}>
            {lastUpdate ? lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
          </Text>
          <Text style={styles.statLabel}>Updated</Text>
        </View>
      </View>

      {/* View Toggle */}
      <View style={styles.toggleWrap}>
        <TouchableOpacity style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]} onPress={() => setViewMode('list')}>
          <Ionicons name="list" size={14} color={viewMode === 'list' ? '#fff' : '#1D4ED8'} style={{ marginRight: 6 }} />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]} onPress={() => setViewMode('map')}>
          <Ionicons name="map" size={14} color={viewMode === 'map' ? '#fff' : '#1D4ED8'} style={{ marginRight: 6 }} />
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Live Map</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={alerts}
          keyExtractor={a => a.alert_id}
          renderItem={({ item }) => <AlertCard alert={item} onRespond={() => {}} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark" size={56} color="#E8E0FF" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>All Clear</Text>
              <Text style={styles.emptyText}>No active alerts. Monitoring in progress.</Text>
              <TouchableOpacity style={styles.demoBtn} onPress={simulateAlert}>
                <Ionicons name="play" size={14} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.demoBtnText}>Simulate Incoming Alert</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        />
      ) : (
        <View style={styles.mapContainer}>
          {/* Map — scrollEnabled=false prevents touch from escaping to Google Maps app */}
          <MapView
            provider={PROVIDER_DEFAULT}
            style={StyleSheet.absoluteFillObject}
            scrollEnabled={false}
            zoomEnabled={true}
            pitchEnabled={false}
            rotateEnabled={false}
            toolbarEnabled={false}
            initialRegion={{
              latitude: activeAlerts[0]?.lat || 12.9340,
              longitude: activeAlerts[0]?.lng || 77.6210,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            {activeAlerts.map(alert => (
              <Marker
                key={alert.alert_id}
                coordinate={{ latitude: alert.lat, longitude: alert.lng }}
                tracksViewChanges={false}
              >
                <View style={styles.markerWrap}>
                  <Animated.View style={[styles.markerRing, { transform: [{ scale: pulseAnim }], backgroundColor: alert.risk_score >= 80 ? '#FF475760' : '#FFAB0060' }]} />
                  <View style={[styles.markerCore, { backgroundColor: alert.risk_score >= 80 ? '#FF4757' : '#FFAB00' }]} />
                </View>
                <Callout tooltip onPress={() => {}}>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>{alert.user_name}</Text>
                    <Text style={styles.calloutRisk}>Risk: {alert.risk_score}</Text>
                    <Text style={styles.calloutAddr} numberOfLines={2}>{alert.address}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          {activeAlerts.length === 0 && (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyText}>No active alerts on map</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  headerRight: { alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLabel: { fontSize: 9, fontWeight: '700', color: '#6B7280', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  alertCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: '#E8E0FF', shadowColor: '#1D4ED8', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  alertCardSafe: { borderColor: '#BBF7D0', opacity: 0.7 },
  alertTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  alertNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  alertName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  alertPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  safePill: { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  safePillText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  riskBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  riskBadgeText: { fontSize: 11, fontWeight: '800' },
  alertMeta: { gap: 6, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertAddr: { flex: 1, fontSize: 13, color: '#374151' },
  alertTime: { flex: 1, fontSize: 12, color: '#6B7280' },
  alertPings: { flex: 1, fontSize: 12, color: '#1D4ED8' },
  logBox: { backgroundColor: '#F8FAFF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E8F0FF' },
  logTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  logText: { fontSize: 11, color: '#6B7280', flex: 1 },
  evidenceBox: { backgroundColor: '#FFF7F7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFE4E4' },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFE4E4' },
  evidenceText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#374151' },
  demoTag: { fontSize: 9, fontWeight: '800', color: '#9CA3AF', backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },

  alertActions: { flexDirection: 'row', gap: 8 },
  callBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  callBtnText: { color: '#1D4ED8', fontWeight: '600', fontSize: 12 },
  mapBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  mapBtnText: { color: '#6C3CE1', fontWeight: '600', fontSize: 12 },
  respondBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#1D4ED8', borderRadius: 10, padding: 10, alignItems: 'center' },
  respondBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  demoBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, backgroundColor: '#1D4ED8', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  toggleWrap: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#1D4ED8' },
  toggleText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  toggleTextActive: { color: '#fff' },
  mapContainer: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#EFF6FF' },
  mapEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFF' },
  mapEmptyText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  markerWrap: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48 },
  markerRing: { position: 'absolute', width: 48, height: 48, borderRadius: 24 },
  markerCore: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },
  calloutCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E8E0FF', width: 160, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  calloutTitle: { fontWeight: '800', fontSize: 13, color: '#1A1A2E' },
  calloutRisk: { fontSize: 11, color: '#FF4757', fontWeight: '700', marginTop: 2 },
  calloutAddr: { fontSize: 10, color: '#6B7280', marginTop: 4 },
});
