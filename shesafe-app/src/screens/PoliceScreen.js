/**
 * SheSafe — POLICE SCREEN
 * Shows incoming alerts, victim location, and alert details.
 * Designed for demo: police officer's view of the system.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Vibration, Linking, StatusBar, RefreshControl,
} from 'react-native';
import { apiService } from '../services/ApiService';
import config from '../config';

export default function PoliceScreen() {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const pollingRef = useRef(null);
  const knownAlerts = useRef(new Set());

  // Poll for new alerts (simulated via alert status check)
  useEffect(() => {
    checkConnection();
    // Poll every 5 seconds
    pollingRef.current = setInterval(checkConnection, 5000);
    return () => clearInterval(pollingRef.current);
  }, []);

  const checkConnection = async () => {
    const result = await apiService.ping();
    setConnected(!!result);
    if (result?.active_alerts) {
      const newAlerts = [];
      for (const id of result.active_alerts) {
        if (!knownAlerts.current.has(id)) {
          knownAlerts.current.add(id);
          const status = await apiService.getAlertStatus(id);
          if (status) {
            newAlerts.push({
              id,
              ...status,
              receivedAt: new Date().toLocaleTimeString('en-IN', { hour12: true }),
            });
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
          }
        }
      }
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev]);
      }
    }
  };

  // Simulate receiving an alert (for demo)
  const simulateIncomingAlert = () => {
    const mockAlert = {
      id: `SHESAFE_DEMO_${Date.now().toString(16).toUpperCase()}`,
      user_name: config.DEMO_USER.name,
      user_phone: config.DEMO_USER.phone,
      lat: config.DEMO_ZONE.lat,
      lng: config.DEMO_ZONE.lng,
      risk_score: 95,
      risk_level: 'emergency',
      trigger_type: 'shake',
      is_safe: false,
      total_pings: 0,
      receivedAt: new Date().toLocaleTimeString('en-IN', { hour12: true }),
      address: config.DEMO_ZONE.name,
      trusted_contacts: config.TRUSTED_CONTACTS,
    };
    setAlerts(prev => [mockAlert, ...prev]);
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  };

  const openMaps = (lat, lng) => {
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  };

  const callNumber = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkConnection();
    setRefreshing(false);
  };

  const getRiskColor = (score) => {
    if (score <= 30) return '#22c55e';
    if (score <= 60) return '#f59e0b';
    if (score <= 80) return '#f97316';
    return '#ef4444';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🏛️ Police Dashboard</Text>
          <Text style={styles.headerSub}>SheSafe Alert Receiver</Text>
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
        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{alerts.length}</Text>
            <Text style={styles.statLabel}>Total Alerts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#ef4444' }]}>
              {alerts.filter(a => !a.is_safe).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#22c55e' }]}>
              {alerts.filter(a => a.is_safe).length}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Simulate Alert Button (for demo) */}
        <TouchableOpacity style={styles.simBtn} onPress={simulateIncomingAlert}>
          <Text style={styles.simBtnText}>🔔 Simulate Incoming Alert (Demo)</Text>
        </TouchableOpacity>

        {/* Alert List */}
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏛️</Text>
            <Text style={styles.emptyTitle}>No Active Alerts</Text>
            <Text style={styles.emptyDesc}>
              Alerts will appear here when a victim triggers SOS or when the risk score exceeds 80.
            </Text>
          </View>
        ) : (
          alerts.map((alert, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.alertCard, alert.is_safe && styles.alertResolved]}
              onPress={() => setSelectedAlert(selectedAlert === i ? null : i)}
            >
              {/* Alert Header */}
              <View style={styles.alertHeader}>
                <View style={[styles.riskBadge, { backgroundColor: getRiskColor(alert.risk_score || 95) }]}>
                  <Text style={styles.riskBadgeText}>{alert.risk_score || 95}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.alertName}>
                    {alert.is_safe ? '✅ ' : '🚨 '}{alert.user_name || 'Priya Sharma'}
                  </Text>
                  <Text style={styles.alertTime}>
                    {alert.receivedAt} • {(alert.trigger_type || 'shake').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.alertStatus, { color: alert.is_safe ? '#22c55e' : '#ef4444' }]}>
                  {alert.is_safe ? 'SAFE' : 'ACTIVE'}
                </Text>
              </View>

              {/* Alert Details (expanded) */}
              {selectedAlert === i && (
                <View style={styles.alertDetails}>
                  <Text style={styles.detailLabel}>📍 Location</Text>
                  <Text style={styles.detailValue}>
                    {alert.address || `${(alert.lat || config.DEMO_ZONE.lat).toFixed(4)}°N, ${(alert.lng || config.DEMO_ZONE.lng).toFixed(4)}°E`}
                  </Text>

                  <Text style={styles.detailLabel}>📞 Victim Phone</Text>
                  <Text style={styles.detailValue}>{alert.user_phone || config.DEMO_USER.phone}</Text>

                  <Text style={styles.detailLabel}>📡 Location Pings</Text>
                  <Text style={styles.detailValue}>{alert.total_pings || 0} updates received</Text>

                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={styles.mapBtn}
                      onPress={() => openMaps(alert.lat || config.DEMO_ZONE.lat, alert.lng || config.DEMO_ZONE.lng)}
                    >
                      <Text style={styles.mapBtnText}>🗺️ Open Maps</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callNumber(alert.user_phone || config.DEMO_USER.phone)}
                    >
                      <Text style={styles.callBtnText}>📞 Call Victim</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1929' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#1e3a5f',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#93c5fd', fontSize: 12, marginTop: 2 },
  connBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  connText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#132f4c', borderRadius: 16, padding: 20, marginBottom: 16,
  },
  statItem: { alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 28, fontWeight: '900' },
  statLabel: { color: '#64b5f6', fontSize: 11, fontWeight: '600', marginTop: 4 },

  simBtn: {
    backgroundColor: '#1e3a5f', padding: 14, borderRadius: 12, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2563eb', borderStyle: 'dashed',
  },
  simBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  emptyDesc: { color: '#64b5f6', fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },

  alertCard: {
    backgroundColor: '#132f4c', borderRadius: 16, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#ef4444',
  },
  alertResolved: { borderLeftColor: '#22c55e', opacity: 0.7 },
  alertHeader: { flexDirection: 'row', alignItems: 'center' },
  riskBadge: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  riskBadgeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  alertName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  alertTime: { color: '#64b5f6', fontSize: 12, marginTop: 2 },
  alertStatus: { fontSize: 12, fontWeight: '800' },

  alertDetails: {
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e3a5f',
  },
  detailLabel: { color: '#64b5f6', fontSize: 12, fontWeight: '700', marginTop: 8 },
  detailValue: { color: '#fff', fontSize: 14, marginTop: 2 },

  actionBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  mapBtn: {
    flex: 1, backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center',
  },
  mapBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  callBtn: {
    flex: 1, backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center',
  },
  callBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
