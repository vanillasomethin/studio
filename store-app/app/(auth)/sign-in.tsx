import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';
import { storeLogin, requestPasswordReset, verifyPasswordReset } from '../../lib/api';
import { saveSession } from '../../lib/storage';

type View_ = 'login' | 'forgot_phone' | 'forgot_otp' | 'forgot_done';

export default function SignIn() {
  const router = useRouter();
  const { prefillPhone } = useLocalSearchParams<{ prefillPhone?: string }>();
  const [view, setView] = useState<View_>('login');

  // Login fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (prefillPhone) setPhone(prefillPhone.replace(/\D/g, '').slice(0, 10));
  }, [prefillPhone]);

  // Reset fields
  const [resetPhone, setResetPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (phone.length !== 10) { setError('Enter a valid 10-digit WhatsApp number.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true); setError(null);
    try {
      const result = await storeLogin(phone, password);
      if (result.error || !result.store) {
        setError(result.error ?? 'Incorrect number or password.');
        return;
      }
      await saveSession(result.store);
      router.replace('/(dashboard)/');
    } catch (e) {
      setError((e as Error).message ?? 'Could not connect. Check your internet.');
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    if (resetPhone.length !== 10) { setError('Enter a valid 10-digit number.'); return; }
    setBusy(true); setError(null);
    try {
      await requestPasswordReset(`+91${resetPhone}`);
      setView('forgot_otp');
    } catch (e) {
      setError((e as Error).message ?? 'Could not send code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit code from WhatsApp.'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await verifyPasswordReset(resetPhone, otp, newPw);
      if (res.error) { setError(res.error); return; }
      setView('forgot_done');
    } catch (e) {
      setError((e as Error).message ?? 'Could not verify. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = () => {
    setView('login'); setError(null);
    setResetPhone(''); setOtp(''); setNewPw('');
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo word-mark */}
          <Text style={s.logo}>ALIVE</Text>

          {/* ── Login ── */}
          {view === 'login' && (
            <View style={s.card}>
              <Text style={s.eyebrow}>Store Partner Portal</Text>
              <Text style={s.title}>Sign in</Text>
              <Text style={s.sub}>Use your registered WhatsApp number and password.</Text>

              <Text style={s.label}>WhatsApp number</Text>
              <View style={s.prefixRow}>
                <View style={s.prefix}><Text style={s.prefixText}>+91</Text></View>
                <TextInput
                  style={[s.input, s.prefixInput]}
                  placeholder="98765 43210"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                />
              </View>

              <View style={s.labelRow}>
                <Text style={s.label}>Password</Text>
                <TouchableOpacity onPress={() => { setResetPhone(phone); setView('forgot_phone'); setError(null); }}>
                  <Text style={s.link}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Your login password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)}>
                  <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>

              {error && <ErrorBox msg={error} />}

              <TouchableOpacity
                style={[s.btn, (busy || phone.length !== 10 || !password) && s.btnDisabled]}
                onPress={submit}
                disabled={busy || phone.length !== 10 || !password}
              >
                {busy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Sign in</Text>
                }
              </TouchableOpacity>

              <View style={s.footer}>
                <Text style={s.footerText}>New to Alive? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register/')}>
                  <Text style={s.link}>Register your store →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Forgot: enter phone ── */}
          {view === 'forgot_phone' && (
            <View style={s.card}>
              <TouchableOpacity style={s.backRow} onPress={backToLogin}>
                <Ionicons name="arrow-back" size={16} color={C.textSub} />
                <Text style={s.backText}>Back to sign in</Text>
              </TouchableOpacity>
              <Text style={s.title}>Reset password</Text>
              <Text style={s.sub}>We'll send a 6-digit code to your WhatsApp.</Text>

              <Text style={s.label}>Registered WhatsApp number</Text>
              <View style={s.prefixRow}>
                <View style={s.prefix}><Text style={s.prefixText}>+91</Text></View>
                <TextInput
                  style={[s.input, s.prefixInput]}
                  placeholder="98765 43210"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  value={resetPhone}
                  onChangeText={(t) => setResetPhone(t.replace(/\D/g, '').slice(0, 10))}
                />
              </View>

              {error && <ErrorBox msg={error} />}

              <TouchableOpacity
                style={[s.btn, (busy || resetPhone.length !== 10) && s.btnDisabled]}
                onPress={requestOtp}
                disabled={busy || resetPhone.length !== 10}
              >
                {busy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Send code via WhatsApp</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Forgot: enter OTP + new password ── */}
          {view === 'forgot_otp' && (
            <View style={s.card}>
              <TouchableOpacity style={s.backRow} onPress={() => { setView('forgot_phone'); setError(null); }}>
                <Ionicons name="arrow-back" size={16} color={C.textSub} />
                <Text style={s.backText}>Back</Text>
              </TouchableOpacity>
              <Text style={s.title}>Enter code</Text>
              <Text style={s.sub}>Sent to +91 {resetPhone} via WhatsApp.</Text>

              <Text style={s.label}>6-digit code</Text>
              <TextInput
                style={[s.input, s.otpInput]}
                placeholder="123456"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
                maxLength={6}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              />

              <Text style={s.label}>New password</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showNewPw}
                  value={newPw}
                  onChangeText={setNewPw}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNewPw((v) => !v)}>
                  <Ionicons name={showNewPw ? 'eye-off' : 'eye'} size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>

              {error && <ErrorBox msg={error} />}

              <TouchableOpacity
                style={[s.btn, (busy || otp.length !== 6 || newPw.length < 6) && s.btnDisabled]}
                onPress={verifyOtp}
                disabled={busy || otp.length !== 6 || newPw.length < 6}
              >
                {busy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Set new password</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={s.footer} onPress={() => { setView('forgot_phone'); setError(null); }}>
                <Text style={s.footerText}>Didn't receive it? </Text>
                <Text style={s.link}>Resend code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Success ── */}
          {view === 'forgot_done' && (
            <View style={[s.card, { alignItems: 'center' }]}>
              <View style={s.successCircle}>
                <Ionicons name="checkmark" size={32} color={C.success} />
              </View>
              <Text style={[s.title, { textAlign: 'center' }]}>Password updated</Text>
              <Text style={[s.sub, { textAlign: 'center' }]}>Sign in with your new password.</Text>
              <TouchableOpacity style={[s.btn, { marginTop: 20 }]} onPress={backToLogin}>
                <Text style={s.btnText}>Go to sign in</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <View style={s.errorBox}>
      <Ionicons name="alert-circle" size={14} color={C.error} />
      <Text style={s.errorText}>{msg}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  logo: { fontSize: 22, fontWeight: '900', color: C.primary, letterSpacing: 4, textAlign: 'center', marginBottom: 28 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
  eyebrow: { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 6 },
  sub: { fontSize: 13, color: C.textSub, marginBottom: 20, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: C.text,
  },
  prefixRow: { flexDirection: 'row', alignItems: 'stretch' },
  prefix: {
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: C.border,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    paddingHorizontal: 12, justifyContent: 'center',
  },
  prefixText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  prefixInput: {
    flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },
  otpInput: { textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 8 },
  btn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 20,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { color: C.primary, fontWeight: '600', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  footerText: { fontSize: 13, color: C.textSub },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 13, color: C.textSub },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.errorLight, borderWidth: 1, borderColor: C.primaryBorder,
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: C.error, lineHeight: 18 },
  successCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
});
