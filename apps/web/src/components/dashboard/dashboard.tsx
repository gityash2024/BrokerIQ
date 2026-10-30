'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, CalendarDays, RefreshCw, ShieldCheck, Activity } from 'lucide-react';
import { type DashboardData, type DashboardChart, dashboardQuerySchema } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiErrorState } from '@/components/ui/api-error';
import { Skeleton } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
const COLORS = ['#4f46e5', '#f59e0b', '#0d9488', '#0284c7', '#e11d48', '#7c3aed', '#64748b'];
function Chart({ chart }: { chart: DashboardChart }) {
  const router = useRouter();
  const nonzero = chart.points.some((p) => p.value > 0);
  const open = (point: any) => {
    const href = point?.payload?.href ?? point?.href;
    if (typeof href === 'string') router.push(href);
  };
  return (
    <section className="card min-w-0 overflow-hidden p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <h2 className="font-display text-sm font-bold">{chart.title}</h2>
        <span className="rounded-md bg-surface-2 px-2 py-1 text-[9px] font-semibold tracking-wide text-muted uppercase">
          {chart.scope === 'current' ? 'Current snapshot' : 'Selected period'}
        </span>
      </div>
      {nonzero ? (
        <div className="h-56 w-full" role="img" aria-label={`${chart.title}. ${chart.points.map((p) => `${p.label}: ${p.value}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {chart.kind === 'line' ? (
              <AreaChart data={chart.points} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="label"
                  tickFormatter={(v) => String(v).slice(5)}
                  tick={{ fontSize: 10, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                <Area
                  dataKey="value"
                  name="Records"
                  stroke={COLORS[0]}
                  fill={COLORS[0]}
                  fillOpacity={0.1}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  activeDot={{ onClick: (_: any, point: any) => open(point) }}
                />
              </AreaChart>
            ) : chart.kind === 'donut' ? (
              <PieChart>
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                <Pie
                  data={chart.points}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  onClick={open}
                  isAnimationActive={false}
                >
                  {chart.points.map((p, i) => (
                    <Cell key={p.key} fill={COLORS[i % COLORS.length]} />
                  ))}
                  <Label
                    value={chart.points.reduce((sum, p) => sum + p.value, 0).toLocaleString('en-IN')}
                    position="center"
                    fill="var(--fg)"
                    style={{ fontWeight: 750, fontSize: 24 }}
                  />
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={chart.points} margin={{ top: 8, right: 8, left: -22, bottom: 20 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(v) => (String(v).length > 14 ? String(v).slice(0, 12) + '…' : String(v))}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" name="Records" radius={[5, 5, 0, 0]} maxBarSize={42} onClick={open} isAnimationActive={false}>
                  {chart.points.map((p, i) => (
                    <Cell key={p.key} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid h-44 place-items-center rounded-xl bg-surface-2/60 text-center">
          <div>
            <Activity className="mx-auto mb-3 size-6 text-subtle" />
            <p className="text-sm font-medium">No activity recorded</p>
            <p className="mt-1 text-xs text-muted">Real activity will appear here as it happens.</p>
          </div>
        </div>
      )}
      {chart.kind === 'donut' && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {chart.points.map((p, i) => (
            <Link key={p.key} href={p.href} className="flex min-h-8 items-center gap-2 text-[10px] text-muted">
              <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {p.label}
              <b className="text-fg">{p.value.toLocaleString('en-IN')}</b>
            </Link>
          ))}
        </div>
      )}
      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand-600">View data & open records</summary>
        <div className="mt-3 max-h-48 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-2 text-left">{chart.kind === 'line' ? 'Date' : 'Category'}</th>
                <th className="text-right">Records</th>
              </tr>
            </thead>
            <tbody>
              {chart.points.map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="py-2">
                    <Link className="text-brand-600 hover:underline" href={p.href}>
                      {p.label} ↗
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{p.value.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export function EnterpriseDashboard({ role, children }: { role: DashboardData['role']; children?: React.ReactNode }) {
  const { user } = useAuth();
  const [range, setRange] = useState('30');
  const [dates, setDates] = useState({ from: '', to: '' });
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [validation, setValidation] = useState('');
  const query = custom ? new URLSearchParams(custom) : new URLSearchParams({ days: range === 'custom' ? '30' : range });
  const url = role === 'admin' ? '/admin/dashboard/metrics' : role === 'broker' ? '/broker/dashboard/metrics' : '/me/dashboard';
  const q = useQuery({
    queryKey: ['enterprise-dashboard', role, user?.id, query.toString()],
    queryFn: () => api<DashboardData>(url + '?' + query),
    refetchInterval: 60000,
  });
  const d = q.data;
  const name = user?.name.split(' ')[0] ?? '';
  return (
    <div className="space-y-6">
      <header className="workspace-hero flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="section-kicker">
            {role === 'admin' ? 'PLATFORM INTELLIGENCE' : role === 'broker' ? 'YOUR BUSINESS, IN FOCUS' : 'YOUR PROPERTY JOURNEY'}
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {role === 'admin' ? (
              'A clearer view of BrokerIQ.'
            ) : (
              <>
                <span>Good to see you</span>
                {name ? `, ${name}` : ''}.
              </>
            )}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted">
            {role === 'admin'
              ? 'People, properties and the work that needs your attention.'
              : role === 'broker'
                ? user?.role === 'BROKER_AGENT'
                  ? 'Your assigned leads, follow-ups and performance targets.'
                  : 'Your inventory, relationships and next actions, connected.'
                : 'Your favourites, conversations and next visit, together.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => q.refetch()} aria-label="Refresh dashboard">
            <RefreshCw className={`size-4 ${q.isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            href={
              role === 'admin'
                ? '/admin/moderation'
                : role === 'broker'
                  ? user?.role === 'BROKER_AGENT'
                    ? '/broker/leads'
                    : '/broker/inventory'
                  : '/user/search'
            }
          >
            {role === 'admin' ? 'Review listings' : role === 'broker' ? (user?.role === 'BROKER_AGENT' ? 'Open leads' : 'Open inventory') : 'Explore rentals'}
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="size-4 text-brand-600" />
          <label className="sr-only" htmlFor="report-period">
            Reporting period
          </label>
          <select
            id="report-period"
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              if (e.target.value !== 'custom') setCustom(null);
            }}
            className="min-h-11 rounded-xl border border-line bg-surface px-3 text-xs font-semibold"
          >
            {['7', '30', '90'].map((v) => (
              <option key={v} value={v}>
                Last {v} days
              </option>
            ))}
            <option value="custom">Custom dates</option>
          </select>
          {range === 'custom' && (
            <>
              <input
                aria-label="From date"
                type="date"
                value={dates.from}
                onChange={(e) => setDates({ ...dates, from: e.target.value })}
                className="min-h-11 rounded-xl border border-line bg-surface px-3 text-xs"
              />
              <input
                aria-label="To date"
                type="date"
                value={dates.to}
                onChange={(e) => setDates({ ...dates, to: e.target.value })}
                className="min-h-11 rounded-xl border border-line bg-surface px-3 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const parsed = dashboardQuerySchema.safeParse(dates);
                  if (!parsed.success) {
                    setValidation(parsed.error.issues[0].message);
                    return;
                  }
                  setValidation('');
                  setCustom(dates);
                }}
              >
                Apply
              </Button>
            </>
          )}
        </div>
        <p className="text-[10px] text-muted">{d ? `${d.period.from} — ${d.period.to} · IST` : 'Loading reporting period…'}</p>
      </div>
      {validation && (
        <p role="alert" className="text-sm text-rose-600">
          {validation}
        </p>
      )}
      {q.error && <ApiErrorState error={q.error} onRetry={() => q.refetch()} />}
      {!d && !q.error ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        d && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {d.metrics.map((m, i) => (
                <Link key={m.key} href={m.href} title={m.definition} className="metric-card group relative">
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ background: COLORS[i % COLORS.length] + '15', color: COLORS[i % COLORS.length] }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <ArrowUpRight className="size-3.5 text-subtle transition-transform group-hover:-translate-y-0.5" />
                  </div>
                  <p className="metric-label">{m.label}</p>
                  <p className="metric-value">{m.value === null ? '—' : m.value.toLocaleString('en-IN')}</p>
                  <p className="mt-2 text-[10px] leading-4 text-muted">{m.value === null ? 'Module unavailable' : m.definition}</p>
                </Link>
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {d.charts.map((c) => (
                <Chart key={c.key} chart={c} />
              ))}
            </div>
            {!!d.integrations?.length && (
              <section className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-sm font-bold">
                    <ShieldCheck className="size-4 text-brand-600" />
                    Connection readiness
                  </h2>
                  <Link href="/admin/settings/integrations" className="text-xs font-semibold text-brand-600">
                    Manage →
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {d.integrations.map((i) => (
                    <div key={i.key} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-xs">
                      <span className="font-medium">{i.name}</span>
                      <span className={i.configured && i.tested ? 'text-emerald-600' : 'text-amber-700 dark:text-amber-300'}>
                        {!i.configured ? 'Setup needed' : i.tested ? 'Test passed' : 'Test needed'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <p className="text-[10px] text-muted">
              Updated {new Date(d.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · Current snapshots and period activity are labelled
              separately.
            </p>
          </>
        )
      )}
      {children}
    </div>
  );
}
