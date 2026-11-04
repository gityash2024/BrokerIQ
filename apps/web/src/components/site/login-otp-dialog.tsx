'use client';
import { useEffect, useState } from 'react';
import type { AuthResponse, LoginOtpChallenge, SessionLimitChallenge } from '@brokeriq/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';

type LoginOtpProps = {
  challenge: LoginOtpChallenge | null;
  onChange: (value: LoginOtpChallenge | null) => void;
  onDone: (response: AuthResponse) => void | Promise<void>;
  onSessionLimit: (value: SessionLimitChallenge) => void;
};

export function LoginOtpForm({ challenge, onChange, onDone, onSessionLimit, onBusyChange }: LoginOtpProps & { onBusyChange?: (busy: boolean) => void }) {
  const [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
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
    if (!challenge || busy || expired || code.length !== 6) return;
    setBusy(true);
    onBusyChange?.(true);
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
      onBusyChange?.(false);
    }
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void verify();
      }}
    >
      <Field label="Email OTP">
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          required
          pattern="[0-9]{6}"
          className="text-center font-mono text-xl tracking-[0.4em]"
        />
      </Field>
      <p className="text-sm text-muted">
        {expired ? 'OTP expire हो गया। वापस जाकर दोबारा login करें।' : `Expires: ${challenge ? new Date(challenge.expiresAt).toLocaleTimeString() : ''}`}
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={expired || code.length !== 6}>
        Verify and continue
      </Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || expired || wait > 0}
          onClick={async () => {
            if (!challenge) return;
            setBusy(true);
            onBusyChange?.(true);
            setError('');
            try {
              onChange(await api<LoginOtpChallenge>('/auth/login/otp/resend', { auth: false, body: { challenge: challenge.challenge } }));
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
              onBusyChange?.(false);
            }
          }}
        >
          Resend OTP{wait ? ` (${wait}s)` : ''}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange(null)}>
          Back to sign in
        </Button>
      </div>
    </form>
  );
}

export function LoginOtpDialog(props: LoginOtpProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={!!props.challenge}
      onOpenChange={(open) => {
        if (!open && !busy) props.onChange(null);
      }}
      title="Verify your email"
      description={`OTP ${props.challenge?.destination ?? ''} पर भेजा गया। इसे पूरा करने के बाद ही login होगा।`}
    >
      {props.challenge && <LoginOtpForm {...props} onBusyChange={setBusy} />}
    </Dialog>
  );
}
