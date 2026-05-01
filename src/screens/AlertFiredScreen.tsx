import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Animated, StatusBar, Alert,
} from 'react-native';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { getTrustedContacts, getUserProfile, TrustedContact, UserProfile } from '../utils/storage';

const DEMO_STATIONS = [
    { name: 'Koramangala PS', phone: '080-25530555' },
    { name: 'HSR Layout PS', phone: '080-25530556' },
    { name: 'Madiwala PS', phone: '080-25530557' },
];

export default function AlertFiredScreen({ navigation }: any) {
    const [contacts, setContacts] = useState<TrustedContact[]>([]);
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getTrustedContacts().then(setContacts);
        Animated.loop(Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ])).start();
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const handleImSafe = () => {
        Alert.alert('Cancel Alert', 'Are you sure you are safe?', [
            { text: 'No', style: 'cancel' },
            { text: "Yes, I'm safe", onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] }) },
        ]);
    };

    return (
        <View style={s.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1A0000" />
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <Animated.View style={[s.header, { opacity: fadeAnim }]}>
                    <Text style={s.icon}>🚨</Text>
                    <Text style={s.title}>ALERT DISPATCHED</Text>
                    <Text style={s.time}>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                </Animated.View>

                <View style={s.recBanner}>
                    <Animated.View style={[s.recDot, { opacity: pulseAnim }]} />
                    <Text style={s.recText}>Evidence Recording Active</Text>
                </View>

                <Text style={s.secTitle}>🚔 Police Stations Notified</Text>
                {DEMO_STATIONS.map((st, i) => (
                    <View key={i} style={s.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.cardName}>{st.name}</Text>
                            <Text style={s.cardPhone}>{st.phone}</Text>
                        </View>
                        <View style={s.badge}><Text style={s.badgeText}>✓ Sent</Text></View>
                    </View>
                ))}

                <Text style={[s.secTitle, { marginTop: Spacing.lg }]}>👥 Trusted Contacts Notified</Text>
                {contacts.map((c) => (
                    <View key={c.id} style={s.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.cardName}>{c.name}</Text>
                            <Text style={s.cardPhone}>{c.phone}</Text>
                        </View>
                        <View style={s.badge}><Text style={s.badgeText}>✓ Sent</Text></View>
                    </View>
                ))}

                <View style={s.mapBox}>
                    <Text style={{ fontSize: 40 }}>📍</Text>
                    <Text style={s.mapText}>Live Location Sharing Active</Text>
                    <Text style={s.mapSub}>Shared every 30 seconds with contacts</Text>
                </View>

                <TouchableOpacity style={s.safeBtn} onPress={handleImSafe} activeOpacity={0.8}>
                    <Text style={s.safeBtnText}>✓ I'm Safe — Cancel Alert</Text>
                </TouchableOpacity>
                <Text style={s.footer}>Emergency services have been notified. Stay safe.</Text>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A0000' },
    scroll: { padding: Spacing.lg, paddingTop: Spacing.xxl + 20, paddingBottom: Spacing.xxl },
    header: { alignItems: 'center', marginBottom: Spacing.lg },
    icon: { fontSize: 60 },
    title: { fontSize: FontSizes.xxl, fontWeight: '900', color: Colors.danger, letterSpacing: 3 },
    time: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.xs },
    recBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(231,76,60,0.15)', borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: 'rgba(231,76,60,0.3)' },
    recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.danger },
    recText: { color: Colors.danger, fontSize: FontSizes.sm, fontWeight: '700' },
    secTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    cardName: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '600' },
    cardPhone: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
    badge: { backgroundColor: 'rgba(39,174,96,0.2)', borderRadius: BorderRadius.sm, paddingVertical: 4, paddingHorizontal: Spacing.sm },
    badgeText: { color: Colors.safe, fontSize: FontSizes.xs, fontWeight: '700' },
    mapBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginVertical: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    mapText: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '600', marginTop: Spacing.sm },
    mapSub: { color: Colors.textSecondary, fontSize: FontSizes.xs, marginTop: 4 },
    safeBtn: { backgroundColor: Colors.safe, borderRadius: BorderRadius.xl, paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md },
    safeBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '800' },
    footer: { color: Colors.textMuted, fontSize: FontSizes.xs, textAlign: 'center' },
});
