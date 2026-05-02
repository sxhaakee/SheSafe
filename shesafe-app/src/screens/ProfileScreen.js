import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getStoredUser } from '../services/AuthService';
import ApiService from '../services/ApiService';

export default function ProfileScreen() {
  const { onLogin } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStoredUser().then(u => {
      setUser(u);
      setName(u?.name || '');
      setEmail(u?.email || '');
      setPhone(u?.phone || '');
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name cannot be empty.');
    if (newPassword.trim().length > 0 && newPassword.length < 6) {
      return Alert.alert('Error', 'New password must be at least 6 characters.');
    }
    
    setLoading(true);
    const res = await ApiService.updateProfile({ phone, name, email, emergency_contacts: user.emergency_contacts || [] });
    
    if (newPassword.trim().length >= 6) {
      await ApiService.resetPassword({ phone, new_password: newPassword });
    }

    setLoading(false);
    
    if (res && res.success) {
      Alert.alert('Success', 'Profile updated successfully!');
      await onLogin(); // Refresh global state
    } else {
      Alert.alert('Error', res?.detail || 'Failed to update profile.');
    }
  };

  if (!user) return <View style={styles.container}><ActivityIndicator color="#4F35D2" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <LinearGradient colors={['#F9FAFB', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleTxt}>{user.role.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="person-outline" size={20} color="#6B7280" style={styles.icon} />
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#9CA3AF" />
        </View>

        <Text style={styles.label}>Email Address (Optional)</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.icon} />
          <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholderTextColor="#9CA3AF" />
        </View>

        <Text style={styles.label}>Phone Number (Non-editable)</Text>
        <View style={[styles.inputWrap, { backgroundColor: '#F3F4F6' }]}>
          <Ionicons name="call-outline" size={20} color="#9CA3AF" style={styles.icon} />
          <TextInput style={[styles.input, { color: '#9CA3AF' }]} value={phone} editable={false} />
        </View>

        <Text style={[styles.label, { marginTop: 8 }]}>Change Password (Optional)</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.icon} />
          <TextInput 
            style={styles.input} 
            value={newPassword} 
            onChangeText={setNewPassword} 
            placeholder="Enter new password" 
            placeholderTextColor="#9CA3AF" 
            secureTextEntry={!showPass} 
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 },
  avatarWrap: { alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#4F35D2', shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  avatarTxt: { fontSize: 32, fontWeight: '800', color: '#4F35D2' },
  roleBadge: { position: 'absolute', bottom: -10, backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  form: { padding: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, letterSpacing: 0.1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 15, height: 56, marginBottom: 20 },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  saveBtn: { backgroundColor: '#4F35D2', height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowColor: '#4F35D2', shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
