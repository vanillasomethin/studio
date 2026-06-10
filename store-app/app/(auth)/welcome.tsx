import { useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';

const FEATURES = [
  {
    icon: 'cash-outline' as const,
    title: '₹500 + electricity/month',
    sub: 'Fixed payout via UPI within 10 working days of month end.',
  },
  {
    icon: 'tv-outline' as const,
    title: 'Free screen, zero deposit',
    sub: 'We install and own the screen. You pay nothing ever.',
  },
  {
    icon: 'construct-outline' as const,
    title: 'We handle everything',
    sub: 'Content, tech support, and screen maintenance — all on us.',
  },
  {
    icon: 'flash-outline' as const,
    title: 'Live in 48 hours',
    sub: 'Our team visits and sets up your screen within 2 days.',
  },
  {
    icon: 'ribbon-outline' as const,
    title: 'Exclusive per area',
    sub: 'Only 1–2 stores selected per locality — limited spots.',
  },
  {
    icon: 'gift-outline' as const,
    title: '₹500 joining bonus',
    sub: 'Credited the day your screen goes live — no conditions.',
  },
];

const HOW = [
  { n: '01', t: 'Register below',     d: 'Takes 2 minutes on your phone.' },
  { n: '02', t: 'We visit & install', d: 'Free screen within 48 hours.' },
  { n: '03', t: 'Earn every month',   d: '₹500 + electricity to your account.' },
];

export default function Welcome() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [60, 120], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <SafeAreaView style={s.safe}>
      {/* Sticky header with fade-in on scroll */}
      <Animated.View style={[s.stickyHeader, { opacity: headerOpacity }]}>
        <Text style={s.stickyLogo}>ALIVE</Text>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={s.scroll}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveBadgeText}>Kirana Partners · Mangaluru</Text>
          </View>
          <Text style={s.heroTitle}>Extra income.{'\n'}<Text style={s.heroRed}>Zero effort.</Text></Text>
          <Text style={s.heroSub}>
            Alive installs a free digital screen in your store. Brands pay to advertise.{'\n'}
            You earn <Text style={s.bold}>₹500 + electricity every month</Text> — without lifting a finger.
          </Text>
        </View>

        {/* Features grid */}
        <View style={s.section}>
          {FEATURES.map(({ icon, title, sub }) => (
            <View key={title} style={s.featureRow}>
              <View style={s.featureIcon}>
                <Ionicons name={icon} size={18} color={C.primary} />
              </View>
              <View style={s.featureMeta}>
                <Text style={s.featureTitle}>{title}</Text>
                <Text style={s.featureSub}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={s.howBox}>
          <Text style={s.howLabel}>How it works</Text>
          {HOW.map(({ n, t, d }) => (
            <View key={n} style={s.howRow}>
              <Text style={s.howN}>{n}</Text>
              <View style={s.howMeta}>
                <Text style={s.howTitle}>{t}</Text>
                <Text style={s.howSub}>{d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Payout summary */}
        <View style={s.payoutBox}>
          {[
            { label: 'Security deposit', value: '₹0',        note: 'No deposit ever.' },
            { label: 'Monthly payout',   value: '₹500+',     note: 'Credited within 10 working days.' },
            { label: 'Electricity',      value: 'Paid',       note: 'Reimbursed at metered rate.' },
          ].map(({ label, value, note }) => (
            <View key={label} style={s.payoutRow}>
              <Text style={s.payoutLabel}>{label}</Text>
              <View style={s.payoutRight}>
                <Text style={s.payoutValue}>{value}</Text>
                <Text style={s.payoutNote}>{note}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={s.ctaBlock}>
          <TouchableOpacity style={s.btnPrimary} onPress={() => router.push('/(auth)/register/')}>
            <Text style={s.btnPrimaryText}>Get started — it's free</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGhost} onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={s.btnGhostText}>Already a partner? Sign in</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.fine}>
          By registering you agree to the ALIVE Store Partner Agreement.{'\n'}
          VS Collective LLP · GST 29AAXFV2589C1ZE
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    height: 52, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stickyLogo: { fontSize: 18, fontWeight: '900', color: C.primary, letterSpacing: 4 },
  scroll: { paddingBottom: 48 },

  hero: { padding: 24, paddingTop: 40, paddingBottom: 28 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  liveBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
  heroTitle: { fontSize: Math.min(width * 0.1, 40), fontWeight: '900', color: C.text, lineHeight: Math.min(width * 0.115, 46), letterSpacing: -0.5, marginBottom: 12 },
  heroRed: { color: C.primary },
  heroSub: { fontSize: 14, color: C.textSub, lineHeight: 22 },
  bold: { fontWeight: '700', color: C.text },

  section: { paddingHorizontal: 20, gap: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  featureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureMeta: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  featureSub: { fontSize: 12, color: C.textSub, lineHeight: 17 },

  howBox: { margin: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  howLabel: { fontSize: 9, fontWeight: '700', color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  howN: { fontSize: 11, fontWeight: '900', color: C.primary, width: 22, marginTop: 1 },
  howMeta: { flex: 1 },
  howTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 1 },
  howSub: { fontSize: 12, color: C.textSub },

  payoutBox: { marginHorizontal: 20, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  payoutLabel: { fontSize: 12, color: C.textSub, fontWeight: '500' },
  payoutRight: { alignItems: 'flex-end' },
  payoutValue: { fontSize: 14, fontWeight: '800', color: C.text },
  payoutNote: { fontSize: 10, color: C.textMuted, marginTop: 1 },

  ctaBlock: { marginHorizontal: 20, marginTop: 28, gap: 10 },
  btnPrimary: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnGhost: {
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: { color: C.text, fontWeight: '600', fontSize: 14 },

  fine: { textAlign: 'center', fontSize: 10, color: C.textMuted, lineHeight: 16, marginTop: 20, paddingHorizontal: 24 },
});
