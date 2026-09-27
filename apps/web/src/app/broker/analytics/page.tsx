'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeIndianRupee, CalendarCheck, Clock, Eye, Inbox, MessageSquare, Target, Trophy } from 'lucide-react';
import { LEAD_SOURCE_COLORS, LEAD_SOURCE_LABELS, LEAD_STAGES, LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, VISIT_STATUS_LABELS, formatINR, formatPriceShort, type LeadSource, type LeadStage, type VisitStatus } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Avatar, Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { CountUp } from '@/components/motion/reveal';

const tip = { contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, fontSize: 12 }, labelStyle: { color: 'var(--color-muted)' } };

function mins(m: number | null) {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} घंटे`;
  return `${Math.round(m / 1440)} दिन`;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<'7' | '30' | '90' | '365'>('30');
  const from = new Date(Date.now() - Number(days) * 86400_000).toISOString();
  const q = useQuery({ queryKey: ['analytics', days], queryFn: () => api<any>(`/broker/analytics${qs({ from })}`), placeholderData: (p) => p });
  const d = q.data;
  const funnel = d ? LEAD_STAGES.filter((s) => s !== 'LOST').map((s) => ({ stage: s, count: d.byStage.find((x: any) => x.stage === s)?.count ?? 0 })) : [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="कौन-सा source पैसे कमा रहा है, team कितनी तेज़ है, और deals कहाँ अटकती हैं"
        actions={<Segmented size="sm" value={days} onChange={setDays} options={[{ value: '7', label: '7 दिन' }, { value: '30', label: '30 दिन' }, { value: '90', label: '90 दिन' }, { value: '365', label: '1 साल' }]} />}
      />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total leads" value={<CountUp to={d.totals.leads} />} icon={<Inbox className="size-5" />} />
            <Stat label="Won" value={<><CountUp to={d.totals.won} /> <span className="text-sm font-semibold text-muted">· {d.totals.conversionRate}%</span></>} icon={<Trophy className="size-5" />} tone="success" />
            <Stat label="First response (median)" value={mins(d.totals.medianFirstResponseMin)} hint={`avg ${mins(d.totals.avgFirstResponseMin)}`} icon={<Clock className="size-5" />} tone={d.totals.medianFirstResponseMin != null && d.totals.medianFirstResponseMin <= 15 ? 'success' : 'warning'} />
            <Stat label="Commission (closed)" value={formatINR(d.deals.commission)} hint={`${d.deals.count} deals · ${formatPriceShort(d.deals.value)}`} icon={<BadgeIndianRupee className="size-5" />} tone="info" />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <p className="mb-4 font-display font-bold">Daily leads</p>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={d.daily.map((x: any) => ({ day: formatDate(x.day, { day: 'numeric', month: 'short' }), count: x.count }))}>
                    <defs>
                      <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip {...tip} />
                    <Area type="monotone" dataKey="count" name="Leads" stroke="#4F46E5" strokeWidth={2.5} fill="url(#gl)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <p className="mb-4 font-display font-bold">Funnel</p>
              <div className="space-y-2.5">
                {funnel.map((f, i) => (
                  <div key={f.stage}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{LEAD_STAGE_LABELS[f.stage as LeadStage]}</span><span className="text-muted">{f.count}</span></div>
                    <div className="h-2.5 rounded-full bg-surface-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(f.count / funnelMax) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.6 }} className="h-full rounded-full" style={{ background: LEAD_STAGE_COLORS[f.stage as LeadStage] }} />
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted">Lost: {d.byStage.find((x: any) => x.stage === 'LOST')?.count ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <p className="mb-1 font-display font-bold">Source-wise performance</p>
              <p className="mb-4 text-xs text-muted">हर portal से कितनी leads आईं और कितनी convert हुईं — कहाँ पैसा लगाना है, यहाँ से तय करें</p>
              {d.bySource.length ? (
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={d.bySource.map((s: any) => ({ ...s, label: LEAD_SOURCE_LABELS[s.source as LeadSource] ?? s.source }))} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip {...tip} formatter={(v, n, p: any) => (n === 'Won' ? [`${v} (${p.payload.conversion}%)`, n] : [v, n])} />
                      <Bar dataKey="total" name="Leads" radius={[0, 6, 6, 0]}>
                        {d.bySource.map((s: any) => <Cell key={s.source} fill={LEAD_SOURCE_COLORS[s.source as LeadSource] ?? '#64748b'} fillOpacity={0.35} />)}
                      </Bar>
                      <Bar dataKey="won" name="Won" radius={[0, 6, 6, 0]}>
                        {d.bySource.map((s: any) => <Cell key={s.source} fill={LEAD_SOURCE_COLORS[s.source as LeadSource] ?? '#64748b'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-16 text-center text-sm text-muted">इस अवधि में कोई lead नहीं</p>
              )}
            </div>
            <div className="card p-5">
              <p className="mb-4 font-display font-bold">Site visits</p>
              {d.visits.length ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={d.visits} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={3}>
                          {d.visits.map((v: any) => <Cell key={v.status} fill={{ SCHEDULED: '#6366f1', CONFIRMED: '#0ea5e9', COMPLETED: '#10b981', CANCELLED: '#94a3b8', NO_SHOW: '#f43f5e' }[v.status as string]} />)}
                        </Pie>
                        <Tooltip {...tip} formatter={(v, n) => [v, VISIT_STATUS_LABELS[n as VisitStatus] ?? n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {d.visits.map((v: any) => <span key={v.status} className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold">{VISIT_STATUS_LABELS[v.status as VisitStatus]}: {v.count}</span>)}
                  </div>
                </>
              ) : (
                <div className="grid h-48 place-items-center text-center text-sm text-muted"><div><CalendarCheck className="mx-auto mb-2 size-6" /> कोई visit नहीं</div></div>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {d.agents.length > 0 && (
              <div className="card overflow-hidden">
                <p className="p-5 pb-3 font-display font-bold">Agent performance</p>
                <table className="w-full text-sm">
                  <thead className="bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
                    <tr><th className="px-5 py-2.5">Agent</th><th className="px-3 py-2.5 text-center">Leads</th><th className="px-3 py-2.5 text-center">Won</th><th className="px-3 py-2.5 text-center">Conv.</th><th className="px-5 py-2.5 text-center">Activities</th></tr>
                  </thead>
                  <tbody>
                    {d.agents.map((a: any) => (
                      <tr key={a.id} className="border-t border-line">
                        <td className="px-5 py-2.5"><span className="flex items-center gap-2 font-semibold"><Avatar name={a.name} size={26} /> {a.name}</span></td>
                        <td className="px-3 py-2.5 text-center">{a.leads}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-emerald-600">{a.won}</td>
                        <td className="px-3 py-2.5 text-center">{a.leads ? `${Math.round((a.won / a.leads) * 100)}%` : '—'}</td>
                        <td className="px-5 py-2.5 text-center">{a.activities}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card overflow-hidden">
              <p className="p-5 pb-3 font-display font-bold">Top listings</p>
              {d.topListings.length ? (
                <div className="divide-y divide-line">
                  {d.topListings.map((l: any, i: number) => (
                    <Link key={l.id} href={`/property/${l.slug}`} target="_blank" className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-surface-2/60">
                      <span className="w-5 text-xs font-bold text-subtle">{i + 1}</span>
                      <span className="line-clamp-1 flex-1 font-medium">{l.title}</span>
                      <span className="flex items-center gap-1 text-xs text-muted"><Eye className="size-3.5" /> {l.views}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand-600"><MessageSquare className="size-3.5" /> {l.enquiryCount}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="p-5 pt-0 text-sm text-muted">अभी कोई listing नहीं</p>
              )}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-subtle"><Target className="size-3.5" /> Tip: 5 मिनट के अंदर पहला response देने से conversion कई गुना बढ़ता है — “तुरंत WhatsApp welcome” automation चालू रखें।</p>
        </div>
      )}
    </>
  );
}
