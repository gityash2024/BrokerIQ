'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { AuthShell } from '@/components/site/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import type { AuthResponse } from '@brokeriq/shared';
export default function Signup() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
function SignupForm() {
  const sp = useSearchParams();
  const code = sp.get('invite');
  const next = sp.get('next');
  const returnTo = next && /^\/(?![\/\\])/.test(next) && !next.includes('\\') && next.startsWith('/invite/') ? next : null;
  const broker = !!code || sp.get('type') === 'broker';
  const { setSession } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell
      title={broker ? 'Your broker invitation' : 'Find your next home'}
      subtitle={broker ? 'Create your firm account with your invitation.' : 'Create your customer account to save, enquire and plan a visit.'}
    >
      {broker && !code ? (
        <>
          <p>Broker accounts require an invitation from Super Admin.</p>
          <Link href="/signup">Create a customer account →</Link>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const fields = Object.fromEntries(new FormData(event.currentTarget));
            setBusy(true);
            setError('');
            try {
              const session = await api<AuthResponse>('/auth/register', {
                method: 'POST',
                auth: false,
                body: { ...fields, phone: fields.phone || undefined, accountType: broker ? 'BROKER' : 'USER', inviteCode: code || undefined },
              });
              setSession(session);
              router.replace(returnTo ?? homeFor(session.user));
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {[
            ['name', 'Your name'],
            ...(broker ? [['firmName', 'Firm name']] : []),
            ['email', 'Email'],
            ['phone', 'Phone (optional)'],
            ['password', 'Password'],
          ].map(([name, label]) => (
            <Field key={name} label={label}>
              <Input
                required={name !== 'phone'}
                name={name}
                type={name === 'password' ? 'password' : name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                minLength={name === 'password' ? 8 : undefined}
                autoComplete={name === 'password' ? 'new-password' : name}
              />
            </Field>
          ))}
          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">
            {broker ? 'Accept invitation' : 'Create account'}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link className="font-semibold text-brand-600" href={returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'}>
          Sign in →
        </Link>
      </p>
    </AuthShell>
  );
}
