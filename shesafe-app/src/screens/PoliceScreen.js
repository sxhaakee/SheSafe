// SheSafe — Police Dashboard Screen
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getStoredUser, logout } from '../services/AuthService';
import { AuthContext } from '../context/AuthContext';
import ApiService from '../services/ApiService';

const POLL_MS = 8000;

function RiskBadge({ score }) {
  const color = score >= 80 ? '#FF4757' : score >= 60 ? '#FF6B35' : score >= 40 ? '#FFAB00' : '#2ED573';
  const label = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MED' : 'LOW';
  return <View style={[styles.riskBadge, { backgroundColor: color + '20' }]}><Text style={[styles.riskBadgeText, { color }]}>{label}</Text></View>;
}

function AlertCard({ alert, onRespond }) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  useEffect(() => { Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start(); }, []);

  const timeSince = (ts) => {
    const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  };

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
        <View style={styles.metaRow}><Ionicons name="location" size={12} color="#374151" /><Text style={styles.alertAddr} numberOfLines={1}>{alert.address || `${alert.lat?.toFixed(4)}, ${alert.lng?.toFixed(4)}`}</Text></View>
        <View style={styles.metaRow}><Ionicons name="time" size={12} color="#6B7280" /><Text style={styles.alertTime}>{timeSince(alert.timestamp)} • {alert.trigger_type?.toUpperCase()}</Text></View>
        {alert.total_pings > 0 && <View style={styles.metaRow}><Ionicons name="radio" size={12} color="#1D4ED8" /><Text style={styles.alertPings}>{alert.total_pings} location updates</Text></View>}
      </View>

      {!alert.is_safe && (
        <View style={styles.alertActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${alert.user_phone}`)}>
            <Ionicons name="call" size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
            <Text style={styles.callBtnText}>Call</Text>
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

  useEffect(() => {
    getStoredUser().then(setUser);
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, POLL_MS);
    
    // Start pulse animation for markers
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      clearInterval(pollRef.current);
      pulse.stop();
    };
  }, []);

  async function handleLogout() {
    await logout();
    await onLogin();
  }

  async function fetchAlerts() {
    try {
      const data = await ApiService.ping();
      if (data.active_alerts?.length > 0) {
        const details = await Promise.all(
          data.active_alerts.map(id => ApiService.getAlertStatus(id).catch(() => null))
        );
        setAlerts(details.filter(Boolean).sort((a, b) => b.risk_score - a.risk_score));
      } else {
        setAlerts([]);
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
    setAlerts([{
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
    }]);
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
          <Text style={[styles.statNum, { color: '#1D4ED8' }]}>{lastUpdate ? lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</Text>
          <Text style={styles.statLabel}>Updated</Text>
        </View>
      </View>

      {/* View Toggle */}
      <View style={styles.toggleWrap}>
        <TouchableOpacity style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]} onPress={() => setViewMode('list')}>
          <Ionicons name="list" size={14} color={viewMode === 'list' ? '#fff' : '#1D4ED8'} style={{ marginRight: 6 }} />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List View</Text>
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
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: alerts[0]?.lat || 12.9716,
              longitude: alerts[0]?.lng || 77.5946,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
          >
            {activeAlerts.map(alert => (
              <Marker
                key={alert.alert_id}
                coordinate={{ latitude: alert.lat, longitude: alert.lng }}
              >
                <View style={styles.markerWrap}>
                  <Animated.View style={[styles.markerRing, { transform: [{ scale: pulseAnim }], backgroundColor: alert.risk_score >= 80 ? '#FF475760' : '#FFAB0060' }]} />
                  <View style={[styles.markerCore, { backgroundColor: alert.risk_score >= 80 ? '#FF4757' : '#FFAB00' }]} />
                </View>
                <Callout tooltip>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle}>{alert.user_name}</Text>
                    <Text style={styles.calloutRisk}>Risk: {alert.risk_score}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
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
  alertNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  alertPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  safePill: { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  safePillText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  riskBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  riskBadgeText: { fontSize: 11, fontWeight: '800' },
  alertMeta: { gap: 6, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertAddr: { flex: 1, fontSize: 13, color: '#374151' },
  alertTime: { flex: 1, fontSize: 12, color: '#6B7280' },
  alertPings: { flex: 1, fontSize: 12, color: '#1D4ED8' },
  alertActions: { flexDirection: 'row', gap: 8 },
  callBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  callBtnText: { color: '#1D4ED8', fontWeight: '600', fontSize: 13 },
  mapBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  mapBtnText: { color: '#6C3CE1', fontWeight: '600', fontSize: 13 },
  respondBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#1D4ED8', borderRadius: 10, padding: 10, alignItems: 'center' },
  respondBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  demoBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, backgroundColor: '#1D4ED8', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  toggleWrap: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#1D4ED8' },
  toggleText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  toggleTextActive: { color: '#fff' },
  mapContainer: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: '#EFF6FF', shadowColor: '#1D4ED8', shadowOpacity: 0.15, shadowRadius: 20, elevation: 6 },
  markerWrap: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48 },
  markerRing: { position: 'absolute', width: 48, height: 48, borderRadius: 24 },
  markerCore: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 },
  calloutCard: { backgroundColor: '#fff', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E8E0FF', width: 120, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  calloutTitle: { fontWeight: '800', fontSize: 13, color: '#1A1A2E' },
  calloutRisk: { fontSize: 11, color: '#FF4757', fontWeight: '700', marginTop: 2 },
});
