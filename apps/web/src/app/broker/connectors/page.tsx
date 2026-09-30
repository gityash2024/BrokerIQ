'use client';
import { Fragment, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Facebook,
  FlaskConical,
  Mail,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  Webhook,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { LEAD_SOURCE_LABELS, type IntegrationDef, type LeadSource } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { post, useApiMutation } from '@/lib/hooks';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { CopyField, IntegrationCard, type IntegrationView } from '@/components/panel/integration-card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Badge, PageLoader } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

const ICONS: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="size-5" />,
  email_inbox: <Mail className="size-5" />,
  meta_leads: <Facebook className="size-5" />,
  housing_api: <Building2 className="size-5" />,
  exotel: <PhoneCall className="size-5" />,
};

const PORTALS = [
  { name: 'Housing.com', color: '#6D28D9', how: 'Lead API + Email' },
  { name: '99acres', color: '#0B5ED7', how: 'Email alerts' },
  { name: 'MagicBricks', color: '#D8232A', how: 'Email alerts' },
  { name: 'NoBroker', color: '#FD3752', how: 'Email alerts' },
  { name: 'Facebook / Instagram', color: '#1877F2', how: 'Lead Ads API' },
  { name: 'WhatsApp', color: '#25D366', how: 'Cloud API' },
  { name: 'Website / Zapier / CRM', color: '#0EA5E9', how: 'Webhook' },
];

function ConnectorsInner() {
  const sp = useSearchParams();
  const focus = sp.get('key');
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const q = useQuery({ queryKey: ['connectors'], queryFn: () => api<any>('/broker/connectors') });
  const sync = useApiMutation(() => post<any>('/broker/connectors/email_inbox/sync'), {
    invalidate: [['connectors'], ['leads']],
    success: (r: any) => `Inbox checked — ${r?.imported ?? 0} नई leads`,
  });
  const syncHousing = useApiMutation(() => post<any>('/broker/connectors/housing_api/sync'), {
    invalidate: [['connectors'], ['leads']],
    success: (r: any) => `Housing checked — ${r?.imported ?? 0} नई leads`,
  });
  const rotate = useApiMutation(() => post('/broker/webhook-key/rotate'), {
    success: 'नया webhook URL बना — पुराने URL अब काम नहीं करेंगे',
    invalidate: [['connectors']],
  });
  const [preview, setPreview] = useState(false);

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const totalImported = (d.connectors as any[]).reduce((s, c) => s + (c.state?.leadsImported ?? 0), 0) + (d.webhook.state?.leadsImported ?? 0);

  return (
    <>
      <PageHeader
        title="Lead connectors"
        subtitle="Housing, 99acres, MagicBricks, NoBroker, Facebook/Instagram ads और WhatsApp — सारी leads अपने आप यहाँ, अपने database में"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setPreview(true)}>
            <FlaskConical className="size-4" /> Portal email test करें
          </Button>
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-6 text-white">
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="shrink-0 lg:w-80">
            <p className="font-display text-3xl font-extrabold">{totalImported.toLocaleString('en-IN')}</p>
            <p className="text-sm text-white/80">connectors से अब तक आई leads · duplicate phone अपने आप merge होते हैं</p>
          </div>
          <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
            {PORTALS.map((p, i) => (
              <motion.span
                key={p.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur"
              >
                <span className="size-2 rounded-full" style={{ background: p.color }} /> {p.name}
                <span className="text-white/60">· {p.how}</span>
              </motion.span>
            ))}
          </div>
        </div>
      </div>

      {(d.portalStats as any[])?.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(d.portalStats as any[]).map((p) => (
            <div key={p.source} className="card p-4">
              <p className="truncate text-xs font-semibold text-muted">{LEAD_SOURCE_LABELS[p.source as LeadSource] ?? p.source}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{p.week}</p>
              <p className="text-xs text-muted">7 दिन में leads · आज {p.today}</p>
              {p.medianResponseMin != null && (
                <p className="mt-1 text-xs text-muted">
                  औसत जवाब {p.medianResponseMin < 60 ? `${p.medianResponseMin} मिनट` : `${Math.round(p.medianResponseMin / 60)} घंटे`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!admin && (
        <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Connectors सिर्फ़ firm admin बदल सकते हैं। आप status देख सकते हैं।
        </div>
      )}

      <div className="space-y-4">
        {(d.connectors as any[]).map((c) => {
          const def = c as IntegrationDef;
          const state = c.state;
          const extra = (
            <>
              {c.key === 'whatsapp' && d.platformWhatsappFallback && (
                <p className="text-sm text-muted">
                  अभी platform का shared WhatsApp number इस्तेमाल हो रहा है। अपना number जोड़ेंगे तो messages आपके नाम से जाएँगे और replies आपके inbox में
                  आएँगे।
                </p>
              )}
              {c.extra?.webhookUrl && <CopyField label="Callback URL (Meta में paste करें)" value={c.extra.webhookUrl} />}
              {c.extra?.verifyToken && <CopyField label="Verify token" value={c.extra.verifyToken} />}
              {c.extra?.connectUrl && (
                <CopyField
                  label="Connect URL (Exotel flow → Connect applet → Dynamic URL)"
                  value={c.extra.connectUrl}
                  hint="Incoming calls पर lead बनेगी और assigned agent का phone बजेगा"
                />
              )}
              {c.key === 'email_inbox' && (
                <p className="text-sm text-muted">
                  Tip: Housing / 99acres / MagicBricks / NoBroker के <b>lead alert emails</b> इसी inbox पर आने चाहिए। हर 2 मिनट में नई emails पढ़ी जाती हैं।
                </p>
              )}
              {c.key === 'housing_api' && (
                <div className="space-y-2 text-sm text-muted">
                  <p>
                    Housing से मिली <b>Profile ID</b> और <b>Encryption Key</b> डालें। हर 5 मिनट में नई leads सीधे Housing API से आती हैं — email की ज़रूरत नहीं।
                  </p>
                  {c.config?.configured && (
                    <Link href="/broker/automations" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                      <Zap className="size-3.5" /> नई Housing lead को तुरंत WhatsApp जवाब — Automations में "Welcome WhatsApp" चालू करें
                    </Link>
                  )}
                </div>
              )}
              {state && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Badge tone={state.status === 'ACTIVE' ? 'success' : state.status === 'ERROR' ? 'danger' : 'neutral'}>{state.status}</Badge>
                  <span className="text-muted">{state.leadsImported} leads imported</span>
                  {state.lastSyncAt && <span className="text-muted">Last sync {formatDateTime(state.lastSyncAt)}</span>}
                  {c.key === 'email_inbox' && admin && c.config?.configured && (
                    <Button size="xs" variant="secondary" onClick={() => sync.mutate(undefined)} loading={sync.isPending}>
                      <RefreshCw className="size-3.5" /> अभी check करें
                    </Button>
                  )}
                  {c.key === 'housing_api' && admin && c.config?.configured && (
                    <Button size="xs" variant="secondary" onClick={() => syncHousing.mutate(undefined)} loading={syncHousing.isPending}>
                      <RefreshCw className="size-3.5" /> अभी sync करें
                    </Button>
                  )}
                </div>
              )}
              {state?.lastError && (
                <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {state.lastError}
                </p>
              )}
            </>
          );
          return admin ? (
            <IntegrationCard
              key={c.key}
              def={def}
              view={c.config as IntegrationView}
              apiBase="/broker/connectors"
              invalidate={[['connectors'], ['wa-status']]}
              defaultOpen={focus === c.key}
              extra={extra}
              icon={ICONS[c.key]}
            />
          ) : (
            <div key={c.key} className="card flex items-center gap-4 p-5">
              <div
                className={cn(
                  'grid size-11 place-items-center rounded-xl',
                  c.config?.configured ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-surface-2 text-muted',
                )}
              >
                {ICONS[c.key]}
              </div>
              <div className="flex-1">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-muted">{c.description}</p>
              </div>
              {c.config?.configured ? (
                <Badge tone="success">
                  <CheckCircle2 className="size-3" /> Connected
                </Badge>
              ) : (
                <Badge tone="warning">Not connected</Badge>
              )}
            </div>
          );
        })}

        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15">
              <Webhook className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-bold">Universal lead webhook</p>
                {d.webhook.state ? <Badge tone="success">{d.webhook.state.leadsImported} leads</Badge> : <Badge>Ready</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                अपनी website के forms, Google Ads lead forms (Zapier/Make/Pabbly से), कोई भी CRM या landing page — JSON या form POST इस URL पर भेजें।
              </p>
            </div>
          </div>
          {admin && d.webhook.url && (
            <div className="mt-4 space-y-3">
              <CopyField label="Webhook URL (POST)" value={d.webhook.url} hint="इस URL को secret रखें — इसमें आपकी firm की key है" />
              <details className="rounded-xl border border-line p-3 text-sm">
                <summary className="cursor-pointer font-semibold">Sample payload / curl</summary>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{`curl -X POST '${d.webhook.url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(d.webhook.samplePayload)}'`}</pre>
                <p className="mt-2 text-xs text-muted">
                  Fields: name, phone (ज़रूरी), email, source (housing / 99acres / magicbricks / facebook …), property, budget, message। अलग नाम वाले fields भी
                  अपने आप पहचाने जाते हैं।
                </p>
              </details>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => confirm('नया URL बनाएँ? पुराना URL और WhatsApp/Meta webhook URLs बदल जाएँगे।') && rotate.mutate(undefined)}
                loading={rotate.isPending}
              >
                <RotateCcw className="size-4" /> URL rotate करें
              </Button>
            </div>
          )}
          {d.webhook.state?.lastError && <p className="mt-3 text-xs text-rose-600">{d.webhook.state.lastError}</p>}
        </div>
      </div>
      <PreviewDialog open={preview} onOpenChange={setPreview} />
    </>
  );
}

function PreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [res, setRes] = useState<any>(undefined);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      setRes(await post('/broker/connectors/email_inbox/preview', { from, subject, body }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Portal email parser test"
      description="किसी portal की lead email का text/HTML paste करें — देखें कि क्या निकलता है।"
      size="lg"
      footer={
        <Button onClick={run} loading={loading} disabled={!body.trim()}>
          Parse करें
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From (जैसे alerts@housing.com)" />
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email body…" className="min-h-40 font-mono text-xs" />
        {res !== undefined &&
          (res?.phone ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="mb-2 flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> Lead मिली — {LEAD_SOURCE_LABELS[res.source as LeadSource] ?? res.source ?? 'Generic email'}
              </p>
              <dl className="grid grid-cols-[120px_1fr] gap-y-1">
                {Object.entries(res)
                  .filter(([k, v]) => v && k !== 'source' && typeof v !== 'object')
                  .map(([k, v]) => (
                    <Fragment key={k}>
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-medium break-words">{String(v)}</dd>
                    </Fragment>
                  ))}
              </dl>
            </div>
          ) : (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              इस email में lead (phone number) नहीं मिला। पूरी email paste करें।
            </p>
          ))}
      </div>
    </Dialog>
  );
}

export default function ConnectorsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ConnectorsInner />
    </Suspense>
  );
}
