import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import type { AuthResponse, LoginOtpChallenge, SessionLimitChallenge } from '@brokeriq/shared';
import { ApiError, errorMessage, api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Button, Input, Txt } from '@/ui';

export function LoginOtpSheet({
  challenge,
  onChange,
  onDone,
  onSessionLimit,
}: {
  challenge: LoginOtpChallenge | null;
  onChange: (value: LoginOtpChallenge | null) => void;
  onDone: (response: AuthResponse) => void | Promise<void>;
  onSessionLimit: (value: SessionLimitChallenge) => void;
}) {
  const { c } = useTheme();
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    setCode(challenge?.devCode ?? '');
    setError('');
  }, [challenge]);
  useEffect(() => {
    if (!challenge) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [challenge]);
  const expired = !!challenge && now >= Date.parse(challenge.expiresAt);
  const wait = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000)) : 0;
  const verify = async () => {
    if (!challenge || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await api<AuthResponse>('/auth/login/otp/verify', { auth: false, body: { challenge: challenge.challenge, code, factor: 'EMAIL' } });
      onChange(null);
      await onDone(session);
    } catch (e) {
      if (e instanceof ApiError && e.body.code === 'SESSION_LIMIT_REACHED') {
        onChange(null);
        onSessionLimit(e.body.details as SessionLimitChallenge);
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible={!!challenge}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onChange(null);
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 20, gap: 16, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            <Txt v="h2">Verify your email</Txt>
            <Txt>OTP {challenge?.destination ?? ''} पर भेजा गया। इसे पूरा करने के बाद ही login होगा।</Txt>
            <Input
              accessibilityLabel="Email OTP"
              placeholder="Email OTP"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            />
            <Txt v="small" color="muted">
              {expired ? 'OTP expire हो गया। दोबारा login करें।' : `Expires: ${challenge ? new Date(challenge.expiresAt).toLocaleTimeString() : ''}`}
            </Txt>
            {!!error && <Txt color="danger">{error}</Txt>}
            <Button title="Verify and continue" loading={busy} disabled={expired || code.length !== 6} onPress={verify} />
            <Button
              variant="secondary"
              title={`Resend OTP${wait ? ` (${wait}s)` : ''}`}
              disabled={busy || expired || wait > 0}
              onPress={async () => {
                if (!challenge) return;
                setBusy(true);
                setError('');
                try {
                  onChange(await api<LoginOtpChallenge>('/auth/login/otp/resend', { auth: false, body: { challenge: challenge.challenge } }));
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button title="Back to sign in" variant="ghost" disabled={busy} onPress={() => onChange(null)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
