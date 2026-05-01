// SheSafe — Signup Screen v4
// Emergency contacts (2 required for victim) + PIN confirm
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, Alert, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform, SafeAreaView, Image, ScrollView
} from 'react-native';
import { register } from '../../services/AuthService';
import { AuthContext } from '../../../App';

const ROLE_META = {
  victim:  { label: 'Personal Safety',  color: '#4F35D2', bg: '#EEE9FF' },
  police:  { label: 'Law Enforcement',  color: '#1D4ED8', bg: '#DBEAFE' },
  contact: { label: 'Trusted Guardian', color: '#059669', bg: '#D1FAE5' },
};

export default function SignupScreen({ navigation, route }) {
  const { onLogin } = useContext(AuthContext);
  const role = route?.params?.role || 'victim';
  const meta = ROLE_META[role] || ROLE_META.victim;

  // Basic
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass,    setShowPass]    = useState(false);

  // PIN
  const [pin,         setPin]         = useState('');
  const [confirmPin,  setConfirmPin]  = useState('');

  // Emergency contacts (victim only)
  const [ec1Name,  setEc1Name]  = useState('');
  const [ec1Phone, setEc1Phone] = useState('');
  const [ec2Name,  setEc2Name]  = useState('');
  const [ec2Phone, setEc2Phone] = useState('');

  // Police
  const [badgeNumber,  setBadge]      = useState('');
  const [stationName,  setStation]    = useState('');

  // Contact
  const [victimPhone, setVictimPhone] = useState('');
  const [relationship, setRelation]   = useState('');

  const [loading,      setLoading]    = useState(false);
  const [focused,      setFocused]    = useState(null);

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
    focused === field && {
      borderColor: meta.color, backgroundColor: '#fff',
      shadowColor: meta.color, shadowOpacity: 0.15,
      shadowRadius: 8, elevation: 3,
    },
  ];

  async function handleSignup() {
    // Validation
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please fill in all required fields.'); return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return;
    }
    if (password !== confirmPass) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please re-enter.'); return;
    }
    if (role === 'victim') {
      if (!pin || pin.length !== 4) {
        Alert.alert('PIN Required', 'Please enter a 4-digit safety PIN.'); return;
      }
      if (pin !== confirmPin) {
        Alert.alert('PIN Mismatch', 'PINs do not match. Please re-enter.'); return;
      }
      if (!ec1Name.trim() || !ec1Phone.trim() || !ec2Name.trim() || !ec2Phone.trim()) {
        Alert.alert('Emergency Contacts Required', 'Please add 2 emergency contacts.'); return;
      }
    }

    const emergencyContacts = role === 'victim' ? [
      { name: ec1Name.trim(), phone: ec1Phone.trim(), relation: 'Emergency Contact 1' },
      { name: ec2Name.trim(), phone: ec2Phone.trim(), relation: 'Emergency Contact 2' },
    ] : [];

    setLoading(true);
    try {
      await register({
        name: name.trim(), phone: phone.trim(), email: email.trim(),
        password, role, pin,
        emergencyContacts,
        badgeNumber, stationName, victimPhone,
        relationship,
      });
      await onLogin();  // refreshes App.js user state → switches to MainNavigator
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong. Please try again.');
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
            <View style={[styles.roleBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.roleBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join SheSafe · Protect yourself</Text>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── Basic Info ── */}
            <Text style={styles.sectionHeader}>BASIC INFORMATION</Text>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={inputStyle('name')} placeholder="Your full name" placeholderTextColor="#9CA3AF"
              value={name} onChangeText={setName} autoCapitalize="words"
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />

            <Text style={[styles.label, styles.mt16]}>Phone Number *</Text>
            <TextInput style={inputStyle('phone')} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF"
              value={phone} onChangeText={setPhone} keyboardType="phone-pad"
              onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} />

            <Text style={[styles.label, styles.mt16]}>Email Address *</Text>
            <TextInput style={inputStyle('email')} placeholder="you@example.com" placeholderTextColor="#9CA3AF"
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />

            {/* ── Security ── */}
            <Text style={[styles.sectionHeader, styles.mt24]}>SECURITY</Text>

            <Text style={styles.label}>Password *</Text>
            <View style={styles.passWrap}>
              <TextInput style={[inputStyle('pass'), styles.passInput]} placeholder="Min. 6 characters" placeholderTextColor="#9CA3AF"
                value={password} onChangeText={setPassword} secureTextEntry={!showPass}
                onFocus={() => setFocused('pass')} onBlur={() => setFocused(null)} />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, styles.mt16]}>Confirm Password *</Text>
            <TextInput style={inputStyle('cpass')} placeholder="Re-enter password" placeholderTextColor="#9CA3AF"
              value={confirmPass} onChangeText={setConfirmPass} secureTextEntry={!showPass}
              onFocus={() => setFocused('cpass')} onBlur={() => setFocused(null)} />

            {/* PIN — victim only */}
            {role === 'victim' && (
              <>
                <Text style={[styles.label, styles.mt16]}>4-Digit Safety PIN *</Text>
                <Text style={styles.hint}>🔒 Used to cancel false alarms. Keep it private.</Text>
                <TextInput style={inputStyle('pin')} placeholder="e.g. 1234" placeholderTextColor="#9CA3AF"
                  value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad" maxLength={4} secureTextEntry
                  onFocus={() => setFocused('pin')} onBlur={() => setFocused(null)} />

                <Text style={[styles.label, styles.mt16]}>Confirm PIN *</Text>
                <TextInput style={inputStyle('cpin')} placeholder="Re-enter PIN" placeholderTextColor="#9CA3AF"
                  value={confirmPin} onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad" maxLength={4} secureTextEntry
                  onFocus={() => setFocused('cpin')} onBlur={() => setFocused(null)} />

                {/* ── Emergency Contacts ── */}
                <Text style={[styles.sectionHeader, styles.mt24]}>EMERGENCY CONTACTS</Text>
                <Text style={styles.hint}>📞 These people will be alerted in an emergency. Add 2 contacts.</Text>

                {/* Contact 1 */}
                <View style={styles.contactCard}>
                  <Text style={[styles.contactLabel, { color: meta.color }]}>Contact 1</Text>
                  <Text style={styles.label}>Name</Text>
                  <TextInput style={inputStyle('ec1n')} placeholder="e.g. Mom" placeholderTextColor="#9CA3AF"
                    value={ec1Name} onChangeText={setEc1Name} autoCapitalize="words"
                    onFocus={() => setFocused('ec1n')} onBlur={() => setFocused(null)} />
                  <Text style={[styles.label, styles.mt16]}>Phone Number</Text>
                  <TextInput style={inputStyle('ec1p')} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF"
                    value={ec1Phone} onChangeText={setEc1Phone} keyboardType="phone-pad"
                    onFocus={() => setFocused('ec1p')} onBlur={() => setFocused(null)} />
                </View>

                {/* Contact 2 */}
                <View style={[styles.contactCard, styles.mt16]}>
                  <Text style={[styles.contactLabel, { color: meta.color }]}>Contact 2</Text>
                  <Text style={styles.label}>Name</Text>
                  <TextInput style={inputStyle('ec2n')} placeholder="e.g. Dad" placeholderTextColor="#9CA3AF"
                    value={ec2Name} onChangeText={setEc2Name} autoCapitalize="words"
                    onFocus={() => setFocused('ec2n')} onBlur={() => setFocused(null)} />
                  <Text style={[styles.label, styles.mt16]}>Phone Number</Text>
                  <TextInput style={inputStyle('ec2p')} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF"
                    value={ec2Phone} onChangeText={setEc2Phone} keyboardType="phone-pad"
                    onFocus={() => setFocused('ec2p')} onBlur={() => setFocused(null)} />
                </View>
              </>
            )}

            {/* ── Police fields ── */}
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

            {/* ── Guardian fields ── */}
            {role === 'contact' && (
              <>
                <Text style={[styles.sectionHeader, styles.mt24]}>LINKED PERSON</Text>
                <Text style={styles.label}>Person to Protect (Phone)</Text>
                <Text style={styles.hint}>Phone number of the SheSafe user you're protecting.</Text>
                <TextInput style={inputStyle('victim')} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF"
                  value={victimPhone} onChangeText={setVictimPhone} keyboardType="phone-pad"
                  onFocus={() => setFocused('victim')} onBlur={() => setFocused(null)} />
                <Text style={[styles.label, styles.mt16]}>Your Relationship</Text>
                <TextInput style={inputStyle('rel')} placeholder="e.g. Sister, Friend, Parent" placeholderTextColor="#9CA3AF"
                  value={relationship} onChangeText={setRelation}
                  onFocus={() => setFocused('rel')} onBlur={() => setFocused(null)} />
              </>
            )}

            {/* ── CTA ── */}
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: meta.color, shadowColor: meta.color }, loading && styles.ctaDisabled]}
              onPress={handleSignup} disabled={loading} activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.ctaText}>Create Account →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.signinRow} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signinText}>Already registered? </Text>
              <Text style={[styles.signinLink, { color: meta.color }]}>Sign in →</Text>
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

  sectionHeader: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 2, marginBottom: 14, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, letterSpacing: 0.1 },
  hint: { fontSize: 12, color: '#9CA3AF', marginBottom: 10, lineHeight: 17 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },

  input: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 12,
    paddingHorizontal: 15, paddingVertical: 14,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  passWrap: { position: 'relative' },
  passInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeIcon: { fontSize: 18 },

  contactCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  contactLabel: { fontSize: 13, fontWeight: '700', marginBottom: 14, letterSpacing: 0.3 },

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
