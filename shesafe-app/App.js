// SheSafe — Root Navigation (Role-based)
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
const RootStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function VictimTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { borderTopWidth: 0, elevation: 0, shadowOpacity: 0 }, tabBarActiveTintColor: '#6C3CE1', tabBarInactiveTintColor: '#9CA3AF' }}>
      <Tab.Screen name="Protection" component={VictimScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🛡️</Text>, tabBarLabel: 'Protect' }} />
    </Tab.Navigator>
  );
}

function PoliceTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { borderTopWidth: 0, elevation: 0 }, tabBarActiveTintColor: '#1D4ED8', tabBarInactiveTintColor: '#9CA3AF' }}>
      <Tab.Screen name="Alerts" component={PoliceScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🚨</Text> }} />
    </Tab.Navigator>
  );
}

function ContactTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { borderTopWidth: 0, elevation: 0 }, tabBarActiveTintColor: '#059669', tabBarInactiveTintColor: '#9CA3AF' }}>
      <Tab.Screen name="Track" component={ContactScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📍</Text> }} />
    </Tab.Navigator>
  );
}

function MainNavigator({ role }) {
  if (role === 'police') return <PoliceTabs />;
  if (role === 'contact') return <ContactTabs />;
  return <VictimTabs />;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    getStoredUser().then(u => { setUser(u); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>🛡️</Text>
        <Text style={styles.splashName}>SheSafe</Text>
        <ActivityIndicator color="#6C3CE1" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main">
            {() => <MainNavigator role={user.role} />}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  splashLogo: { fontSize: 64 },
  splashName: { fontSize: 32, fontWeight: '900', color: '#6C3CE1', marginTop: 12, letterSpacing: -1 },
});
