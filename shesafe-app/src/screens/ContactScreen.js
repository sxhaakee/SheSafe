/**
 * SheSafe — CONTACT SCREEN (Trusted Contact / Relative View)
 * Shows: Alert notifications, live location tracking, victim status
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Vibration, Linking, StatusBar, RefreshControl,
} from 'react-native';
import { apiService } from '../services/ApiService';
import config from '../config';

export default function ContactScreen() {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingAlert, setTrackingAlert] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const pollingRef = useRef(null);
  const trackingRef = useRef(null);

  useEffect(() => {
    checkConnection();
    pollingRef.current = setInterval(checkConnection, 5000);
    return () => {
      clearInterval(pollingRef.current);
      if (trackingRef.current) clearInterval(trackingRef.current);
    };
  }, []);

  const checkConnection = async () => {
    const result = await apiService.ping();
    setConnected(!!result);
  };

  // Simulate receiving alert from victim
  const simulateAlert = () => {
    const alert = {
      id: `SHESAFE_DEMO_${Date.now().toString(16).toUpperCase()}`,
      victimName: config.DEMO_USER.name,
      victimPhone: config.DEMO_USER.phone,
      lat: config.DEMO_ZONE.lat,
      lng: config.DEMO_ZONE.lng,
      address: config.DEMO_ZONE.name,
      riskLevel: 'emergency',
      riskScore: 95,
      trigger: 'shake',
      time: new Date().toLocaleTimeString('en-IN', { hour12: true }),
      isSafe: false,
      pings: [
        { lat: config.DEMO_ZONE.lat, lng: config.DEMO_ZONE.lng, time: new Date().toLocaleTimeString() },
      ],
    };

    setAlerts(prev => [alert, ...prev]);
    Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500]);

    // Simulate location pings
    let pingCount = 0;
    trackingRef.current = setInterval(() => {
      pingCount++;
      const newLat = config.DEMO_ZONE.lat + (pingCount * 0.0005);
      const newLng = config.DEMO_ZONE.lng + (pingCount * 0.0003);
      setLocationHistory(prev => [...prev, {
        lat: newLat,
        lng: newLng,
        time: new Date().toLocaleTimeString(),
        ping: pingCount,
      }]);
    }, 5000);
  };

  const markSafe = (alertId) => {
    if (trackingRef.current) clearInterval(trackingRef.current);
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, isSafe: true } : a
    ));
  };

  const openMaps = (lat, lng) => {
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  };

  const callVictim = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openWhatsApp = (phone) => {
    const cleaned = phone.replace('+', '');
    Linking.openURL(`https://wa.me/${cleaned}?text=Are%20you%20safe%3F%20I%20got%20your%20SheSafe%20alert.`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkConnection();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#14532d" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👨‍👩‍👧 Trusted Contact</Text>
          <Text style={styles.headerSub}>Family Safety Dashboard</Text>
        </View>
        <View style={[styles.connBadge, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.connText}>{connected ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            You are a trusted contact for <Text style={styles.bold}>{config.DEMO_USER.name}</Text>.
            You will receive alerts if she is in danger.
          </Text>
        </View>

        {/* Simulate Button */}
        <TouchableOpacity style={styles.simBtn} onPress={simulateAlert}>
          <Text style={styles.simBtnText}>🔔 Simulate Incoming Alert (Demo)</Text>
        </TouchableOpacity>

        {/* Alerts */}
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>{config.DEMO_USER.name} is Safe</Text>
            <Text style={styles.emptyDesc}>
              You will be notified immediately if an emergency is detected.
            </Text>
            <View style={styles.safeIndicator}>
              <Text style={styles.safeText}>ALL CLEAR</Text>
            </View>
          </View>
        ) : (
          alerts.map((alert, i) => (
            <View
              key={i}
              style={[styles.alertCard, alert.isSafe && styles.alertSafe]}
            >
              {/* Emergency Banner */}
              {!alert.isSafe && (
                <View style={styles.emergencyBanner}>
                  <Text style={styles.emergencyText}>
                    🚨 EMERGENCY — {alert.victimName} NEEDS HELP
                  </Text>
                </View>
              )}

              {alert.isSafe && (
                <View style={styles.safeBanner}>
                  <Text style={styles.safebannerText}>
                    ✅ {alert.victimName} has confirmed she is SAFE
                  </Text>
                </View>
              )}

              {/* Alert Info */}
              <View style={styles.alertBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>👤 Name</Text>
                  <Text style={styles.infoValue}>{alert.victimName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📍 Location</Text>
                  <Text style={styles.infoValue}>{alert.address}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>⏰ Time</Text>
                  <Text style={styles.infoValue}>{alert.time}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>⚡ Trigger</Text>
                  <Text style={styles.infoValue}>{alert.trigger.toUpperCase()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>🎯 Risk</Text>
                  <Text style={[styles.infoValue, { color: '#ef4444', fontWeight: '900' }]}>
                    {alert.riskScore}/100 — {alert.riskLevel.toUpperCase()}
                  </Text>
                </View>

                {/* Live Location Pings */}
                {locationHistory.length > 0 && !alert.isSafe && (
                  <View style={styles.pingSection}>
                    <Text style={styles.pingTitle}>📡 Live Location Updates</Text>
                    {locationHistory.slice(-5).map((ping, j) => (
                      <TouchableOpacity
                        key={j}
                        style={styles.pingRow}
                        onPress={() => openMaps(ping.lat, ping.lng)}
                      >
                        <Text style={styles.pingNum}>#{ping.ping}</Text>
                        <Text style={styles.pingCoords}>
                          {ping.lat.toFixed(4)}, {ping.lng.toFixed(4)}
                        </Text>
                        <Text style={styles.pingTime}>{ping.time}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                {!alert.isSafe && (
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callVictim(alert.victimPhone)}
                    >
                      <Text style={styles.btnText}>📞 Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.waBtn}
                      onPress={() => openWhatsApp(alert.victimPhone)}
                    >
                      <Text style={styles.btnText}>💬 WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mapBtn}
                      onPress={() => openMaps(alert.lat, alert.lng)}
                    >
                      <Text style={styles.btnText}>🗺️ Maps</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!alert.isSafe && (
                  <TouchableOpacity
                    style={styles.resolveBtn}
                    onPress={() => markSafe(alert.id)}
                  >
                    <Text style={styles.resolveText}>✅ Mark as Safe (Confirmed by phone)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#052e16' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#14532d',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#86efac', fontSize: 12, marginTop: 2 },
  connBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  connText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  infoBanner: {
    backgroundColor: '#166534', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  infoText: { color: '#bbf7d0', fontSize: 13 },
  bold: { fontWeight: '800', color: '#fff' },

  simBtn: {
    backgroundColor: '#14532d', padding: 14, borderRadius: 12, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#22c55e', borderStyle: 'dashed',
  },
  simBtnText: { color: '#86efac', fontSize: 14, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  emptyDesc: { color: '#86efac', fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 30 },
  safeIndicator: {
    marginTop: 24, backgroundColor: '#22c55e', paddingHorizontal: 30, paddingVertical: 12,
    borderRadius: 30,
  },
  safeText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 3 },

  alertCard: {
    backgroundColor: '#1a1a2e', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    borderWidth: 2, borderColor: '#ef4444',
  },
  alertSafe: { borderColor: '#22c55e', opacity: 0.8 },

  emergencyBanner: {
    backgroundColor: '#ef4444', padding: 14, alignItems: 'center',
  },
  emergencyText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  safeBanner: {
    backgroundColor: '#22c55e', padding: 14, alignItems: 'center',
  },
  safebannerText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  alertBody: { padding: 16 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  infoLabel: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },

  pingSection: { marginTop: 16 },
  pingTitle: { color: '#60a5fa', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  pingRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  pingNum: { color: '#8b5cf6', fontSize: 12, fontWeight: '800', width: 30 },
  pingCoords: { color: '#d4d4d8', fontSize: 12, flex: 1, fontFamily: 'monospace' },
  pingTime: { color: '#64748b', fontSize: 11 },

  actionBtns: { flexDirection: 'row', gap: 8, marginTop: 16 },
  callBtn: { flex: 1, backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center' },
  waBtn: { flex: 1, backgroundColor: '#25d366', padding: 14, borderRadius: 12, alignItems: 'center' },
  mapBtn: { flex: 1, backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  resolveBtn: {
    marginTop: 12, backgroundColor: '#14532d', padding: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#22c55e',
  },
  resolveText: { color: '#86efac', fontSize: 13, fontWeight: '700' },
});
