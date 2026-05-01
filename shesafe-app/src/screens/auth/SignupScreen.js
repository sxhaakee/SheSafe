// SheSafe — Signup Screen with PIN (double-entry confirmation for victims)
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { register } from '../../services/AuthService';

const ROLE_META = {
  victim: { icon: '🛡️', title: 'Create Victim Account', color: '#6C3CE1' },
  police: { icon: '🏛️', title: 'Police Officer Account', color: '#1D4ED8' },
  contact: { icon: '👨‍👩‍👧', title: 'Trusted Contact Account', color: '#059669' },
};

// ── PIN Input Component ───────────────────────────────────────────────────────
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
        ref={inputRef} value={value} onChangeText={v => onChange(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="numeric" maxLength={4} secureTextEntry style={styles.hiddenInput}
      />
    </View>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────
function ContactRow({ index, contact, onChange }) {
  return (
    <View style={styles.contactRow}>
      <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder={`Contact ${index + 1} Name`} value={contact.name} onChangeText={v => onChange({ ...contact, name: v })} />
      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Phone (+91...)" value={contact.phone} onChangeText={v => onChange({ ...contact, phone: v })} keyboardType="phone-pad" />
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
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [contacts, setContacts] = useState([{ name: '', phone: '', relation: '' }, { name: '', phone: '', relation: '' }]);
  const [badgeNumber, setBadgeNumber] = useState('');
  const [stationName, setStationName] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=basic info, 2=role-specific, 3=PIN (victim only)

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(); }, [step]);

  function validateStep1() {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your name'); return false; }
    if (!phone.trim() || phone.length < 10) { Alert.alert('Required', 'Enter a valid phone number'); return false; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Required', 'Enter a valid email'); return false; }
    if (password.length < 6) { Alert.alert('Required', 'Password must be at least 6 characters'); return false; }
    return true;
  }

  function validatePin() {
    if (pin.length !== 4) { Alert.alert('PIN Required', 'Please set a 4-digit safety PIN'); return false; }
    if (pin !== pinConfirm) { Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.'); setPinConfirm(''); return false; }
    return true;
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
      Alert.alert('Signup Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <View style={[styles.iconBadge, { backgroundColor: meta.color + '15' }]}>
          <Text style={{ fontSize: 28 }}>{meta.icon}</Text>
        </View>
        <Text style={[styles.title, { color: meta.color }]}>{meta.title}</Text>
        <Text style={styles.subtitle}>Step {role === 'victim' ? step + '/3' : step + '/2'}</Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Phone Number (+91...)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password (min 6 chars)" value={password} onChangeText={setPassword} secureTextEntry />
            <TouchableOpacity style={[styles.btn, { backgroundColor: meta.color }]} onPress={() => { if (validateStep1()) { Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setStep(2)); } }}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            {role === 'victim' && (
              <>
                <Text style={styles.sectionTitle}>Emergency Contacts</Text>
                <Text style={styles.hint}>Who should be alerted if you're in danger?</Text>
                {contacts.map((c, i) => (
                  <ContactRow key={i} index={i} contact={c} onChange={v => { const arr = [...contacts]; arr[i] = v; setContacts(arr); }} />
                ))}
              </>
            )}
            {role === 'police' && (
              <>
                <Text style={styles.sectionTitle}>Officer Details</Text>
                <TextInput style={styles.input} placeholder="Badge Number" value={badgeNumber} onChangeText={setBadgeNumber} />
                <TextInput style={styles.input} placeholder="Police Station Name" value={stationName} onChangeText={setStationName} />
              </>
            )}
            {role === 'contact' && (
              <>
                <Text style={styles.sectionTitle}>Link to Victim</Text>
                <TextInput style={styles.input} placeholder="Victim's Phone Number" value={victimPhone} onChangeText={setVictimPhone} keyboardType="phone-pad" />
                <TextInput style={styles.input} placeholder="Your relationship (e.g. Mother, Sister)" value={relationship} onChangeText={setRelationship} />
              </>
            )}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn2} onPress={() => setStep(1)}>
                <Text style={[styles.btnText, { color: meta.color }]}>‹ Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: meta.color, flex: 1 }]}
                onPress={() => {
                  if (role === 'victim') { Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setStep(3)); }
                  else handleSignup();
                }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{role === 'victim' ? 'Set PIN →' : 'Create Account'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && role === 'victim' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Set Your Safety PIN</Text>
            <Text style={styles.hint}>This 4-digit PIN cancels false emergency alerts. Keep it secret and memorable.</Text>
            <PinInput label="Enter your PIN" value={pin} onChange={setPin} />
            <PinInput label="Confirm your PIN" value={pinConfirm} onChange={setPinConfirm} />
            <View style={[styles.pinHint, { borderColor: meta.color + '40', backgroundColor: meta.color + '08' }]}>
              <Text style={[styles.pinHintText, { color: meta.color }]}>⚠️ You'll need this PIN to cancel a 45-second emergency countdown. Don't forget it.</Text>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn2} onPress={() => setStep(2)}>
                <Text style={[styles.btnText, { color: meta.color }]}>‹ Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: meta.color, flex: 1 }]} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account ✓</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16 },
  backTxt: { fontSize: 16, color: '#6C3CE1', fontWeight: '600' },
  iconBadge: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  form: { paddingHorizontal: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 6, marginTop: 8 },
  hint: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  input: { borderWidth: 1.5, borderColor: '#E8E0FF', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A2E', marginBottom: 12, backgroundColor: '#FAFAFA' },
  btn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backBtn2: { borderWidth: 1.5, borderRadius: 14, padding: 16, alignItems: 'center', paddingHorizontal: 20, borderColor: '#E8E0FF' },
  contactRow: { flexDirection: 'row', marginBottom: 10 },
  pinRow: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginVertical: 12 },
  pinBox: { width: 56, height: 64, borderRadius: 14, borderWidth: 2, borderColor: '#E8E0FF', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F7FF' },
  pinBoxFilled: { borderColor: '#6C3CE1', backgroundColor: '#EDE9FE' },
  pinDot: { fontSize: 22, color: '#6C3CE1' },
  hiddenInput: { height: 0, width: 0, opacity: 0 },
  pinHint: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
  pinHintText: { fontSize: 13, lineHeight: 18 },
});
