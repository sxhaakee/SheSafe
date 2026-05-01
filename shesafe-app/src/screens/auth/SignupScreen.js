// SheSafe — Signup Screen with PIN (double-entry confirmation for personal safety users)
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Animated, Alert, ActivityIndicator, StatusBar
} from 'react-native';
import { register } from '../../services/AuthService';

const ROLE_META = {
  victim:  { icon: '🛡️', title: 'Personal Safety Account', color: '#6C3CE1' },
  police:  { icon: '🏛️', title: 'Law Enforcement Account', color: '#1D4ED8' },
  contact: { icon: '👨‍👩‍👧', title: 'Trusted Guardian Account', color: '#059669' },
};

// ── PIN Input ─────────────────────────────────────────────────────────────────
function PinInput({ label, value, onChange }) {
  const boxes = [0, 1, 2, 3];
  const inputRef = useRef(null);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => inputRef.current?.focus()} style={styles.pinRow}>
        {boxes.map(i => (
          <View key={i} style={[styles.pinBox, value.length > i && styles.pinBoxFilled]}>
            <Text style={styles.pinDot}>{value.length > i ? '●' : ''}</Text>
          </View>
        ))}
      </TouchableOpacity>
      <TextInput
        ref={inputRef} value={value}
        onChangeText={v => onChange(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="numeric" maxLength={4} secureTextEntry style={styles.hiddenInput}
      />
    </View>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────
function ContactRow({ index, contact, onChange }) {
  return (
    <View style={styles.contactRow}>
      <TextInput
        style={[styles.input, { flex: 1, marginRight: 8 }]}
        placeholder={`Contact ${index + 1} Name`}
        placeholderTextColor="#9CA3AF"
        value={contact.name}
        onChangeText={v => onChange({ ...contact, name: v })}
      />
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder="Phone (+91...)"
        placeholderTextColor="#9CA3AF"
        value={contact.phone}
        onChangeText={v => onChange({ ...contact, phone: v })}
        keyboardType="phone-pad"
      />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SignupScreen({ route, navigation }) {
  const { role = 'victim', roleColor = '#6C3CE1' } = route.params || {};
  const meta = ROLE_META[role];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [contacts, setContacts] = useState([
    { name: '', phone: '', relation: '' },
    { name: '', phone: '', relation: '' },
  ]);
  const [badgeNumber, setBadgeNumber] = useState('');
  const [stationName, setStationName] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=basic info, 2=role-specific, 3=PIN (victim only)

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [step]);

  function validateStep1() {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your full name'); return false; }
    if (!phone.trim() || phone.length < 10) { Alert.alert('Required', 'Enter a valid phone number'); return false; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Required', 'Enter a valid email address'); return false; }
    if (password.length < 6) { Alert.alert('Required', 'Password must be at least 6 characters'); return false; }
    return true;
  }

  function validatePin() {
    if (pin.length !== 4) { Alert.alert('PIN Required', 'Please set a 4-digit safety PIN'); return false; }
    if (pin !== pinConfirm) { Alert.alert('PIN Mismatch', 'The PINs you entered do not match.'); setPinConfirm(''); return false; }
    return true;
  }

  function goToStep(n) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setStep(n));
  }

  async function handleSignup() {
    if (role === 'victim' && !validatePin()) return;
    setLoading(true);
    try {
      const validContacts = contacts.filter(c => c.name && c.phone);
      await register({
        name, phone, email, password, role,
        pin: role === 'victim' ? pin : '',
        emergencyContacts: validContacts,
        badgeNumber, stationName, victimPhone, relationship,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err) {
      Alert.alert('Sign Up Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <View style={[styles.iconBadge, { backgroundColor: meta.color + '18' }]}>
          <Text style={{ fontSize: 28 }}>{meta.icon}</Text>
        </View>
        <Text style={[styles.title, { color: meta.color }]}>{meta.title}</Text>
        <View style={styles.stepRow}>
          {[1, 2, role === 'victim' ? 3 : null].filter(Boolean).map(s => (
            <View key={s} style={[styles.stepDot, step >= s && { backgroundColor: meta.color }]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step {step} of {role === 'victim' ? 3 : 2}</Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        {/* ── Step 1: Basic Info ── */}
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Priya Sharma"
              placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} placeholder="+91 98765 43210"
              placeholderTextColor="#9CA3AF" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} placeholder="you@example.com"
              placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#9CA3AF"
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: meta.color }]}
              onPress={() => { if (validateStep1()) goToStep(2); }}
            >
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Role-Specific ── */}
        {step === 2 && (
          <View style={styles.form}>
            {role === 'victim' && (
              <>
                <Text style={styles.sectionTitle}>Emergency Contacts</Text>
                <Text style={styles.hint}>Who should be alerted if you're in danger?</Text>
                {contacts.map((c, i) => (
                  <ContactRow key={i} index={i} contact={c}
                    onChange={v => { const arr = [...contacts]; arr[i] = v; setContacts(arr); }}
                  />
                ))}
              </>
            )}
            {role === 'police' && (
              <>
                <Text style={styles.sectionTitle}>Officer Details</Text>
                <Text style={styles.label}>Badge Number</Text>
                <TextInput style={styles.input} placeholder="e.g. KA-1234"
                  placeholderTextColor="#9CA3AF" value={badgeNumber} onChangeText={setBadgeNumber} />
                <Text style={styles.label}>Police Station</Text>
                <TextInput style={styles.input} placeholder="e.g. Koramangala Police Station"
                  placeholderTextColor="#9CA3AF" value={stationName} onChangeText={setStationName} />
              </>
            )}
            {role === 'contact' && (
              <>
                <Text style={styles.sectionTitle}>Link to Your Person</Text>
                <Text style={styles.hint}>Enter the phone number of the person you want to protect.</Text>
                <Text style={styles.label}>Their Phone Number</Text>
                <TextInput style={styles.input} placeholder="+91 98765 43210"
                  placeholderTextColor="#9CA3AF" value={victimPhone} onChangeText={setVictimPhone} keyboardType="phone-pad" />
                <Text style={styles.label}>Your Relationship</Text>
                <TextInput style={styles.input} placeholder="e.g. Mother, Brother, Friend"
                  placeholderTextColor="#9CA3AF" value={relationship} onChangeText={setRelationship} />
              </>
            )}
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: meta.color }]} onPress={() => goToStep(1)}>
                <Text style={[styles.outlineBtnText, { color: meta.color }]}>‹ Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: meta.color, flex: 1 }]}
                onPress={() => { if (role === 'victim') goToStep(3); else handleSignup(); }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{role === 'victim' ? 'Set PIN →' : 'Create Account'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 3: PIN (victim only) ── */}
        {step === 3 && role === 'victim' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Set Your Safety PIN</Text>
            <Text style={styles.hint}>
              This 4-digit PIN cancels a false emergency alert during the 45-second countdown.
              Keep it private and memorable.
            </Text>
            <PinInput label="Enter PIN" value={pin} onChange={setPin} />
            <PinInput label="Confirm PIN" value={pinConfirm} onChange={setPinConfirm} />
            <View style={[styles.pinHint, { borderColor: meta.color + '40', backgroundColor: meta.color + '08' }]}>
              <Text style={[styles.pinHintText, { color: meta.color }]}>
                ⚠️ You'll use this PIN to cancel a 45-second emergency countdown. Don't forget it.
              </Text>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: meta.color }]} onPress={() => goToStep(2)}>
                <Text style={[styles.outlineBtnText, { color: meta.color }]}>‹ Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: meta.color, flex: 1 }]}
                onPress={handleSignup} disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account ✓</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const INPUT_BG = '#F3F4F6';
const INPUT_BORDER = '#D1D5DB';
const TEXT_COLOR = '#111827';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 52, paddingHorizontal: 24, paddingBottom: 20, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 14 },
  backTxt: { fontSize: 16, color: '#6C3CE1', fontWeight: '600' },
  iconBadge: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  stepRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  stepLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  form: { paddingHorizontal: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4, marginTop: 4 },
  hint: { fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1.5, borderColor: INPUT_BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    color: TEXT_COLOR, backgroundColor: INPUT_BG, marginBottom: 2,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 18 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  outlineBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  outlineBtnText: { fontSize: 15, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  contactRow: { flexDirection: 'row', marginBottom: 10 },
  pinRow: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginVertical: 12 },
  pinBox: { width: 60, height: 68, borderRadius: 14, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: INPUT_BG },
  pinBoxFilled: { borderColor: '#6C3CE1', backgroundColor: '#EDE9FE' },
  pinDot: { fontSize: 24, color: '#6C3CE1' },
  hiddenInput: { height: 0, width: 0, opacity: 0 },
  pinHint: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  pinHintText: { fontSize: 13, lineHeight: 18 },
});
