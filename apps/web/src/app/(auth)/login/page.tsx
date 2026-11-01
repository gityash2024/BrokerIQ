'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Mail } from 'lucide-react';
import type { AuthResponse, SessionLimitChallenge } from '@brokeriq/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { AuthShell } from '@/components/site/auth-shell';
import { GoogleButton } from '@/components/site/google-button';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { pendingReferral } from '@/lib/referral';
import { Dialog } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { Segmented } from '@/components/ui/tabs';

function LoginInner() {
  const { setSession } = useAuth();
  const { t } = useI18n();
  const [selection, setSelection] = useState<SessionLimitChallenge | null>(null);
  const { app } = useConfig();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next');
  const [mode, setMode] = useState<'otp' | 'password'>('password');
  useEffect(() => {
    if (mode === 'otp' && !app.auth.allowEmailOtp) setMode('password');
    if (mode === 'password' && !app.auth.allowPasswordLogin && app.auth.allowEmailOtp) setMode('otp');
  }, [mode, app.auth.allowEmailOtp, app.auth.allowPasswordLogin]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const done = (r: AuthResponse) => {
    setSession(r);
    toast.success(`Welcome ${r.user.name.split(' ')[0]} 👋`);
    router.replace(
      next &&
        /^\/(?![\/\\])/.test(next) &&
        !next.includes('\\') &&
        (next.startsWith('/user') ||
          next.startsWith('/invite/') ||
          (r.user.role === 'SUPER_ADMIN' && next.startsWith('/admin')) ||
          (['BROKER_ADMIN', 'BROKER_AGENT'].includes(r.user.role) && next.startsWith('/broker')))
        ? next
        : homeFor(r.user),
    );
  };
  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.body.code === 'SESSION_LIMIT_REACHED') setSelection(e.body.details as SessionLimitChallenge);
      else toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const sendOtp = () =>
    run(async () => {
      const r = await api<{ sent: boolean; devCode?: string }>('/auth/otp/request', { method: 'POST', body: { email }, auth: false });
      setOtpSent(true);
      toast.success(`OTP ${email} पर भेजा गया`);
      if (r.devCode) setCode(r.devCode);
    });

  return (
    <AuthShell title="Welcome back" subtitle="अपने account में login करें">
      <Dialog
        open={!!selection}
        onOpenChange={(open) => {
          if (!open && !loading) setSelection(null);
        }}
        title={t('Choose a device to sign out')}
        description={t('Five devices are signed in. Choose one to continue on this device.')}
      >
        <div className="space-y-3">
          {selection?.sessions.map((device) => (
            <div key={device.id} className="rounded-xl border border-line p-4">
              <p className="break-words font-medium">{device.userAgent || t('Unknown device')}</p>
              <p className="mt-1 text-sm text-muted">
                {device.ip || '—'} · {t('Last active')}: {new Date(device.lastUsedAt).toLocaleString()}
              </p>
              <Button
                className="mt-3"
                loading={loading}
                onClick={() =>
                  run(async () => {
                    const result = await api<AuthResponse>('/auth/sessions/replace', {
                      auth: false,
                      body: { challenge: selection.challenge, sessionId: device.id },
                    });
                    setSelection(null);
                    done(result);
                  })
                }
              >
                {t('Sign out this device and continue')}
              </Button>
            </div>
          ))}
          <Button variant="secondary" disabled={loading} onClick={() => setSelection(null)}>
            {t('Cancel')}
          </Button>
        </div>
      </Dialog>
      <GoogleButton
        onCredential={(idToken) => run(async () => done(await api('/auth/google', { method: 'POST', body: { idToken, ref: pendingReferral() }, auth: false })))}
      />
      {app.auth.allowEmailOtp && app.auth.allowPasswordLogin && (
        <Segmented
          className="mb-5 w-full [&>button]:flex-1"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            {
              value: 'otp',
              label: (
                <>
                  <Mail className="size-4" /> Email OTP
                </>
              ),
            },
            {
              value: 'password',
              label: (
                <>
                  <KeyRound className="size-4" /> Password
                </>
              ),
            },
          ]}
        />
      )}
      {mode === 'otp' ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (otpSent) run(async () => done(await api('/auth/otp/verify', { method: 'POST', body: { email, code, ref: pendingReferral() }, auth: false })));
            else sendOtp();
          }}
        >
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={otpSent}
            />
          </Field>
          {otpSent && (
            <Field
              label="6-digit OTP"
              hint={
                <button type="button" className="text-brand-600" onClick={sendOtp}>
                  OTP दोबारा भेजें
                </button>
              }
            >
              <Input
                inputMode="numeric"
                maxLength={6}
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center font-mono text-xl tracking-[0.5em]"
              />
            </Field>
          )}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {otpSent ? 'Verify & login' : 'OTP भेजें'}
          </Button>
          {otpSent && (
            <button type="button" className="w-full text-sm text-muted" onClick={() => setOtpSent(false)}>
              Email बदलें
            </button>
          )}
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => done(await api('/auth/login', { method: 'POST', body: { email, password }, auth: false })));
          }}
        >
          <Field label="Email">
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field
            label="Password"
            hint={
              <Link href="/forgot" className="text-brand-600">
                Password भूल गए?
              </Link>
            }
          >
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Login
          </Button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-muted">
        नया account?{' '}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600">
          Sign up करें
        </Link>
      </p>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600">
          Create a customer account →
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
