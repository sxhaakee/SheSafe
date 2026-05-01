// SheSafe — Contact / Family Screen
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, RefreshControl, ScrollView, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getStoredUser } from '../services/AuthService';
import ApiService from '../services/ApiService';

const POLL_MS = 8000;

export default function ContactScreen() {
  const [user, setUser] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastPing, setLastPing] = useState(null);
  const pollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    getStoredUser().then(setUser);
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (activeAlert) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [activeAlert]);

  async function fetchAlerts() {
    try {
      const data = await ApiService.ping();
      if (data.active_alerts?.length > 0) {
        const detail = await ApiService.getAlertStatus(data.active_alerts[0]);
        setActiveAlert(detail);
        if (detail.location_pings?.length > 0) {
          setLastPing(detail.location_pings[detail.location_pings.length - 1]);
        }
      } else {
        setActiveAlert(null);
        setLastPing(null);
      }
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }

  function simulateAlert() {
    setActiveAlert({
      alert_id: 'DEMO_001',
      user_name: 'Priya Sharma',
      user_phone: '+919876543210',
      lat: 12.9340, lng: 77.6210,
      address: 'Near Vemana College of Engineering, Koramangala, Bengaluru',
      risk_score: 87, risk_level: 'high',
      trigger_type: 'shake_trigger',
      timestamp: new Date().toISOString(),
      maps_link: 'https://maps.google.com/?q=12.9340,77.6210',
      is_safe: false, total_pings: 5,
    });
  }

  const timeSince = (ts) => {
    if (!ts) return '--';
    const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  };

  const riskColor = (s) => s >= 80 ? '#FF4757' : s >= 60 ? '#FF6B35' : s >= 40 ? '#FFAB00' : '#2ED573';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <LinearGradient colors={['#F0FDF4', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <Text style={styles.title}>👨‍👩‍👧 Safety Dashboard</Text>
        <Text style={styles.subtitle}>{user?.name ? `Logged in as ${user.name}` : 'Trusted Contact'}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {activeAlert ? (
          <>
            {/* Alert banner */}
            <Animated.View style={[styles.alertBanner, { borderColor: riskColor(activeAlert.risk_score) + '60', transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={[riskColor(activeAlert.risk_score) + '15', riskColor(activeAlert.risk_score) + '05']} style={StyleSheet.absoluteFillObject} borderRadius={18} />
              <View style={styles.alertBannerTop}>
                <Text style={styles.alertBannerTitle}>⚠️ Emergency Alert Active</Text>
                <View style={[styles.riskPill, { backgroundColor: riskColor(activeAlert.risk_score) }]}>
                  <Text style={styles.riskPillText}>{activeAlert.risk_score}</Text>
                </View>
              </View>
              <Text style={styles.alertName}>{activeAlert.user_name}</Text>
              <Text style={styles.alertTime}>Triggered {timeSince(activeAlert.timestamp)} • {activeAlert.trigger_type?.replace('_', ' ').toUpperCase()}</Text>
            </Animated.View>

            {/* Location card */}
            <View style={styles.locationCard}>
              <Text style={styles.cardTitle}>📍 Last Known Location</Text>
              <Text style={styles.locationAddr}>{activeAlert.address || 'Location available on map'}</Text>
              <Text style={styles.locationCoords}>{activeAlert.lat?.toFixed(5)}°N, {activeAlert.lng?.toFixed(5)}°E</Text>
              {lastPing && <Text style={styles.locationUpdate}>Last update: {timeSince(lastPing.timestamp)}</Text>}
              <Text style={styles.pingCount}>📡 {activeAlert.total_pings || 0} location pings received</Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                onPress={() => Linking.openURL(`tel:${activeAlert.user_phone}`)}>
                <Text style={styles.actionIcon}>📞</Text>
                <Text style={styles.actionText}>Call {activeAlert.user_name?.split(' ')[0]}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1D4ED8' }]}
                onPress={() => Linking.openURL(activeAlert.maps_link || `https://maps.google.com/?q=${activeAlert.lat},${activeAlert.lng}`)}>
                <Text style={styles.actionIcon}>🗺️</Text>
                <Text style={styles.actionText}>Open Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}
                onPress={() => Linking.openURL('tel:100')}>
                <Text style={styles.actionIcon}>🚨</Text>
                <Text style={styles.actionText}>Call Police</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6C3CE1' }]}
                onPress={() => {
                  const msg = `SHESAFE SOS: ${activeAlert.user_name} needs help!\nLocation: ${activeAlert.address}\nMaps: ${activeAlert.maps_link}`;
                  Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
                }}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionText}>Share Alert</Text>
              </TouchableOpacity>
            </View>

            {activeAlert.is_safe && (
              <View style={styles.safeConfirmed}>
                <Text style={styles.safeConfirmedText}>✅ {activeAlert.user_name} has confirmed she is safe</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All Safe</Text>
            <Text style={styles.emptyText}>No active alerts. Your loved one is safe.</Text>
            <Text style={styles.emptyHint}>Pull down to refresh</Text>
            <TouchableOpacity style={styles.demoBtn} onPress={simulateAlert}>
              <Text style={styles.demoBtnText}>▶ Simulate Alert (Demo)</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  alertBanner: { borderRadius: 18, borderWidth: 1.5, padding: 18, marginBottom: 12, overflow: 'hidden' },
  alertBannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  riskPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  riskPillText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  alertName: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  alertTime: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  locationCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#D1FAE5', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  locationAddr: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  locationCoords: { fontSize: 12, color: '#6B7280', fontFamily: 'monospace' },
  locationUpdate: { fontSize: 12, color: '#059669', marginTop: 6 },
  pingCount: { fontSize: 12, color: '#1D4ED8', marginTop: 2 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  actionBtn: { width: '47%', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 24 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  safeConfirmed: { backgroundColor: '#D1FAE5', borderRadius: 14, padding: 14, alignItems: 'center' },
  safeConfirmedText: { color: '#059669', fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  emptyHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  demoBtn: { marginTop: 24, backgroundColor: '#059669', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
