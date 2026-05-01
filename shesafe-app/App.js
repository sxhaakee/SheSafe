// SheSafe — Root Navigation v5 (Auth state listener)
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import { getStoredUser } from './src/services/AuthService';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import VictimScreen from './src/screens/VictimScreen';
import PoliceScreen from './src/screens/PoliceScreen';
import ContactScreen from './src/screens/ContactScreen';

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Auth context so child screens can trigger login ────────────────────────
export const AuthContext = React.createContext({ onLogin: () => {} });

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function VictimTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { borderTopWidth: 0, elevation: 0, shadowOpacity: 0, backgroundColor: '#fff' },
      tabBarActiveTintColor: '#4F35D2',
      tabBarInactiveTintColor: '#9CA3AF',
    }}>
      <Tab.Screen name="Protection" component={VictimScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🛡️</Text>, tabBarLabel: 'Protect' }} />
    </Tab.Navigator>
  );
}

function PoliceTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { borderTopWidth: 0, elevation: 0, backgroundColor: '#fff' },
      tabBarActiveTintColor: '#1D4ED8',
      tabBarInactiveTintColor: '#9CA3AF',
    }}>
      <Tab.Screen name="Alerts" component={PoliceScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🚨</Text>, tabBarLabel: 'Alerts' }} />
    </Tab.Navigator>
  );
}

function ContactTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { borderTopWidth: 0, elevation: 0, backgroundColor: '#fff' },
      tabBarActiveTintColor: '#059669',
      tabBarInactiveTintColor: '#9CA3AF',
    }}>
      <Tab.Screen name="Track" component={ContactScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📍</Text>, tabBarLabel: 'Track' }} />
    </Tab.Navigator>
  );
}

function MainNavigator({ role }) {
  if (role === 'police')  return <PoliceTabs />;
  if (role === 'contact') return <ContactTabs />;
  return <VictimTabs />;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser]       = useState(null);

  const refreshUser = useCallback(async () => {
    const u = await getStoredUser();
    setUser(u);
    setLoading(false);
  }, []);

  useEffect(() => { refreshUser(); }, []);

  // Expose onLogin so LoginScreen/SignupScreen can trigger re-render
  const authContext = { onLogin: refreshUser };

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('./assets/shesafe-logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator color="#4F35D2" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <StatusBar style="dark" />
        {user
          ? <MainNavigator role={user.role} />
          : <AuthNavigator />
        }
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 220, height: 60 },
});
