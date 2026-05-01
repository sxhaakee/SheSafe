import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { isOnboardingComplete } from '../utils/storage';

import PermissionsScreen from '../screens/PermissionsScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import PinSetupScreen from '../screens/PinSetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AlertCountdownScreen from '../screens/AlertCountdownScreen';
import AlertFiredScreen from '../screens/AlertFiredScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const [initialRoute, setInitialRoute] = useState<string | null>(null);

    useEffect(() => {
        checkOnboarding();
    }, []);

    const checkOnboarding = async () => {
        const complete = await isOnboardingComplete();
        setInitialRoute(complete ? 'Dashboard' : 'Permissions');
    };

    if (!initialRoute) return null;

    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: '#0D0D0D' },
                }}
            >
                {/* Onboarding */}
                <Stack.Screen name="Permissions" component={PermissionsScreen} />
                <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                <Stack.Screen name="PinSetup" component={PinSetupScreen} />

                {/* Main App */}
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen
                    name="AlertCountdown"
                    component={AlertCountdownScreen}
                    options={{ gestureEnabled: false }}
                />
                <Stack.Screen
                    name="AlertFired"
                    component={AlertFiredScreen}
                    options={{ gestureEnabled: false }}
                />
                <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
