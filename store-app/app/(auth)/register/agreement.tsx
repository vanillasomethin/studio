import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../../lib/colors';
import { storeRegister } from '../../../lib/api';
import { saveSession } from '../../../lib/storage';
import { makeReferralCode, type FormData } from '../../../lib/validation';

const TERMS = [
  { h: 'Remuneration', b: 'VS Collective LLP pays ₹500/month per screen within 10 working days of month end via UPI/NEFT.' },
  { h: 'Electricity', b: 'Reimbursed at screen rated power × actual hours × prevailing tariff. Submit monthly bills.' },
  { h: 'Generator / UPS', b: 'Generator usage reimbursed proportionally based on screen share of load × fuel cost × hours.' },
  { h: 'Referral reward', b: '₹500 bonus for every new store partner who joins using your code, paid within 10 working days.' },
  { h: 'Equipment', b: 'Screens installed free and remain ALIVE property at all times. No right or title vests in the Shop Owner.' },
  { h: 'Your obligations', b: 'Provide unobstructed space during business hours. Do not tamper, relocate, or allow competing equipment.' },
  { h: 'Exclusivity', b: 'ALIVE will not install any screen within 200 m of your premises for the duration of this agreement.' },
  { h: 'Operating hours', b: 'Screens run during your business hours (~8 AM–10 PM). Maintenance is scheduled off-peak.' },
  { h: 'Exit', b: '30 days written notice by either party. ALIVE removes the screen at its own cost within 15 working days.' },
  { h: 'Content', b: 'All content managed exclusively by ALIVE. Screens must not be used for personal or non-approved purposes.' },
  { h: 'Governing law', b: 'Governed by laws of India. Disputes resolved by arbitration in Mangaluru under the A&C Act, 1996.' },
  { h: 'Digital execution', b: 'Executed electronically under the IT Act, 2000. Electronic acceptance is legally binding.' },
];

export default function AgreementStep() {
  const router = useRouter();
  const { formJson } = useLocalSearchParams<{ formJson: string }>();
  const form: FormData = formJson ? JSON.parse(formJson) : {};

  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const fullAddress = [form.address, form.locality, form.city, form.pincode].filter(Boolean).join(', ');

  const submit = async () => {
    if (!agreed) { Alert.alert('Agreement required', 'Please read and accept the agreement to continue.'); return; }
    setBusy(true); setError('');
    const referralCode = makeReferralCode(form.storeName, form.ownerName);
    try {
      const result = await storeRegister({
        ...form,
        gstin: form.gstin ? form.gstin.toUpperCase() : undefined as unknown as string,
        referralCode,
        agreedAt: new Date().toISOString(),
      });
      if (result.error) { setError(result.error); return; }
      await saveSession({
        storeName: form.storeName,
        ownerName: form.ownerName,
        whatsapp: form.whatsapp,
        city: form.city,
        locality: form.locality,
        address: form.address,
        pincode: form.pincode,
        gstin: form.gstin || undefined,
        referralCode: result.referralCode ?? referralCode,
        referredBy: form.referredBy || undefined,
        agreedAt: new Date().toISOString(),
      });
      router.replace('/(dashboard)/');
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={s.steps}>
            <View style={[s.step, s.stepDone]}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
            <View style={[s.stepLine, { backgroundColor: C.primary }]} />
            <View style={[s.step, s.stepActive]}><Text style={s.stepText}>2</Text></View>
          </View>
        </View>

        <Text style={s.eyebrow}>Step 2 of 2</Text>
        <Text style={s.title}>Store Partner Agreement</Text>
        <Text style={s.sub}>Read all terms, then sign digitally to complete registration.</Text>

        {/* Parties */}
        <View style={s.partiesBox}>
          <View style={s.party}>
            <Text style={s.partyLabel}>Party A — Company</Text>
            <Text style={s.partyName}>VS Collective LLP (ALIVE)</Text>
            <Text style={s.partySub}>#13, First Floor, Highland Manor, Falnir, Mangalore 575002</Text>
            <Text style={s.partySub}>GSTIN: 29AAXFV2589C1ZE · LLP: IN-KA43598411418020V</Text>
          </View>
          <View style={[s.party, { borderTopWidth: 1, borderTopColor: C.primaryBorder, marginTop: 12, paddingTop: 12 }]}>
            <Text style={s.partyLabel}>Party B — Store Partner</Text>
            <Text style={s.partyName}>{form.storeName}</Text>
            <Text style={s.partySub}>{form.ownerName} · +91 {form.whatsapp}</Text>
            {fullAddress ? <Text style={s.partySub}>{fullAddress}</Text> : null}
            {form.gstin ? <Text style={[s.partySub, s.mono]}>GSTIN: {form.gstin.toUpperCase()}</Text> : null}
            <Text style={[s.partySub, { marginTop: 4 }]}>Date: {today}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={s.termsBox}>
          <Text style={s.termsHeader}>Terms &amp; Conditions</Text>
          {TERMS.map(({ h, b }) => (
            <View key={h} style={s.termRow}>
              <Text style={s.termHeading}>{h}</Text>
              <Text style={s.termBody}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Checkbox */}
        <TouchableOpacity style={s.checkRow} onPress={() => setAgreed((v) => !v)} activeOpacity={0.8}>
          <View style={[s.checkbox, agreed && s.checkboxChecked]}>
            {agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={s.checkLabel}>
            I, <Text style={s.bold}>{form.ownerName}</Text>, on behalf of{' '}
            <Text style={s.bold}>{form.storeName}</Text>, have read and agree to the Store Partner Agreement
            with VS Collective LLP (ALIVE), effective {today}. I confirm this electronic acceptance is
            legally binding under the IT Act, 2000.
          </Text>
        </TouchableOpacity>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={14} color={C.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.btn, (!agreed || busy) && s.btnDisabled]}
          onPress={submit}
          disabled={!agreed || busy}
        >
          {busy
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.btnText}>I agree — Register my store</Text>
              </>
            )
          }
        </TouchableOpacity>
        {busy && <Text style={s.busyNote}>This can take up to 20 seconds…</Text>}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 4, marginRight: 16 },
  steps: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  step: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: C.primary },
  stepDone: { backgroundColor: C.success },
  stepText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: C.border, marginHorizontal: 6 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 6 },
  sub: { fontSize: 13, color: C.textSub, marginBottom: 20, lineHeight: 19 },
  partiesBox: { backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 16, padding: 16, marginBottom: 16 },
  party: {},
  partyLabel: { fontSize: 9, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  partyName: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 2 },
  partySub: { fontSize: 12, color: C.textSub, lineHeight: 18 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  termsBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  termsHeader: { fontSize: 12, fontWeight: '700', color: C.text, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: '#f9fafb' },
  termRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10 },
  termHeading: { width: 90, fontSize: 11, fontWeight: '700', color: C.text },
  termBody: { flex: 1, fontSize: 11, color: C.textSub, lineHeight: 16 },
  checkRow: { flexDirection: 'row', gap: 12, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  checkLabel: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 18 },
  bold: { fontWeight: '700', color: C.text },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  busyNote: { textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 8 },
  errorBox: { flexDirection: 'row', gap: 8, backgroundColor: C.errorLight, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 12, color: C.error, lineHeight: 18 },
});
