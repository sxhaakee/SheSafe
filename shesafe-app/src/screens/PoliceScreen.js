// SheSafe — Police Dashboard Screen
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getStoredUser } from '../services/AuthService';
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
        <Text style={styles.alertAddr} numberOfLines={1}>📍 {alert.address || `${alert.lat?.toFixed(4)}, ${alert.lng?.toFixed(4)}`}</Text>
        <Text style={styles.alertTime}>🕐 {timeSince(alert.timestamp)} • {alert.trigger_type?.toUpperCase()}</Text>
        {alert.total_pings > 0 && <Text style={styles.alertPings}>📡 {alert.total_pings} location updates</Text>}
      </View>

      {!alert.is_safe && (
        <View style={styles.alertActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${alert.user_phone}`)}>
            <Text style={styles.callBtnText}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(alert.maps_link || `https://maps.google.com/?q=${alert.lat},${alert.lng}`)}>
            <Text style={styles.mapBtnText}>🗺️ Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond(alert)}>
            <Text style={styles.respondBtnText}>✓ Responding</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

export default function PoliceScreen() {
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    getStoredUser().then(setUser);
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

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
          <Text style={styles.title}>🏛️ Police Dashboard</Text>
          <Text style={styles.subtitle}>{user?.station_name || 'Alert Monitor'}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.dot, { backgroundColor: activeAlerts.length > 0 ? '#FF4757' : '#2ED573' }]} />
          <Text style={styles.dotLabel}>{activeAlerts.length > 0 ? 'ACTIVE' : 'CLEAR'}</Text>
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

      <FlatList
        data={alerts}
        keyExtractor={a => a.alert_id}
        renderItem={({ item }) => <AlertCard alert={item} onRespond={() => {}} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptyText}>No active alerts. Monitoring in progress.</Text>
            <TouchableOpacity style={styles.demoBtn} onPress={simulateAlert}>
              <Text style={styles.demoBtnText}>▶ Simulate Incoming Alert</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      />
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
  alertMeta: { gap: 4, marginBottom: 14 },
  alertAddr: { fontSize: 13, color: '#374151' },
  alertTime: { fontSize: 12, color: '#6B7280' },
  alertPings: { fontSize: 12, color: '#1D4ED8' },
  alertActions: { flexDirection: 'row', gap: 8 },
  callBtn: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  callBtnText: { color: '#1D4ED8', fontWeight: '600', fontSize: 13 },
  mapBtn: { flex: 1, backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10, alignItems: 'center' },
  mapBtnText: { color: '#6C3CE1', fontWeight: '600', fontSize: 13 },
  respondBtn: { flex: 1, backgroundColor: '#1D4ED8', borderRadius: 10, padding: 10, alignItems: 'center' },
  respondBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  demoBtn: { marginTop: 24, backgroundColor: '#1D4ED8', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
