// SheSafe — Login Screen v3 (World-Class UI)
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, Alert, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform, SafeAreaView, Image, ScrollView
} from 'react-native';
import { login } from '../../services/AuthService';
import { AuthContext } from '../../../App';

export default function LoginScreen({ navigation }) {
  const { onLogin } = useContext(AuthContext);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleLogin() {
    if (!phone.trim()) { Alert.alert('Required', 'Enter your phone number'); return; }
    if (!password.trim()) { Alert.alert('Required', 'Enter your password'); return; }
    setLoading(true);
    try {
      await login({ phone: phone.trim(), password });
      await onLogin();  // refreshes App.js user state → switches to MainNavigator
    } catch (err) {
      Alert.alert('Sign In Failed', err.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.backTxt}>← Back</Text>
            </TouchableOpacity>
            <Image source={require('../../../assets/shesafe-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to SheSafe</Text>
          </Animated.View>

          <Animated.View style={[styles.form, { opacity: fadeAnim }]}>

            {/* Phone */}
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
              placeholder="+91 98765 43210"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />

            {/* Password */}
            <Text style={[styles.label, { marginTop: 20 }]}>Password</Text>
            <View style={styles.passWrap}>
              <TextInput
                style={[styles.input, styles.passInput, focusedField === 'pass' && styles.inputFocused]}
                placeholder="Your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                onFocus={() => setFocusedField('pass')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass(!showPass)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && styles.signInBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.signInText}>Sign In →</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or</Text>
              <View style={styles.divLine} />
            </View>

            {/* Register */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Welcome')}
              activeOpacity={0.82}
            >
              <Text style={styles.registerBtnText}>Create New Account</Text>
            </TouchableOpacity>

          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 28 },
  backTxt: { fontSize: 15, color: '#4F35D2', fontWeight: '600' },
  logo: { width: 190, height: 52, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 6 },

  form: {},
  label: {
    fontSize: 13, fontWeight: '600', color: '#374151',
    marginBottom: 8, letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1.5, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  inputFocused: {
    borderColor: '#4F35D2', backgroundColor: '#fff',
    shadowColor: '#4F35D2', shadowOpacity: 0.12,
    shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  passWrap: { position: 'relative' },
  passInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeIcon: { fontSize: 18 },

  signInBtn: {
    backgroundColor: '#4F35D2', borderRadius: 14, height: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: 32,
    shadowColor: '#4F35D2', shadowOpacity: 0.35,
    shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  signInBtnDisabled: { opacity: 0.7 },
  signInText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  divText: { marginHorizontal: 16, fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  registerBtn: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  registerBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
});
