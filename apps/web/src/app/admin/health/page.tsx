'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database, RefreshCw, Server, Webhook, XCircle } from 'lucide-react';
import { INTEGRATIONS } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

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
        </div>
      )}
    </>
  );
}
