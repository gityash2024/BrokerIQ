'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, Bug, CheckCircle2, Gauge, Clock, Cpu, Database, RefreshCw, Server, Webhook, XCircle } from 'lucide-react';
import { INTEGRATIONS } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { Segmented } from '@/components/ui/tabs';
import { patch, post, useApiMutation } from '@/lib/hooks';

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export default function HealthPage() {
  const q = useQuery({ queryKey: ['admin-health'], queryFn: () => api<any>('/health/details'), refetchInterval: 30_000 });
  const d = q.data;
  return (
    <>
      <PageHeader title="System health" subtitle="API, database, background jobs, webhooks और integrations — हर 30 सेकंड refresh" actions={<Button size="sm" variant="secondary" onClick={() => q.refetch()} loading={q.isFetching}><RefreshCw className="size-4" /> Refresh</Button>} />
      {q.isError ? <ApiErrorState error={q.error} onRetry={() => q.refetch()} /> : !d ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('flex items-center gap-4 rounded-3xl p-6 text-white', d.status === 'ok' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-rose-600 to-orange-600')}>
            <span className="relative grid size-14 place-items-center rounded-2xl bg-white/20">
              {d.status === 'ok' && <span className="absolute inset-0 animate-ping rounded-2xl bg-white/20" />}
              {d.status === 'ok' ? <CheckCircle2 className="size-7" /> : <AlertTriangle className="size-7" />}
            </span>
            <div>
              <p className="font-display text-2xl font-extrabold">{d.status === 'ok' ? 'All systems operational' : 'Degraded'}</p>
              <p className="text-sm text-white/80">Checked {formatDateTime(d.time)}</p>
            </div>
          </motion.div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Database" value={d.db === 'ok' ? `${d.dbLatencyMs} ms` : 'DOWN'} icon={<Database className="size-5" />} tone={d.db === 'ok' ? 'success' : 'danger'} />
            <Stat label="Uptime" value={uptime(d.uptimeSec)} icon={<Clock className="size-5" />} />
            <Stat label="Memory" value={`${d.memoryMb} MB`} hint={`Node ${d.node}`} icon={<Cpu className="size-5" />} tone="info" />
            <Stat label="Webhook failures (24h)" value={d.webhookFailures24h} icon={<Webhook className="size-5" />} tone={d.webhookFailures24h ? 'warning' : 'success'} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="card p-5">
              <p className="mb-4 flex items-center gap-2 font-display font-bold"><Server className="size-5" /> Background jobs</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(d.jobs).map(([k, v]) => <Badge key={k} tone={k === 'FAILED' ? 'danger' : k === 'DONE' ? 'success' : k === 'RUNNING' ? 'info' : 'neutral'}>{k}: {String(v)}</Badge>)}
                {!Object.keys(d.jobs).length && <p className="text-sm text-muted">कोई job नहीं</p>}
              </div>
              {d.failedJobs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-bold text-subtle uppercase">Recent failures</p>
                  {d.failedJobs.map((j: any) => (
                    <div key={j.id} className="rounded-xl bg-rose-50 px-3 py-2 text-xs dark:bg-rose-500/10">
                      <p className="font-semibold">{j.type} · attempts {j.attempts}</p>
                      <p className="line-clamp-2 text-rose-700 dark:text-rose-300">{j.lastError}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <p className="mb-4 flex items-center gap-2 font-display font-bold"><Activity className="size-5" /> Integrations</p>
              <div className="space-y-1.5">
                {d.integrations.map((i: any) => (
                  <Link key={i.key} href={`/admin/settings/integrations?key=${i.key}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                    {!i.configured ? <span className="size-2.5 rounded-full bg-amber-500" /> : i.lastTestOk === false ? <XCircle className="size-4 text-rose-500" /> : <CheckCircle2 className="size-4 text-emerald-500" />}
                    <span className="flex-1">{INTEGRATIONS.find((x) => x.key === i.key)?.name ?? i.key}</span>
                    <span className="text-xs text-subtle">{i.configured ? (i.lastTestedAt ? `tested ${formatDateTime(i.lastTestedAt)}` : 'not tested') : 'not configured'}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {d.integrationErrors.length > 0 && (
            <div className="card p-5">
              <p className="mb-3 font-display font-bold">Recent integration errors</p>
              <div className="divide-y divide-line text-sm">
                {d.integrationErrors.map((e: any) => (
                  <div key={e.id} className="flex flex-wrap gap-2 py-2">
                    <Badge tone="danger">{e.integration ?? e.provider ?? e.key}</Badge>
                    <span className="flex-1 text-muted">{e.message ?? e.error ?? e.action}</span>
                    <span className="text-xs text-subtle">{formatDateTime(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <CostsCard />
          <ErrorsCard />
        </div>
      )}
    </>
  );
}

const SOURCE_TONE = { API: 'danger', WEB: 'warning', MOBILE: 'info' } as const;

/** Grouped runtime errors from the API, website and app — resolve once fixed; a repeat reopens it. */
function ErrorsCard() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const q = useQuery({ queryKey: ['admin-errors', status], queryFn: () => api<any[]>(`/admin/errors?status=${status}`), refetchInterval: 60_000 });
  const [open, setOpen] = useState<string | null>(null);
  const resolve = useApiMutation((b: { id: string; resolved: boolean }) => patch(`/admin/errors/${b.id}`, { resolved: b.resolved }), { invalidate: [['admin-errors'], ['admin-health']] });
  const resolveAll = useApiMutation(() => post('/admin/errors/resolve-all', {}), { success: 'सब resolved', invalidate: [['admin-errors'], ['admin-health']] });
  const check = useApiMutation(() => post<any>('/admin/monitoring/check', {}), {
    onSuccess: (r: any) => (r.found?.length ? toast.warning(`जाँच में मिला: ${r.found.join(', ')}`) : toast.success(`सब ठीक · DB ${r.dbMs} ms${r.disk != null ? ` · disk ${r.disk}%` : ''}`)),
  });
  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex flex-1 items-center gap-2 font-display font-bold"><Bug className="size-5 text-rose-500" /> Errors (API · website · app)</p>
        <Segmented value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]} />
        <Button size="sm" variant="secondary" loading={check.isPending} onClick={() => check.mutate()}>Uptime जाँचें</Button>
        {status === 'open' && !!q.data?.length && <Button size="sm" variant="ghost" loading={resolveAll.isPending} onClick={() => resolveAll.mutate()}>सब resolve</Button>}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-24" />
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-sm text-muted">{status === 'open' ? 'कोई खुली error नहीं 🎉' : 'कुछ नहीं'}</p>
      ) : (
        <div className="divide-y divide-line text-sm">
          {q.data.map((e) => (
            <div key={e.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SOURCE_TONE[e.source as keyof typeof SOURCE_TONE]}>{e.source}</Badge>
                <button className="min-w-0 flex-1 truncate text-left font-medium hover:text-brand-600" onClick={() => setOpen(open === e.id ? null : e.id)} data-no-i18n>{e.message}</button>
                <span className="text-xs text-subtle">×{e.count} · {formatDateTime(e.lastSeenAt)}</span>
                <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: e.id, resolved: !e.resolvedAt })}>{e.resolvedAt ? 'Reopen' : 'Resolve'}</Button>
              </div>
              {open === e.id && (
                <div className="mt-2 space-y-1 rounded-xl bg-surface-2 p-3 text-xs" data-no-i18n>
                  <p className="text-muted">{[e.method, e.route, e.appVersion && `v${e.appVersion}`, e.userId && `user ${e.userId}`].filter(Boolean).join(' · ')}</p>
                  {e.stack && <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-[11px] leading-4">{e.stack}</pre>}
                  {e.userAgent && <p className="text-subtle">{e.userAgent}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Free-tier watch: AI calls per provider, emails and WhatsApp sends, disk — last 24 h and 30 days. */
function CostsCard() {
  const q = useQuery({ queryKey: ['admin-costs'], queryFn: () => api<any>('/admin/usage/costs'), refetchInterval: 300_000 });
  const d = q.data;
  return (
    <div className="card p-5">
      <p className="mb-1 flex items-center gap-2 font-display font-bold"><Gauge className="size-5 text-brand-600" /> Cost & usage (free limits)</p>
      <p className="mb-4 text-xs text-muted">OpenRouter free models, Groq/Gemini free tier और free SMTP की रोज़ की limits के अंदर रहें। AI firm-wise daily cap: App config → Free mode, AI.</p>
      {!d ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-surface-2 p-4 text-sm">
            <p className="mb-2 font-semibold">AI calls (24 h · 30 d)</p>
            {d.ai.month.length ? (
              d.ai.month.map((m: any) => {
                const day = d.ai.day.find((x: any) => x.provider === m.provider) ?? { ok: 0, failed: 0 };
                return (
                  <p key={m.provider} className="flex justify-between gap-2" data-no-i18n>
                    <span>{m.provider}</span>
                    <span className="text-muted">{day.ok}{day.failed ? ` (+${day.failed} failed)` : ''} · {m.ok}</span>
                  </p>
                );
              })
            ) : (
              <p className="text-muted">अभी कोई AI call नहीं</p>
            )}
          </div>
          <div className="rounded-xl bg-surface-2 p-4 text-sm">
            <p className="mb-2 font-semibold">Messages (24 h · 30 d)</p>
            <p className="flex justify-between"><span>Emails</span><span className="text-muted">{d.email.day} · {d.email.month}</span></p>
            <p className="flex justify-between"><span>WhatsApp (sent)</span><span className="text-muted">{d.whatsapp.day} · {d.whatsapp.month}</span></p>
          </div>
          <div className="rounded-xl bg-surface-2 p-4 text-sm">
            <p className="mb-2 font-semibold">Server disk</p>
            <p className={cn('font-display text-2xl font-extrabold', d.disk >= 85 ? 'text-rose-600' : 'text-emerald-600')}>{d.disk != null ? `${d.disk}%` : '—'}</p>
            <p className="text-xs text-muted">85% पर alert आता है</p>
          </div>
        </div>
      )}
    </div>
  );
}
