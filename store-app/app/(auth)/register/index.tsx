import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../../lib/colors';
import { validateForm, FORM_INIT, passwordScore, type FormData, type FieldErrors } from '../../../lib/validation';

export default function RegisterStep1() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(FORM_INIT);
  const [touched, setTouched] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const fe = (k: keyof FormData): string | undefined => (touched ? errors[k] : undefined);

  const grabLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is needed to pin your shop.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      set('lat', String(latitude));
      set('lng', String(longitude));
      // Reverse geocode
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo) {
        if (geo.subregion || geo.district) set('locality', geo.subregion ?? geo.district ?? '');
        if (geo.city || geo.region) set('city', geo.city ?? geo.region ?? '');
        if (geo.postalCode) set('pincode', geo.postalCode.replace(/\D/g, '').slice(0, 6));
      }
    } catch {
      Alert.alert('Error', 'Could not get your location. Enter address manually.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleContinue = () => {
    if (hasErrors) { setTouched(true); return; }
    router.push({ pathname: '/(auth)/register/agreement', params: { formJson: JSON.stringify(form) } });
  };

  const score = passwordScore(form.password);
  const barColors = ['#e5e7eb', '#ef4444', '#f59e0b', '#eab308', '#22c55e'];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </TouchableOpacity>
            <View style={s.steps}>
              <View style={[s.step, s.stepActive]}><Text style={s.stepText}>1</Text></View>
              <View style={s.stepLine} />
              <View style={s.step}><Text style={[s.stepText, { color: C.textMuted }]}>2</Text></View>
            </View>
          </View>

          <Text style={s.eyebrow}>Step 1 of 2</Text>
          <Text style={s.title}>Register your store</Text>

          {/* Store name */}
          <Field label="Store name" error={fe('storeName')}>
            <TextInput style={[s.input, fe('storeName') && s.inputErr]} placeholder="Sharma Store"
              placeholderTextColor={C.textMuted} value={form.storeName}
              onChangeText={(v) => set('storeName', v)} />
          </Field>

          {/* Owner name */}
          <Field label="Owner name" error={fe('ownerName')}>
            <TextInput style={[s.input, fe('ownerName') && s.inputErr]} placeholder="Ramesh Sharma"
              placeholderTextColor={C.textMuted} value={form.ownerName}
              onChangeText={(v) => set('ownerName', v)} />
          </Field>

          {/* WhatsApp */}
          <Field label="WhatsApp number (this is your login username)" error={fe('whatsapp')}>
            <View style={s.prefixRow}>
              <View style={s.prefix}><Text style={s.prefixText}>+91</Text></View>
              <TextInput
                style={[s.input, s.prefixInput, fe('whatsapp') && s.inputErr]}
                placeholder="98765 43210" placeholderTextColor={C.textMuted}
                keyboardType="numeric" maxLength={10}
                value={form.whatsapp}
                onChangeText={(t) => set('whatsapp', t.replace(/\D/g, '').slice(0, 10))}
              />
            </View>
          </Field>

          {/* Password */}
          <Field label="Password" error={fe('password')}>
            <View style={s.pwRow}>
              <TextInput
                style={[s.input, { flex: 1 }, fe('password') && s.inputErr]}
                placeholder="Min. 6 characters" placeholderTextColor={C.textMuted}
                secureTextEntry={!showPw}
                value={form.password}
                onChangeText={(v) => set('password', v)}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)}>
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {form.password.length > 0 && (
              <View style={s.strengthBars}>
                {[1,2,3,4].map((i) => (
                  <View key={i} style={[s.strengthBar, { backgroundColor: i <= score ? barColors[score] : '#e5e7eb' }]} />
                ))}
              </View>
            )}
          </Field>

          {/* Location */}
          <Text style={s.label}>Shop location</Text>
          <TouchableOpacity style={s.gpsBtn} onPress={grabLocation} disabled={gpsLoading}>
            {gpsLoading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Ionicons name="locate" size={16} color={C.primary} />
            }
            <Text style={s.gpsBtnText}>
              {form.lat ? `Pinned · ${parseFloat(form.lat).toFixed(4)}, ${parseFloat(form.lng).toFixed(4)}` : 'Use my current location'}
            </Text>
          </TouchableOpacity>

          {/* Address row */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Locality" error={undefined}>
                <TextInput style={s.input} placeholder="Kankanady" placeholderTextColor={C.textMuted}
                  value={form.locality} onChangeText={(v) => set('locality', v)} />
              </Field>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="Pincode" error={fe('pincode')}>
                <TextInput style={[s.input, fe('pincode') && s.inputErr]} placeholder="575002"
                  placeholderTextColor={C.textMuted} keyboardType="numeric" maxLength={6}
                  value={form.pincode}
                  onChangeText={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))} />
              </Field>
            </View>
          </View>

          <Field label="City" error={fe('city')}>
            <TextInput style={[s.input, fe('city') && s.inputErr]} placeholder="Mangaluru"
              placeholderTextColor={C.textMuted} value={form.city}
              onChangeText={(v) => set('city', v)} />
          </Field>

          <Field label="Shop address" error={fe('address')}>
            <TextInput style={[s.input, s.textarea, fe('address') && s.inputErr]}
              placeholder="Door no., street, landmark…" placeholderTextColor={C.textMuted}
              multiline numberOfLines={3} textAlignVertical="top"
              value={form.address} onChangeText={(v) => set('address', v)} />
          </Field>

          <Field label="GSTIN (optional)" error={fe('gstin')}>
            <TextInput style={[s.input, s.mono, fe('gstin') && s.inputErr]}
              placeholder="29AAXFV2589C1ZE" placeholderTextColor={C.textMuted}
              autoCapitalize="characters" maxLength={15}
              value={form.gstin}
              onChangeText={(v) => set('gstin', v.toUpperCase().replace(/\s/g, '').slice(0, 15))} />
          </Field>

          <Field label="Referral code (optional)" error={undefined}>
            <TextInput style={[s.input, s.mono]} placeholder="e.g. SHAR123"
              placeholderTextColor={C.textMuted} autoCapitalize="characters"
              value={form.referredBy}
              onChangeText={(v) => set('referredBy', v.toUpperCase())} />
          </Field>

          {touched && hasErrors && (
            <Text style={s.globalErr}>Please fix the highlighted fields above.</Text>
          )}

          <TouchableOpacity style={s.btn} onPress={handleContinue}>
            <Text style={s.btnText}>Continue to Agreement</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>Already registered? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={s.link}>Sign in →</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {error && (
        <View style={s.errorRow}>
          <Ionicons name="alert-circle" size={12} color={C.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 4, marginRight: 16 },
  steps: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  step: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: C.primary },
  stepText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepLine: { flex: 1, height: 1, backgroundColor: C.border, marginHorizontal: 6 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: C.text,
  },
  inputErr: { borderColor: C.error },
  prefixRow: { flexDirection: 'row', alignItems: 'stretch' },
  prefix: {
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: C.border,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    paddingHorizontal: 12, justifyContent: 'center',
  },
  prefixText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  prefixInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },
  strengthBars: { flexDirection: 'row', gap: 4, marginTop: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  textarea: { minHeight: 80, paddingTop: 12 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  row: { flexDirection: 'row' },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.primaryBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginTop: 6,
  },
  gpsBtnText: { fontSize: 13, color: C.primary, fontWeight: '600', flex: 1 },
  btn: {
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  globalErr: { fontSize: 12, color: C.error, textAlign: 'center', marginTop: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 13, color: C.textSub },
  link: { fontSize: 13, color: C.primary, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 11, color: C.error },
});
