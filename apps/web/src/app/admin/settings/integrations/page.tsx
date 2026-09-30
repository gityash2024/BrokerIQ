'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Bot, Cloud, CreditCard, KeyRound, Map, Mail, MessageCircle, Radar, Search, ShieldCheck, Smartphone } from 'lucide-react';
import type { IntegrationDef } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { IntegrationCard, type IntegrationView } from '@/components/panel/integration-card';
import { Input } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const CATS: Record<string, { label: string; icon: React.ReactNode }> = {
  email: { label: 'Email & OTP', icon: <Mail className="size-5" /> },
  auth: { label: 'Login', icon: <ShieldCheck className="size-5" /> },
  storage: { label: 'Photos & files', icon: <Cloud className="size-5" /> },
  ai: { label: 'AI', icon: <Bot className="size-5" /> },
  payments: { label: 'Payments', icon: <CreditCard className="size-5" /> },
  messaging: { label: 'WhatsApp', icon: <MessageCircle className="size-5" /> },
  maps: { label: 'Maps', icon: <Map className="size-5" /> },
  push: { label: 'Push notifications', icon: <Smartphone className="size-5" /> },
  monitoring: { label: 'Monitoring', icon: <Radar className="size-5" /> },
  leads: { label: 'Leads', icon: <KeyRound className="size-5" /> },
};

function Inner() {
  const focus = useSearchParams().get('key');
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin-integrations'], queryFn: () => api<(IntegrationDef & { state: IntegrationView })[]>('/admin/integrations') });
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <ApiErrorState error={list.error} onRetry={() => list.refetch()} />;
  const items = (list.data ?? []).filter((i) => !q || `${i.name} ${i.description} ${i.usedFor.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const done = (list.data ?? []).filter((i) => i.state?.configured).length;
  const total = list.data?.length ?? 0;
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <>
      <PageHeader
        title="Credentials center"
        subtitle="सारी API keys यहीं — encrypted (AES-256) database में save होती हैं, code में कभी नहीं। हर integration के साथ हिंदी में step-by-step guide है।"
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-brand-800 p-6 text-white">
          <div className="absolute -top-16 -right-10 size-56 rounded-full bg-brand-400/30 blur-3xl" />
          <p className="text-sm text-white/70">Setup progress</p>
          <p className="mt-1 font-display text-4xl font-extrabold">
            {done}
            <span className="text-xl text-white/60"> / {total}</span>
          </p>
          <div className="mt-4 h-2.5 rounded-full bg-white/15">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(done / Math.max(1, total)) * 100}%` }}
              transition={{ duration: 0.8 }}
              className="h-full rounded-full bg-gradient-to-r from-saffron-400 to-emerald-400"
            />
          </div>
          <p className="mt-3 text-sm text-white/70">
            सब free tier पर चलते हैं — शुरुआत में ₹0 खर्च। सबसे ज़रूरी: <b className="text-white">SMTP (OTP login)</b>,{' '}
            <b className="text-white">Cloudinary (photos)</b>, <b className="text-white">Groq (AI)</b>।
          </p>
        </div>
        <div className="card flex flex-col justify-center gap-2 p-5 text-sm text-muted">
          <p className="font-semibold text-fg">Priority order</p>
          <p>1. Email (SMTP) → login OTP</p>
          <p>2. Cloudinary / R2 → photos upload</p>
          <p>3. Groq → AI scanner & descriptions</p>
          <p>4. Razorpay → revenue (plans, boosts)</p>
          <p>5. Google login, MapTiler, WhatsApp, Sentry</p>
        </div>
      </div>
      <div className="mb-5 max-w-sm">
        <Input icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Integration खोजें…" className="h-10" />
      </div>
      <div className="space-y-8">
        {cats.map((c) => (
          <section key={c}>
            <p className="mb-3 text-xs font-bold tracking-wider text-subtle uppercase">{CATS[c]?.label ?? c}</p>
            <div className="space-y-3">
              {items
                .filter((i) => i.category === c)
                .map((i) => (
                  <IntegrationCard
                    key={i.key}
                    def={i}
                    view={i.state}
                    apiBase="/admin/integrations"
                    invalidate={[['admin-integrations'], ['admin-dashboard']]}
                    defaultOpen={focus === i.key}
                    icon={CATS[c]?.icon}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Inner />
    </Suspense>
  );
}
