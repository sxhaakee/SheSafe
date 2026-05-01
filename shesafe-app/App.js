/**
 * SheSafe — Main App Entry Point
 * Tab navigation with 3 roles: Victim, Police, Contact
 * Each phone runs one tab during demo.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import VictimScreen from './src/screens/VictimScreen';
import PoliceScreen from './src/screens/PoliceScreen';
import ContactScreen from './src/screens/ContactScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, emoji, focused }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0a0a0a',
            borderTopColor: '#27272a',
            height: 80,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Victim"
          component={VictimScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Victim" emoji="🛡️" focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Police"
          component={PoliceScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Police" emoji="🏛️" focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Contact"
          component={ContactScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Family" emoji="👨‍👩‍👧" focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIconActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#7c3aed',
    paddingBottom: 2,
  },
  tabEmoji: {
    fontSize: 22,
  },
  tabLabel: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#a78bfa',
    fontWeight: '800',
  },
});
