import { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Eye, EyeOff, KeyRound, Lock, Mail, Ticket, User, X } from 'lucide-react-native';
import type { AuthResponse, SessionLimitChallenge, LoginOtpChallenge } from '@brokeriq/shared';
import { LoginOtpForm } from '@/components/login-otp-form';
import { ApiError, post } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { showError, useLightStatusBar } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Button, Chip, IconBtn, Input, Row, Screen, Segmented, Txt } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'otp' | 'password' | 'signup';

function GoogleButton({
  clientIds,
  accountType,
  inviteCode,
  onDone,
  onError,
}: {
  clientIds: { web?: string; android?: string; ios?: string };
  accountType: 'USER' | 'BROKER';
  inviteCode?: string;
  onDone: (r: AuthResponse) => void;
  onError: (error: unknown) => void;
}) {
  const [req, res, prompt] = Google.useIdTokenAuthRequest({ webClientId: clientIds.web, androidClientId: clientIds.android, iosClientId: clientIds.ios });
  useEffect(() => {
    if (res?.type === 'success' && res.params.id_token)
      post<AuthResponse>('/auth/google', {
        idToken: res.params.id_token,
        accountType,
        inviteCode: accountType === 'BROKER' && inviteCode ? inviteCode : undefined,
      })
        .then(onDone)
        .catch(onError);
  }, [res, accountType, inviteCode]);
  return (
    <Button
      title="Google से continue करें"
      variant="secondary"
      disabled={!req}
      onPress={() => prompt()}
      icon={
        <Txt v="h3" color="#EA4335">
          G
        </Txt>
      }
    />
  );
}

export default function Login() {
  useLightStatusBar();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { app, integrations } = useConfig();
  const { setSession } = useAuth();
  const [factor, setFactor] = useState<LoginOtpChallenge | null>(null);
  const [selection, setSelection] = useState<SessionLimitChallenge | null>(null);
  const [mode, setMode] = useState<Mode>('password');
  const [accountType, setAccountType] = useState<'USER' | 'BROKER'>('USER');
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '', firmName: '', code: '', inviteCode: '' });
  const inviteOnly = app.auth?.allowBrokerSignup === false;
  useEffect(() => {
    if (mode === 'otp' && (app.auth?.allowEmailOtp === false || app.auth.requireLoginEmailOtp)) setMode('password');
    if (mode === 'password' && app.auth?.allowPasswordLogin === false && app.auth?.allowEmailOtp !== false && !app.auth.requireLoginEmailOtp) setMode('otp');
  }, [app.auth?.allowEmailOtp, app.auth?.allowPasswordLogin, app.auth.requireLoginEmailOtp, mode]);

  const invite = accountType === 'BROKER' && f.inviteCode ? f.inviteCode : undefined;
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const g = integrations.google_oauth as any;
  const googleOn = app.auth?.allowGoogle !== false && g?.configured && (g.webClientId || g.androidClientId);

  const done = async (r: AuthResponse) => {
    await setSession(r);
    toast.success(`स्वागत है, ${r.user.name.split(' ')[0]} 👋`);
    if (r.user.role === 'BROKER_ADMIN' && r.user.organization && !r.user.organization.onboarded) router.replace('/broker-onboarding');
    else router.replace(homeFor(r.user));
  };
  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.body.code === 'LOGIN_OTP_REQUIRED') {
      setFactor(error.body.details as LoginOtpChallenge);
      setF((prev) => ({ ...prev, password: '', code: '' }));
      setShowPassword(false);
    } else if (error instanceof ApiError && error.body.code === 'SESSION_LIMIT_REACHED') setSelection(error.body.details as SessionLimitChallenge);
    else showError(error);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      const r = await post<{ sent: boolean; devCode?: string }>('/auth/otp/request', { email: f.email.trim(), purpose: 'LOGIN' });
      setOtpSent(true);
      if (r.devCode) {
        setF((x) => ({ ...x, code: r.devCode! }));
        toast.info(`Dev mode: OTP ${r.devCode} (SMTP configure नहीं है)`);
      } else toast.success('OTP आपके email पर भेजा गया');
    });
  const verifyOtp = () =>
    run(async () =>
      done(await post<AuthResponse>('/auth/otp/verify', { email: f.email.trim(), code: f.code, name: f.name || undefined, accountType, inviteCode: invite })),
    );
  const login = () => run(async () => done(await post<AuthResponse>('/auth/login', { email: f.email.trim(), password: f.password })));
  const signup = () =>
    run(async () =>
      done(
        await post<AuthResponse>('/auth/register', {
          name: f.name,
          email: f.email.trim(),
          password: f.password,
          phone: f.phone || undefined,
          accountType,
          firmName: accountType === 'BROKER' ? f.firmName || undefined : undefined,
          inviteCode: invite,
        }),
      ),
    );

  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const modes = [
    ...(app.auth?.allowEmailOtp !== false && !app.auth.requireLoginEmailOtp ? [{ value: 'otp' as Mode, label: 'Email OTP' }] : []),
    ...(app.auth?.allowPasswordLogin !== false
      ? [
          { value: 'password' as Mode, label: 'Password' },
          { value: 'signup' as Mode, label: 'Create account' },
        ]
      : []),
  ];

  return (
    <Screen keyboard padded={false} edges={['bottom']}>
      <Modal
        visible={!!selection}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setSelection(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
          <View style={{ maxHeight: '85%', backgroundColor: c.surface, borderRadius: 24, padding: 20, gap: 12 }}>
            <Txt v="h3">Choose a device to sign out</Txt>
            <Txt>Five devices are signed in. Choose one to continue on this device.</Txt>
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              {selection?.sessions.map((device) => (
                <View key={device.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, gap: 8 }}>
                  <Txt>{device.userAgent || 'Unknown device'}</Txt>
                  <Txt v="caption">
                    {device.ip || '—'} · {new Date(device.lastUsedAt).toLocaleString()}
                  </Txt>
                  <Button
                    title="Sign out this device and continue"
                    loading={busy}
                    onPress={() =>
                      run(async () => {
                        const result = await post<AuthResponse>('/auth/sessions/replace', { challenge: selection.challenge, sessionId: device.id });
                        setSelection(null);
                        await done(result);
                      })
                    }
                  />
                </View>
              ))}
            </ScrollView>
            <Button title="Cancel" variant="secondary" disabled={busy} onPress={() => setSelection(null)} />
          </View>
        </View>
      </Modal>
      <LinearGradient
        colors={['#1E1B4B', '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 44, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h3" color="white">
            {app.siteName}
          </Txt>
          <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace('/(user)/home'))} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <X size={20} color="#fff" />
          </IconBtn>
        </Row>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Txt v="display" color="white" style={{ marginTop: 24 }}>
            {factor ? 'Verify your email' : 'नमस्ते 👋'}
          </Txt>
          <Txt color="rgba(255,255,255,0.8)" style={{ marginTop: 6 }}>
            {factor ? 'Sign-in का अंतिम चरण' : app.tagline}
          </Txt>
        </Animated.View>
      </LinearGradient>
      <View style={{ padding: 20, marginTop: -28, gap: 16 }}>
        {(factor || modes.length > 0) && (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: 24,
              padding: 18,
              gap: 16,
              borderWidth: 1,
              borderColor: c.line,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 20,
              elevation: 4,
            }}
          >
            {factor ? (
              <LoginOtpForm challenge={factor} onChange={setFactor} onDone={done} onSessionLimit={setSelection} />
            ) : (
              <>
                <Segmented
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    setOtpSent(false);
                    setShowPassword(false);
                  }}
                  options={modes}
                />
                {(mode === 'signup' || (mode === 'otp' && otpSent)) && (
                  <Animated.View entering={FadeIn} style={{ gap: 8 }}>
                    <Txt v="caption" color="muted">
                      आप कौन हैं?
                    </Txt>
                    <Row>
                      <Chip
                        label="Tenant / Owner"
                        active={accountType === 'USER'}
                        onPress={() => setAccountType('USER')}
                        icon={<User size={14} color={accountType === 'USER' ? c.brand : c.muted} />}
                      />
                      <Chip
                        label="Broker / Agency"
                        active={accountType === 'BROKER'}
                        onPress={() => setAccountType('BROKER')}
                        icon={<Building2 size={14} color={accountType === 'BROKER' ? c.brand : c.muted} />}
                      />
                    </Row>
                  </Animated.View>
                )}
                {mode === 'signup' && <Input label="पूरा नाम" value={f.name} onChangeText={set('name')} icon={<User size={18} color={c.subtle} />} />}
                <Input
                  label="Email"
                  value={f.email}
                  onChangeText={set('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  icon={<Mail size={18} color={c.subtle} />}
                  editable={!(mode === 'otp' && otpSent)}
                />
                {mode === 'otp' && otpSent && (
                  <Animated.View entering={FadeInDown} style={{ gap: 12 }}>
                    <Input
                      label="6-digit OTP"
                      value={f.code}
                      onChangeText={(v) => set('code')(v.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      icon={<KeyRound size={18} color={c.subtle} />}
                      style={{ letterSpacing: 6, fontSize: 20 }}
                    />
                    <Input label="नाम (नए account के लिए)" value={f.name} onChangeText={set('name')} icon={<User size={18} color={c.subtle} />} />
                  </Animated.View>
                )}
                {(mode === 'password' || mode === 'signup') && (
                  <Input
                    label="Password"
                    value={f.password}
                    onChangeText={set('password')}
                    secureTextEntry={!showPassword}
                    trailing={
                      <IconBtn accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((value) => !value)}>
                        {showPassword ? <EyeOff size={20} color={c.muted} /> : <Eye size={20} color={c.muted} />}
                      </IconBtn>
                    }
                    icon={<Lock size={18} color={c.subtle} />}
                    hint={mode === 'signup' ? 'कम से कम 8 अक्षर, एक number' : undefined}
                  />
                )}
                {mode === 'signup' && <Input label="Mobile (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />}
                {(mode === 'signup' || (mode === 'otp' && otpSent)) && accountType === 'BROKER' && (
                  <Input
                    label={inviteOnly ? 'Invite code' : 'Invite code (optional)'}
                    value={f.inviteCode}
                    onChangeText={(v) => set('inviteCode')(v.toUpperCase().replace(/\s/g, ''))}
                    autoCapitalize="characters"
                    icon={<Ticket size={18} color={c.subtle} />}
                    hint={inviteOnly ? 'अभी broker account सिर्फ़ invite से बनता है — BrokerIQ team या किसी जुड़े broker से code माँगें।' : undefined}
                  />
                )}
                {mode === 'signup' && accountType === 'BROKER' && (
                  <Input label="Firm / Agency name" value={f.firmName} onChangeText={set('firmName')} icon={<Building2 size={18} color={c.subtle} />} />
                )}

                {mode === 'otp' && !otpSent && <Button title="OTP भेजें" size="lg" loading={busy} disabled={!/.+@.+\..+/.test(f.email)} onPress={sendOtp} />}
                {mode === 'otp' && otpSent && (
                  <>
                    <Button title="Verify & continue" size="lg" loading={busy} disabled={f.code.length !== 6} onPress={verifyOtp} />
                    <Txt v="small" color="brand" style={{ textAlign: 'center' }} onPress={() => (setOtpSent(false), set('code')(''))}>
                      Email बदलें / OTP दोबारा भेजें
                    </Txt>
                  </>
                )}
                {mode === 'password' && <Button title="Login" size="lg" loading={busy} disabled={!f.email || !f.password} onPress={login} />}
                {mode === 'signup' && (
                  <Button title="Account बनाएँ" size="lg" loading={busy} disabled={!f.name || !f.email || f.password.length < 8} onPress={signup} />
                )}
              </>
            )}
          </View>
        )}
        {!factor && googleOn && (
          <>
            <Row style={{ justifyContent: 'center' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              <Txt v="caption" color="subtle">
                या
              </Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            </Row>
            <GoogleButton
              clientIds={{ web: g.webClientId, android: g.androidClientId, ios: g.iosClientId }}
              accountType={accountType}
              inviteCode={invite}
              onDone={done}
              onError={handleError}
            />
          </>
        )}
        {!factor && <Button title="Browse properties as guest" variant="secondary" onPress={() => router.replace('/(user)/home')} />}
        <Txt v="caption" color="subtle" style={{ textAlign: 'center' }}>
          Continue करके आप हमारी Terms और Privacy policy से सहमत हैं।
        </Txt>
      </View>
    </Screen>
  );
}
