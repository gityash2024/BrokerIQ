'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Bell, Building2, Clock, Database, Globe2, Inbox, Play, Radio, Sparkles, Users, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { useRouteState } from '@/lib/navigation';

const endpoint = '/admin/organic';
const queryKey = ['organic-executions'];
type Kind = 'SUPPLY' | 'DEMAND' | 'DELIVERY';
type Discovery = Exclude<Kind, 'DELIVERY'>;
type Schedule = { enabled: boolean; time: string; enrichTime: string; resultsTime: string; notifyTime: string };
type Step = {
  id: string; type: string; status: string; attempts: number; maxAttempts: number;
  runAt: string; updatedAt: string; deferred: boolean; canRetry: boolean;
};
type Run = {
  key: string; runId: string | null; kind: Kind | 'MANUAL'; status: string; createdAt: string; finishedAt: string | null;
  report: Record<string, number> | null; steps: Step[];
  sourceBatches: { sourceId: string; status: string; processed: number; inserted: number; duplicates: number; reviewed: number }[];
};
type Snapshot = {
  workerEnabled: boolean; executions: Run[];
  discovery: Record<Discovery, Schedule & { nextRunAt: string | null }>;
  sources: { id: string; name: string; enabled: boolean; supports: string[]; format: string }[];
  delivery: { id: string; firmName: string; nextRunAt: string | null; leadType: string }[];
};

const pipelines = {
  SUPPLY: { name: 'Property supply', icon: Building2, path: '/admin/organic/supply' },
  DEMAND: { name: 'Buyer & tenant leads', icon: Users, path: '/admin/organic/demand' },
  DELIVERY: { name: 'Daily firm delivery', icon: Inbox, path: '/admin/organic/delivery' },
};
const phases = [
  { id: 'collect', icon: Globe2, title: 'Collect sources', note: 'Approved feeds and public registries', field: 'time' },
  { id: 'enrich', icon: Sparkles, title: 'Classify & validate', note: 'Free AI, location and evidence checks', field: 'enrichTime' },
  { id: 'publish', icon: Database, title: 'Save results', note: 'Deduplicate and queue for review', field: 'resultsTime' },
  { id: 'ready', icon: Bell, title: 'Notify admins', note: 'In-app summary', field: 'notifyTime' },
] as const;
const deliveryPhases = [
  { id: 'clock', icon: Clock, title: 'Firm schedule', note: 'Daily in IST' },
  { id: 'filter', icon: Users, title: 'Find eligible leads', note: 'New leads within firm scope' },
  { id: 'delivery', icon: Inbox, title: 'Send to CRM', note: 'Deduplicate, assign and notify' },
];
const stepNames: Record<string, string> = {
  ...Object.fromEntries(phases.map(({ id, title }) => ['organic.' + id, title])),
  'organic.discovery': 'Collect, classify & save',
  'organic.delivery': 'Deliver to firm',
  'organic.manual-transfer': 'Transfer selected records',
};
const reportNames: Record<string, string> = {
  sources: 'Sources', records: 'New records', delivered: 'Delivered', duplicates: 'Duplicates', duplicate: 'Duplicates',
  reviewed: 'For review', failed: 'Failed', skipped: 'Skipped',
};
const stateName = (value: string) => value === 'PENDING' ? 'Queued' :
  value.toLowerCase().replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
const when = (iso: string | null) => iso ? new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
}).format(new Date(iso)) + ' IST' : '—';

function Status({ state }: { state: string }) {
  const color = ['FAILED', 'PARTIAL', 'NO_SOURCE'].includes(state) ? 'text-amber-700 dark:text-amber-300'
    : ['DONE', 'COMPLETE', 'PUBLISHED'].includes(state) ? 'text-emerald-700 dark:text-emerald-300'
      : ['RUNNING', 'COLLECTING', 'ENRICHING', 'PUBLISHING'].includes(state) ? 'text-primary' : 'text-muted';
  return <span className={'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ' + color}>
    <span aria-hidden className="size-1.5 rounded-full bg-current" />{stateName(state)}
  </span>;
}

export default function OrganicWorkflows() {
  const cache = useQueryClient();
  const [kind, setKind] = useRouteState<Kind>('organic-workflow.pipeline', 'SUPPLY');
  const [chosenRun, setChosenRun] = useRouteState<string | null>('organic-workflow.run', null);
  const [draft, setDraft] = useState<Schedule | null>(null);
  const snapshot = useQuery({ queryKey, queryFn: () => api<Snapshot>(endpoint + '/executions'), refetchInterval: 5000 });
  const mutate = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: 'POST' | 'PATCH'; body?: unknown }) =>
      api(endpoint + path, { method, body }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey });
      void cache.invalidateQueries({ queryKey: ['organic-records'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const data = snapshot.data;
  const schedule = kind === 'DELIVERY' ? undefined : data?.discovery[kind];
  const runs = data?.executions.filter((run) => run.kind === kind) ?? [];
  const selected = runs.find(({ key }) => key === chosenRun) ?? runs[0];
  const sources = data?.sources.filter((source) => source.enabled && source.supports.includes(kind)) ?? [];
  const timeline = kind === 'DELIVERY' ? deliveryPhases : phases;

  function patchSchedule(next: Schedule) {
    return mutate.mutateAsync({ path: '/discovery/' + kind, method: 'PATCH', body: next });
  }

  function runNow(sourceId?: string) {
    if (kind === 'DELIVERY') return;
    mutate.mutate({ path: '/discover', body: { kind, sourceId } }, {
      onSuccess: () => { toast.success('Discovery queued'); setChosenRun(null); },
    });
  }

  return <>
    <PageHeader title="Organic Automation" subtitle="Monitor discovery, AI review and delivery across Gurugram."
      actions={<Link href="/admin/organic/sources" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <Database className="size-4" /> Manage sources
      </Link>} />
    {snapshot.error && <ApiErrorState error={snapshot.error} onRetry={() => void snapshot.refetch()} />}
    {snapshot.isPending && <p className="card p-4 text-muted">Loading workflow runs…</p>}
    {data && <div className="grid gap-4">
      <nav aria-label="Organic workflows" className="grid gap-2 sm:grid-cols-3">
        {(Object.entries(pipelines) as [Kind, (typeof pipelines)[Kind]][]).map(([id, { name, icon: Icon }]) =>
          <button key={id} type="button" aria-pressed={kind === id} onClick={() => {
            setKind(id); setChosenRun(null); setDraft(null);
          }} className={'card flex items-center gap-3 p-4 text-left text-sm font-semibold ' + (kind === id ? 'ring-2 ring-primary' : 'hover:border-primary')}>
            <Icon className="size-5 text-primary" />{name}
          </button>)}
      </nav>
      <section aria-labelledby="workflow-title" className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-4 sm:p-5">
          <div>
            <h2 id="workflow-title" className="flex items-center gap-2 font-semibold"><Workflow className="size-5 text-primary" />{pipelines[kind].name}</h2>
            <p className="mt-1 text-sm text-muted">
              {!data.workerEnabled ? 'Job worker disabled'
                : schedule ? schedule.enabled ? 'Next scheduled discovery ' + when(schedule.nextRunAt ?? null) : 'Schedule paused'
                  : data.delivery.length + ' active firm schedules'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {schedule && <>
              <Button size="sm" variant="secondary" disabled={mutate.isPending} onClick={() => {
                void patchSchedule({
                  enabled: !schedule.enabled, time: schedule.time, enrichTime: schedule.enrichTime,
                  resultsTime: schedule.resultsTime, notifyTime: schedule.notifyTime,
                }).then(() => toast.success(schedule.enabled ? 'Schedule paused' : 'Schedule resumed')).catch(() => undefined);
              }}>{schedule.enabled ? 'Pause schedule' : 'Resume schedule'}</Button>
              <Button size="sm" variant="secondary" onClick={() => setDraft({
                enabled: schedule.enabled, time: schedule.time, enrichTime: schedule.enrichTime,
                resultsTime: schedule.resultsTime, notifyTime: schedule.notifyTime,
              })}><Clock className="size-4" /> Edit schedule</Button>
              <Button size="sm" disabled={!data.workerEnabled || mutate.isPending} onClick={() => runNow()}>
                <Play className="size-4" /> Run now
              </Button>
            </>}
            <Link href={pipelines[kind].path} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">
              {kind === 'DELIVERY' ? 'Manage delivery' : 'View results'}
            </Link>
          </div>
        </div>
        <div className="bg-surface-2/30 p-4 sm:p-5"
          style={{ backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
          <ol className={'grid gap-3 ' + (kind === 'DELIVERY' ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
            {timeline.map(({ id, icon: Icon, title, note }, index) => {
              const step = selected?.steps.find(({ type }) => type === 'organic.' + id);
              const at = phases.find((phase) => phase.id === id)?.field;
              return <li key={id} className="relative min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                {index > 0 && <ArrowRight aria-hidden className="absolute -left-4 top-5 hidden size-4 rounded-full bg-surface text-primary lg:block" />}
                <div className="flex items-start justify-between gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
                  {step && <Status state={step.deferred ? 'WAITING_TO_RETRY' : step.status} />}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs text-muted">{note}</p>
                {schedule && at && <p className="mt-3 text-xs font-semibold text-muted">{schedule[at]} IST</p>}
              </li>;
            })}
          </ol>
        </div>
      </section>
      {kind !== 'DELIVERY' && !sources.length && <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm"><strong>No source enabled.</strong> Add an approved {kind === 'SUPPLY' ? 'property' : 'buyer or tenant'} feed for discovery.</p>
        <Link href="/admin/organic/sources" className="text-sm font-semibold text-primary">Manage sources</Link>
      </div>}
      {kind === 'DELIVERY' && data.delivery.length > 0 && <section className="card p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Upcoming firm deliveries</h2>
        <ul className="divide-y divide-line">{data.delivery.map((rule) => <li key={rule.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <strong>{rule.firmName}</strong><span className="text-muted">{stateName(rule.leadType)} · {when(rule.nextRunAt)}</span>
        </li>)}</ul>
      </section>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2.2fr)]">
        <section aria-label="Recent executions" className="card min-w-0 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Activity className="size-5 text-primary" /> Recent runs</h2>
          {!runs.length && <p className="mt-3 text-sm text-muted">No recorded runs.</p>}
          <ul className="mt-2 grid max-h-[30rem] gap-1 overflow-auto">{runs.map((run) => <li key={run.key}>
            <button type="button" aria-pressed={selected?.key === run.key} onClick={() => setChosenRun(run.key)}
              className={'flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs ' +
                (selected?.key === run.key ? 'bg-primary/10 font-semibold' : 'hover:bg-surface-2')}>
              <span>{when(run.createdAt)}</span><Status state={run.status} />
            </button>
          </li>)}</ul>
        </section>
        <section aria-label="Run activity" className="card min-w-0 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Radio className="size-5 text-primary" /> Run activity</h2>
          {!selected && <p className="mt-3 text-sm text-muted">Activity will appear after the first run.</p>}
          {selected && <>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted"><Status state={selected.status} />
              <span>{when(selected.createdAt)}</span>
              {selected.finishedAt && <span>Finished {when(selected.finishedAt)}</span>}
            </div>
            {selected.report && <dl className="my-4 flex flex-wrap gap-2">
              {Object.entries(reportNames).filter(([key]) => typeof selected.report?.[key] === 'number').map(([key, label]) =>
                <div key={key} className="min-w-24 rounded-xl border border-line p-2.5"><dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{selected.report![key]}</dd></div>)}
            </dl>}
            <ul className="mt-3 divide-y divide-line">{selected.steps.map((step) => <li key={step.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p className="font-medium">{stepNames[step.type] ?? step.type}</p>
                <p className="mt-0.5 text-xs text-muted">{step.deferred ? 'Retry at ' : step.status === 'PENDING' ? 'Scheduled for ' : 'Updated '}
                  {when(step.status === 'PENDING' ? step.runAt : step.updatedAt)} · {step.attempts}/{step.maxAttempts} attempts</p></div>
              <div className="flex items-center gap-2"><Status state={step.deferred ? 'WAITING_TO_RETRY' : step.status} />
                {step.canRetry && <Button size="sm" variant="secondary" disabled={mutate.isPending || !data.workerEnabled}
                  onClick={() => mutate.mutate({ path: '/executions/steps/' + step.id + '/retry' })}>Retry step</Button>}</div>
            </li>)}</ul>
            {selected.sourceBatches.length > 0 && <ul className="mt-3 divide-y divide-line border-t border-line">
              {selected.sourceBatches.map((batch) => {
                const source = data.sources.find(({ id }) => id === batch.sourceId);
                return <li key={batch.sourceId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div><p className="font-medium">{source?.name ?? 'Source unavailable'}</p>
                    <p className="mt-0.5 text-xs text-muted">{batch.processed} processed · {batch.inserted} new · {batch.duplicates} duplicates</p></div>
                  <div className="flex items-center gap-2"><Status state={batch.status} />
                    {batch.status === 'FAILED' && source?.enabled && <Button size="sm" variant="secondary"
                      disabled={mutate.isPending || !data.workerEnabled} onClick={() => runNow(batch.sourceId)}>Retry source</Button>}</div>
                </li>;
              })}
            </ul>}
          </>}
        </section>
      </div>
    </div>}
    <Dialog open={!!draft} title="Edit discovery schedule" onOpenChange={(open) => { if (!open && !mutate.isPending) setDraft(null); }}
      footer={<Button disabled={!draft || mutate.isPending} onClick={() => {
        if (!draft) return;
        if (!(draft.time < draft.enrichTime && draft.enrichTime < draft.resultsTime && draft.resultsTime < draft.notifyTime)) {
          toast.error('Set all four times in order within the same IST day'); return;
        }
        void patchSchedule(draft).then(() => { setDraft(null); toast.success('Schedule updated'); }).catch(() => undefined);
      }}>Save schedule</Button>}>
      {draft && <div className="grid gap-3">
        {phases.map(({ id, title, field }) => <label key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{title} (IST)</span>
          <input type="time" required value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
            className="rounded-xl border border-line bg-surface px-3 py-2" />
        </label>)}
      </div>}
    </Dialog>
  </>;
}
