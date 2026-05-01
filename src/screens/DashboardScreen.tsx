import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    StatusBar,
} from 'react-native';
import { Colors, FontSizes, Spacing, BorderRadius, getRiskColor, getRiskLevel } from '../theme';
import RiskCircle from '../components/RiskCircle';
import ShieldIcon from '../components/ShieldIcon';

export default function DashboardScreen({ navigation }: any) {
    // Simulated risk score for demo — in production, Rikash's sensor code feeds this
    const [riskScore, setRiskScore] = useState(15);
    const [alertActive, setAlertActive] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    // Simulate score changes for demo
    useEffect(() => {
        const interval = setInterval(() => {
            setRiskScore((prev) => {
                const change = Math.random() > 0.5 ? Math.floor(Math.random() * 5) : -Math.floor(Math.random() * 5);
                return Math.max(0, Math.min(100, prev + change));
            });
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleEmergencyTrigger = () => {
        navigation.navigate('AlertCountdown');
    };

    const riskColor = getRiskColor(riskScore);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

            {/* Header */}
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <View style={styles.headerLeft}>
                    <ShieldIcon size={36} />
                    <Text style={styles.headerTitle}>SheSafe</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsBtn}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <Text style={styles.settingsIcon}>⚙️</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Main Risk Circle */}
            <Animated.View style={[styles.riskContainer, { opacity: fadeAnim }]}>
                <RiskCircle score={riskScore} size={240} />
            </Animated.View>

            {/* Status info */}
            <View style={styles.statusSection}>
                <View style={[styles.statusDot, { backgroundColor: riskColor }]} />
                <Text style={[styles.statusText, { color: riskColor }]}>
                    {getRiskLevel(riskScore)}
                </Text>
            </View>

            <Text style={styles.monitoringText}>
                🛡️ Monitoring your safety in real-time
            </Text>

            {/* Info cards */}
            <View style={styles.infoCards}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoEmoji}>📍</Text>
                    <Text style={styles.infoTitle}>Location</Text>
                    <Text style={styles.infoValue}>Active</Text>
                </View>
                <View style={styles.infoCard}>
                    <Text style={styles.infoEmoji}>📱</Text>
                    <Text style={styles.infoTitle}>Motion</Text>
                    <Text style={styles.infoValue}>Normal</Text>
                </View>
                <View style={styles.infoCard}>
                    <Text style={styles.infoEmoji}>🌙</Text>
                    <Text style={styles.infoTitle}>Time Risk</Text>
                    <Text style={styles.infoValue}>Low</Text>
                </View>
            </View>

            {/* Emergency Button */}
            <TouchableOpacity
                style={styles.emergencyBtn}
                onPress={handleEmergencyTrigger}
                activeOpacity={0.8}
            >
                <Text style={styles.emergencyBtnText}>🚨 EMERGENCY</Text>
                <Text style={styles.emergencySubtext}>Tap to trigger alert</Text>
            </TouchableOpacity>

            {/* Hidden I'm Safe button — shows only during active alert */}
            {alertActive && (
                <TouchableOpacity
                    style={styles.safeBtn}
                    onPress={() => setAlertActive(false)}
                >
                    <Text style={styles.safeBtnText}>✓ I'm Safe</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xxl + 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: 1,
    },
    settingsBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsIcon: {
        fontSize: 22,
    },
    riskContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: Spacing.lg,
    },
    statusSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusText: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    monitoringText: {
        color: Colors.textSecondary,
        fontSize: FontSizes.sm,
        textAlign: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    infoCards: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    infoCard: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    infoEmoji: {
        fontSize: 24,
        marginBottom: Spacing.xs,
    },
    infoTitle: {
        color: Colors.textSecondary,
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    infoValue: {
        color: Colors.safe,
        fontSize: FontSizes.sm,
        fontWeight: '700',
        marginTop: 2,
    },
    emergencyBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.xl,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.primaryLight,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    emergencyBtnText: {
        color: Colors.white,
        fontSize: FontSizes.xl,
        fontWeight: '800',
        letterSpacing: 1,
    },
    emergencySubtext: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FontSizes.xs,
        marginTop: 4,
    },
    safeBtn: {
        backgroundColor: Colors.safe,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    safeBtnText: {
        color: Colors.white,
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
});
