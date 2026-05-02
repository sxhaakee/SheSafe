// SheSafe — Welcome / Role Selection Screen v3 (World-Class UI)
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Image, SafeAreaView, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ROLES = [
  {
    id: 'victim',
    iconName: 'shield-checkmark',
    title: 'Personal Safety',
    subtitle: 'Active monitoring & SOS\nShake to trigger emergency alert',
    color: '#4F35D2',
    bg: '#EEE9FF',
    border: '#D8D0FF',
  },
  {
    id: 'police',
    iconName: 'business',
    title: 'Law Enforcement',
    subtitle: 'Alert dashboard\nReceive & respond to SOS calls',
    color: '#1D4ED8',
    bg: '#DBEAFE',
    border: '#BFDBFE',
  },
  {
    id: 'contact',
    iconName: 'people',
    title: 'Trusted Guardian',
    subtitle: 'Track & support\nReceive real-time safety alerts',
    color: '#059669',
    bg: '#D1FAE5',
    border: '#A7F3D0',
  },
];

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const cardAnims = ROLES.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    cardAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1, duration: 450,
        delay: 200 + i * 100,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>

        {/* Logo */}
        <Animated.View style={[styles.logoWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Image
            source={require('../../../assets/shesafe-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Protection that works when it matters most</Text>
        </Animated.View>

        {/* Section label */}
        <Animated.Text style={[styles.sectionLabel, { opacity: fadeAnim }]}>
          SELECT YOUR ROLE
        </Animated.Text>

        {/* Role Cards */}
        <View style={styles.cards}>
          {ROLES.map((role, i) => (
            <Animated.View
              key={role.id}
              style={{
                opacity: cardAnims[i],
                transform: [{
                  translateY: cardAnims[i].interpolate({
                    inputRange: [0, 1], outputRange: [20, 0]
                  })
                }]
              }}
            >
              <TouchableOpacity
                style={[styles.card, { borderColor: role.border }]}
                onPress={() => navigation.navigate('Signup', { role: role.id, roleColor: role.color })}
                activeOpacity={0.82}
              >
                <View style={[styles.iconBox, { backgroundColor: role.bg }]}>
                  <Ionicons name={role.iconName} size={24} color={role.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: role.color }]}>{role.title}</Text>
                  <Text style={styles.cardSub}>{role.subtitle}</Text>
                </View>
                <View style={[styles.chevronBox, { backgroundColor: role.bg }]}>
                  <Ionicons name="chevron-forward" size={18} color={role.color} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Sign In Link */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <Text style={styles.signInLink}>Sign in →</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },

  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 210, height: 58 },
  tagline: { fontSize: 13, color: '#6B7280', marginTop: 10, textAlign: 'center', lineHeight: 19, letterSpacing: 0.1 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 2, marginBottom: 14, marginLeft: 2,
  },

  cards: { gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  cardBody: { flex: 1, marginLeft: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardSub: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  chevronBox: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 20, fontWeight: '600', marginTop: -1 },

  footer: { marginTop: 'auto', paddingBottom: 24, alignItems: 'center' },
  signInRow: { flexDirection: 'row', alignItems: 'center' },
  signInText: { color: '#6B7280', fontSize: 14 },
  signInLink: { color: '#4F35D2', fontWeight: '700', fontSize: 14 },
});
