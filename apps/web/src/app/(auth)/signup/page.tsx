'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { BadgeCheck, Briefcase, Check, Home, Ticket } from 'lucide-react';
import type { AuthResponse } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AuthShell } from '@/components/site/auth-shell';
import { GoogleButton } from '@/components/site/google-button';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

function SignupInner() {
  const { setSession } = useAuth();
  const { app } = useConfig();
  const router = useRouter();
  const sp = useSearchParams();
  const [type, setType] = useState<'USER' | 'BROKER'>(sp.get('type') === 'broker' || sp.get('invite') ? 'BROKER' : 'USER');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', firmName: '', inviteCode: (sp.get('invite') ?? '').toUpperCase() });
  const [loading, setLoading] = useState(false);
  const inviteOnly = !app.auth.allowBrokerSignup;
  const invite = useInviteCheck(type === 'BROKER' ? f.inviteCode : '');
  const done = (r: AuthResponse) => {
    setSession(r);
    toast.success('Account बन गया 🎉');
    const next = sp.get('next');
    router.replace(r.user.role === 'BROKER_ADMIN' ? '/broker/onboarding' : next && next.startsWith('/') ? next : homeFor(r.user));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      done(
        await api('/auth/register', {
          method: 'POST',
          auth: false,
          body: { ...f, phone: f.phone || undefined, firmName: type === 'BROKER' ? f.firmName || undefined : undefined, inviteCode: type === 'BROKER' && f.inviteCode ? f.inviteCode : undefined, accountType: type },
        }),
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  const options = [
    { v: 'USER' as const, icon: Home, t: 'Buyer / Tenant / Owner', d: 'Property खोजें, save करें या अपनी property free post करें' },
    { v: 'BROKER' as const, icon: Briefcase, t: 'Broker / Agency', d: inviteOnly ? 'Invite code से — Leads CRM, WhatsApp automation, team और listings' : 'Leads CRM, WhatsApp automation, team और listings' },
  ];
  return (
    <AuthShell title="Account बनाएँ" subtitle="30 seconds में शुरू करें — बिल्कुल free">
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setType(o.v)}
            className={cn('relative rounded-2xl border-2 p-4 text-left transition', type === o.v ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-500/10' : 'border-line hover:border-brand-300')}
          >
            {type === o.v && (
              <motion.span layoutId="signup-check" className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                <Check className="size-3" />
              </motion.span>
            )}
            <o.icon className="size-6 text-brand-600" />
            <p className="mt-2 font-semibold">{o.t}</p>
            <p className="mt-0.5 text-xs text-muted">{o.d}</p>
          </button>
        ))}
      </div>
      <GoogleButton text="signup_with" onCredential={async (idToken) => {
        try {
          done(await api('/auth/google', { method: 'POST', body: { idToken, accountType: type, inviteCode: type === 'BROKER' && f.inviteCode ? f.inviteCode : undefined }, auth: false }));
        } catch (err) {
          toast.error(errorMessage(err));
        }
      }} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="पूरा नाम" required>
          <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
        </Field>
        {type === 'BROKER' && (
          <Field label="Invite code" required={inviteOnly} hint={inviteOnly ? 'अभी broker account सिर्फ़ invite से बनता है। Code नहीं है? BrokerIQ team या किसी जुड़े broker से माँगें।' : 'Optional — किसी broker ने invite किया है तो डालें'}>
            <div className="relative">
              <Ticket className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <Input className="pl-9 uppercase" required={inviteOnly} value={f.inviteCode} onChange={(e) => setF({ ...f, inviteCode: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="BIQXXXXXX" />
            </div>
            {invite?.valid && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <BadgeCheck className="size-3.5" /> Invite valid{invite.invitedBy ? ` — ${invite.invitedBy} ने बुलाया` : ''}{invite.plan ? ` · ${invite.plan.name} plan ${invite.months ? `${invite.months} महीने` : ''} free` : ''}
              </p>
            )}
            {invite && !invite.valid && <p className="mt-1.5 text-xs text-rose-600">{invite.message}</p>}
          </Field>
        )}
        {type === 'BROKER' && (
          <Field label="Firm / Agency name" required>
            <Input required value={f.firmName} onChange={(e) => setF({ ...f, firmName: e.target.value })} placeholder="Sharma Realty" />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required>
            <Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label="Mobile">
            <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98xxxxxxxx" />
          </Field>
        </div>
        <Field label="Password" required hint="कम से कम 8 अक्षर">
          <Input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {type === 'BROKER' ? 'Broker account बनाएँ' : 'Account बनाएँ'}
        </Button>
        <p className="text-center text-xs text-subtle">
          Sign up करके आप हमारी <Link href="/p/terms" className="underline">Terms</Link> और <Link href="/p/privacy" className="underline">Privacy policy</Link> से सहमत हैं।
        </p>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        पहले से account है?{' '}
        <Link href="/login" className="font-semibold text-brand-600">
          Login करें
        </Link>
      </p>
    </AuthShell>
  );
}

/** Debounced check of an invite code against the API (shows what it grants). */
function useInviteCheck(code: string) {
  const [res, setRes] = useState<any>(null);
  useEffect(() => {
    const c = code.trim();
    if (c.length < 4) {
      setRes(null);
      return;
    }
    const t = setTimeout(() => {
      api<any>(`/broker-invites/check/${encodeURIComponent(c)}`, { auth: false })
        .then(setRes)
        .catch(() => setRes(null));
    }, 400);
    return () => clearTimeout(t);
  }, [code]);
  return res;
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}
