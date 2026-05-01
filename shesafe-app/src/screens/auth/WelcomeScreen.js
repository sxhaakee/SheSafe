// SheSafe — Welcome / Role Selection Screen
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ROLES = [
  { id: 'victim', icon: '🛡️', title: 'I need protection', subtitle: 'Victim safety mode\nActive monitoring & SOS', color: '#6C3CE1', light: '#EDE9FE' },
  { id: 'police', icon: '🏛️', title: 'I am a Police Officer', subtitle: 'Alert dashboard\nReceive & respond to SOS', color: '#1D4ED8', light: '#DBEAFE' },
  { id: 'contact', icon: '👨‍👩‍👧', title: 'I am a Trusted Contact', subtitle: 'Track & support\nReceive safety alerts', color: '#059669', light: '#D1FAE5' },
];

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardAnims = ROLES.map(() => useRef(new Animated.Value(60)).current);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    cardAnims.forEach((anim, i) => {
      Animated.timing(anim, { toValue: 0, duration: 500, delay: 300 + i * 120, useNativeDriver: true }).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <LinearGradient colors={['#F5F3FF', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />

      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.logo}>SheSafe</Text>
        <Text style={styles.tagline}>Protection that works when it matters most</Text>
      </Animated.View>

      <View style={styles.cards}>
        {ROLES.map((role, i) => (
          <Animated.View key={role.id} style={{ transform: [{ translateY: cardAnims[i] }], opacity: cardAnims[i].interpolate({ inputRange: [0, 60], outputRange: [1, 0] }) }}>
            <TouchableOpacity
              style={[styles.card, { borderColor: role.color + '30' }]}
              onPress={() => navigation.navigate('Signup', { role: role.id, roleColor: role.color })}
              activeOpacity={0.85}
            >
              <View style={[styles.iconBox, { backgroundColor: role.light }]}>
                <Text style={styles.icon}>{role.icon}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: role.color }]}>{role.title}</Text>
                <Text style={styles.cardSub}>{role.subtitle}</Text>
              </View>
              <Text style={[styles.arrow, { color: role.color }]}>›</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginRow}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <Text style={styles.loginLink}>Sign in →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 60 },
  header: { marginBottom: 36, alignItems: 'center' },
  logo: { fontSize: 36, fontWeight: '800', color: '#6C3CE1', letterSpacing: -1 },
  tagline: { fontSize: 14, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  cards: { gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1.5, shadowColor: '#6C3CE1', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  iconBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 24 },
  cardText: { flex: 1, marginLeft: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 17 },
  arrow: { fontSize: 24, fontWeight: '300' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  loginText: { color: '#6B7280', fontSize: 14 },
  loginLink: { color: '#6C3CE1', fontWeight: '700', fontSize: 14 },
});
