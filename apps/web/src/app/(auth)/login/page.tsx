'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Mail } from 'lucide-react';
import type { AuthResponse } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { AuthShell } from '@/components/site/auth-shell';
import { GoogleButton } from '@/components/site/google-button';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Segmented } from '@/components/ui/tabs';

function LoginInner() {
  const { setSession } = useAuth();
  const { app } = useConfig();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next');
  const [mode, setMode] = useState<'otp' | 'password'>(app.auth.allowEmailOtp ? 'otp' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const done = (r: AuthResponse) => {
    setSession(r);
    toast.success(`Welcome ${r.user.name.split(' ')[0]} 👋`);
    router.replace(next && next.startsWith('/') ? next : homeFor(r.user));
  };
  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
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
      <GoogleButton onCredential={(idToken) => run(async () => done(await api('/auth/google', { method: 'POST', body: { idToken }, auth: false })))} />
      {app.auth.allowEmailOtp && app.auth.allowPasswordLogin && (
        <Segmented
          className="mb-5 w-full [&>button]:flex-1"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'otp', label: <><Mail className="size-4" /> Email OTP</> },
            { value: 'password', label: <><KeyRound className="size-4" /> Password</> },
          ]}
        />
      )}
      {mode === 'otp' ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (otpSent) run(async () => done(await api('/auth/otp/verify', { method: 'POST', body: { email, code }, auth: false })));
            else sendOtp();
          }}
        >
          <Field label="Email">
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={otpSent} />
          </Field>
          {otpSent && (
            <Field label="6-digit OTP" hint={<button type="button" className="text-brand-600" onClick={sendOtp}>OTP दोबारा भेजें</button>}>
              <Input inputMode="numeric" maxLength={6} autoFocus required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-xl tracking-[0.5em]" />
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
          <Field label="Password" hint={<Link href="/forgot" className="text-brand-600">Password भूल गए?</Link>}>
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
