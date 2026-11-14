'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import type { AuthResponse, SessionLimitChallenge, LoginOtpChallenge } from '@brokeriq/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { AuthShell } from '@/components/site/auth-shell';
import { LoginOtpForm } from '@/components/site/login-otp-dialog';
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
  const [factor, setFactor] = useState<LoginOtpChallenge | null>(null);
  const [selection, setSelection] = useState<SessionLimitChallenge | null>(null);
  const { app } = useConfig();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next');
  const [mode, setMode] = useState<'otp' | 'password'>('password');
  useEffect(() => {
    if (mode === 'otp' && (!app.auth.allowEmailOtp || app.auth.requireLoginEmailOtp)) setMode('password');
    if (mode === 'password' && !app.auth.allowPasswordLogin && app.auth.allowEmailOtp && !app.auth.requireLoginEmailOtp) setMode('otp');
  }, [mode, app.auth.allowEmailOtp, app.auth.allowPasswordLogin, app.auth.requireLoginEmailOtp]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        (next.startsWith('/notification?notification=') ||
          next.startsWith('/user') ||
          /^\/brokers\/[a-z0-9-]+(?:\?via=qr)?$/i.test(next) ||
          next.startsWith('/invite/') ||
          (r.user.role === 'SUPER_ADMIN' && next.startsWith('/admin')) ||
          (['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(r.user.role) && next.startsWith('/broker')))
        ? next
        : homeFor(r.user),
    );
  };
  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.body.code === 'LOGIN_OTP_REQUIRED') {
        setFactor(e.body.details as LoginOtpChallenge);
        setPassword('');
        setShowPassword(false);
      } else if (e instanceof ApiError && e.body.code === 'SESSION_LIMIT_REACHED') setSelection(e.body.details as SessionLimitChallenge);
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
      setCode(r.devCode ?? '');
    });

  if (factor) {
    return (
      <AuthShell title="Verify your email" subtitle="Sign-in का अंतिम चरण">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
          <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <p className="min-w-0 break-words">
            <strong className="font-semibold text-fg">{factor.destination}</strong> पर भेजा गया 6-digit code दर्ज करें।
          </p>
        </div>
        <LoginOtpForm challenge={factor} onChange={setFactor} onDone={done} onSessionLimit={setSelection} />
      </AuthShell>
    );
  }

  const emailCodeStep = mode === 'otp' && otpSent;
  return (
    <AuthShell
      title={emailCodeStep ? 'Verify your email' : 'Welcome back'}
      subtitle={emailCodeStep ? `${email} पर भेजा गया 6-digit code दर्ज करें।` : 'अपने account में login करें'}
    >
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
      {!emailCodeStep && (
        <GoogleButton
          onCredential={(idToken) =>
            run(async () => done(await api('/auth/google', { method: 'POST', body: { idToken, ref: pendingReferral() }, auth: false })))
          }
        />
      )}
      {!emailCodeStep && app.auth.allowEmailOtp && !app.auth.requireLoginEmailOtp && app.auth.allowPasswordLogin && (
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
      {!app.auth.allowPasswordLogin && (!app.auth.allowEmailOtp || app.auth.requireLoginEmailOtp) ? (
        <p className="text-sm text-muted">Use the enabled Google sign-in option to continue.</p>
      ) : mode === 'otp' ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (otpSent) run(async () => done(await api('/auth/otp/verify', { method: 'POST', body: { email, code, ref: pendingReferral() }, auth: false })));
            else sendOtp();
          }}
        >
          {!otpSent && (
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
          )}
          {otpSent && (
            <Field
              label="6-digit OTP"
              hint={
                <button type="button" className="text-brand-600" disabled={loading} onClick={sendOtp}>
                  OTP दोबारा भेजें
                </button>
              }
            >
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                required
                pattern="[0-9]{6}"
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
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => {
                setOtpSent(false);
                setCode('');
              }}
            >
              Email बदलें
            </Button>
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
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0"
                aria-label={showPassword ? t('Hide password') : t('Show password')}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
              </Button>
            </div>
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Login
          </Button>
        </form>
      )}
      {!emailCodeStep && (
        <>
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
        </>
      )}
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
