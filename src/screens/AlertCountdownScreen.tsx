import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Modal,
    StatusBar,
    Vibration,
} from 'react-native';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import PinInput from '../components/PinInput';
import { verifyPin, getTrustedContacts, getUserProfile } from '../utils/storage';

const COUNTDOWN_SECONDS = 45;

export default function AlertCountdownScreen({ navigation }: any) {
    const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinError, setPinError] = useState('');
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const colorAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Vibration pattern for urgency
        const vibrationInterval = setInterval(() => {
            Vibration.vibrate(200);
        }, 2000);

        return () => {
            clearInterval(vibrationInterval);
            Vibration.cancel();
        };
    }, []);

    useEffect(() => {
        // Pulse animation
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.05,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    useEffect(() => {
        if (secondsLeft <= 0) {
            handleAlertFire();
            return;
        }

        const timer = setTimeout(() => {
            setSecondsLeft((prev) => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [secondsLeft]);

    const handleAlertFire = async () => {
        // In production, this calls Shakeeb's /alert/fire endpoint
        // For now, navigate to AlertFired screen
        try {
            const profile = await getUserProfile();
            const contacts = await getTrustedContacts();
            navigation.replace('AlertFired', {
                profile,
                contacts,
                timestamp: new Date().toISOString(),
            });
        } catch {
            navigation.replace('AlertFired', {
                timestamp: new Date().toISOString(),
            });
        }
    };

    const handlePinSubmit = async (pin: string) => {
        const isValid = await verifyPin(pin);
        if (isValid) {
            setShowPinModal(false);
            navigation.goBack();
        } else {
            setPinError('Wrong PIN. Try again.');
        }
    };

    const progress = secondsLeft / COUNTDOWN_SECONDS;
    const isUrgent = secondsLeft <= 10;

    return (
        <View style={[styles.container, isUrgent && styles.containerUrgent]}>
            <StatusBar barStyle="light-content" backgroundColor={isUrgent ? '#1A0000' : Colors.background} />

            {/* Timer Section */}
            <View style={styles.timerSection}>
                <Text style={styles.alertText}>⚠️ ALERT WILL FIRE IN</Text>

                <Animated.View
                    style={[styles.timerCircle, { transform: [{ scale: scaleAnim }] }]}
                >
                    <Text
                        style={[
                            styles.timerText,
                            isUrgent && styles.timerTextUrgent,
                        ]}
                    >
                        {secondsLeft}
                    </Text>
                    <Text style={styles.timerLabel}>seconds</Text>
                </Animated.View>

                <Text style={styles.instructionText}>
                    Enter PIN to cancel. Alert will send SMS to police & your trusted contacts.
                </Text>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${progress * 100}%`,
                                backgroundColor: isUrgent ? Colors.danger : Colors.warning,
                            },
                        ]}
                    />
                </View>
            </View>

            {/* Cancel Button (lower half) */}
            <View style={styles.cancelSection}>
                <TouchableOpacity
                    style={styles.pinCancelBtn}
                    onPress={() => {
                        setPinError('');
                        setShowPinModal(true);
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={styles.pinCancelText}>🔐 Enter PIN to Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                        setPinError('');
                        setShowPinModal(true);
                    }}
                    activeOpacity={0.8}
                >
                    <Text style={styles.cancelBtnText}>CANCEL ALERT</Text>
                    <Text style={styles.cancelSubtext}>Requires your 6-digit PIN</Text>
                </TouchableOpacity>
            </View>

            {/* PIN Entry Modal */}
            <Modal
                visible={showPinModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowPinModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            style={styles.modalClose}
                            onPress={() => setShowPinModal(false)}
                        >
                            <Text style={styles.modalCloseText}>✕</Text>
                        </TouchableOpacity>
                        <PinInput
                            title="Enter PIN to Cancel"
                            subtitle="Enter your 6-digit PIN"
                            onComplete={handlePinSubmit}
                            error={pinError}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    containerUrgent: {
        backgroundColor: '#1A0000',
    },
    timerSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    alertText: {
        color: Colors.warning,
        fontSize: FontSizes.md,
        fontWeight: '700',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: Spacing.xl,
    },
    timerCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 4,
        borderColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(192, 57, 43, 0.1)',
        marginBottom: Spacing.xl,
    },
    timerText: {
        fontSize: 80,
        fontWeight: '900',
        color: Colors.warning,
    },
    timerTextUrgent: {
        color: Colors.danger,
    },
    timerLabel: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: -Spacing.sm,
    },
    instructionText: {
        color: Colors.textSecondary,
        fontSize: FontSizes.sm,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    progressBar: {
        width: '80%',
        height: 4,
        backgroundColor: Colors.surfaceLight,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    cancelSection: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xxl,
        gap: Spacing.md,
    },
    pinCancelBtn: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pinCancelText: {
        color: Colors.text,
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    cancelBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.xl,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.primaryLight,
    },
    cancelBtnText: {
        color: Colors.white,
        fontSize: FontSizes.xxl,
        fontWeight: '900',
        letterSpacing: 2,
    },
    cancelSubtext: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: FontSizes.sm,
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        paddingBottom: Spacing.xxl,
        minHeight: '70%',
    },
    modalClose: {
        alignSelf: 'flex-end',
        padding: Spacing.md,
    },
    modalCloseText: {
        color: Colors.textSecondary,
        fontSize: FontSizes.xl,
    },
});
