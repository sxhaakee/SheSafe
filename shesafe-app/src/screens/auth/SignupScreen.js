// SheSafe — Signup Screen v3 (World-Class UI)
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, Alert, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform, SafeAreaView, Image, ScrollView
} from 'react-native';
import { register } from '../../services/AuthService';

const ROLE_META = {
  victim:  { label: 'Personal Safety', color: '#4F35D2', bg: '#EEE9FF' },
  police:  { label: 'Law Enforcement', color: '#1D4ED8', bg: '#DBEAFE' },
  contact: { label: 'Trusted Guardian', color: '#059669', bg: '#D1FAE5' },
};

export default function SignupScreen({ navigation, route }) {
  const role = route?.params?.role || 'victim';
  const meta = ROLE_META[role] || ROLE_META.victim;

  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [pin, setPin]             = useState('');
  const [badgeNumber, setBadge]   = useState('');
  const [stationName, setStation] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [focusedField, setFocused] = useState(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const inputStyle = (field) => [
    styles.input,
    focusedField === field && {
      borderColor: meta.color,
      backgroundColor: '#fff',
      shadowColor: meta.color,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
  ];

  async function handleSignup() {
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.'); return;
    }
    if (password !== confirmPass) {
      Alert.alert('Password Mismatch', 'Passwords do not match.'); return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return;
    }
    if (role === 'victim' && (!pin || pin.length !== 4)) {
      Alert.alert('PIN Required', 'Please set a 4-digit safety PIN.'); return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(), phone: phone.trim(),
        email: email.trim(), password, role, pin,
        badgeNumber, stationName, victimPhone,
        emergencyContacts: [], relationship: '',
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.backTxt}>← Back</Text>
            </TouchableOpacity>
            <Image source={require('../../../assets/shesafe-logo.png')} style={styles.logo} resizeMode="contain" />

            {/* Role Badge */}
            <View style={[styles.roleBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.roleBadgeText, { color: meta.color }]}>Creating {meta.label} account</Text>
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join SheSafe to stay protected</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Section: Basic Info */}
            <Text style={styles.sectionHeader}>BASIC INFORMATION</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput style={inputStyle('name')} placeholder="Your full name" placeholderTextColor="#9CA3AF"
              value={name} onChangeText={setName} autoCapitalize="words"
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />

            <Text style={[styles.label, styles.mt16]}>Phone Number</Text>
            <TextInput style={inputStyle('phone')} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF"
              value={phone} onChangeText={setPhone} keyboardType="phone-pad"
              onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} />

            <Text style={[styles.label, styles.mt16]}>Email Address</Text>
            <TextInput style={inputStyle('email')} placeholder="you@example.com" placeholderTextColor="#9CA3AF"
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />

            {/* Section: Security */}
            <Text style={[styles.sectionHeader, styles.mt24]}>SECURITY</Text>

            <Text style={styles.label}>Password</Text>
            <View style={styles.passWrap}>
              <TextInput style={[inputStyle('pass'), styles.passInput]} placeholder="Min. 6 characters" placeholderTextColor="#9CA3AF"
                value={password} onChangeText={setPassword} secureTextEntry={!showPass}
                onFocus={() => setFocused('pass')} onBlur={() => setFocused(null)} />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, styles.mt16]}>Confirm Password</Text>
            <TextInput style={inputStyle('confirm')} placeholder="Repeat password" placeholderTextColor="#9CA3AF"
              value={confirmPass} onChangeText={setConfirmPass} secureTextEntry={!showPass}
              onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)} />

            {/* Safety PIN (victim only) */}
            {role === 'victim' && (
              <>
                <Text style={[styles.label, styles.mt16]}>4-Digit Safety PIN</Text>
                <Text style={styles.hint}>Used to cancel false alarms. Keep it secret.</Text>
                <TextInput style={inputStyle('pin')} placeholder="e.g. 1234" placeholderTextColor="#9CA3AF"
                  value={pin} onChangeText={(v) => setPin(v.slice(0, 4))} keyboardType="number-pad" maxLength={4}
                  onFocus={() => setFocused('pin')} onBlur={() => setFocused(null)} />
              </>
            )}

            {/* Police fields */}
            {role === 'police' && (
              <>
                <Text style={[styles.sectionHeader, styles.mt24]}>OFFICER DETAILS</Text>
                <Text style={styles.label}>Badge / Officer ID</Text>
                <TextInput style={inputStyle('badge')} placeholder="e.g. KA-MG-01" placeholderTextColor="#9CA3AF"
                  value={badgeNumber} onChangeText={setBadge}
                  onFocus={() => setFocused('badge')} onBlur={() => setFocused(null)} />
                <Text style={[styles.label, styles.mt16]}>Station Name</Text>
                <TextInput style={inputStyle('station')} placeholder="e.g. MG Road Police Station" placeholderTextColor="#9CA3AF"
                  value={stationName} onChangeText={setStation}
                  onFocus={() => setFocused('station')} onBlur={() => setFocused(null)} />
              </>
            )}

            {/* Contact fields */}
            {role === 'contact' && (
              <>
                <Text style={[styles.sectionHeader, styles.mt24]}>LINKED PERSON</Text>
                <Text style={styles.label}>Person to Protect (Phone)</Text>
                <Text style={styles.hint}>Phone number of the SheSafe user you're linked to.</Text>
                <TextInput style={inputStyle('victim')} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF"
                  value={victimPhone} onChangeText={setVictimPhone} keyboardType="phone-pad"
                  onFocus={() => setFocused('victim')} onBlur={() => setFocused(null)} />
              </>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: meta.color, shadowColor: meta.color }, loading && styles.ctaDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.ctaText}>Create Account →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.signinRow} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signinText}>Already registered? </Text>
              <Text style={[styles.signinLink, { color: meta.color }]}>Sign in</Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },

  header: { alignItems: 'center', marginBottom: 32 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 24 },
  backTxt: { fontSize: 15, color: '#4F35D2', fontWeight: '600' },
  logo: { width: 190, height: 52, marginBottom: 18 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginBottom: 16 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 6 },

  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 2, marginBottom: 14, marginTop: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, letterSpacing: 0.1 },
  hint: { fontSize: 12, color: '#9CA3AF', marginBottom: 8, lineHeight: 17 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },

  input: {
    borderWidth: 1.5, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  passWrap: { position: 'relative' },
  passInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeIcon: { fontSize: 18 },

  ctaBtn: {
    borderRadius: 14, height: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: 32,
    shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },

  signinRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  signinText: { color: '#6B7280', fontSize: 14 },
  signinLink: { fontWeight: '700', fontSize: 14 },
});
