'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  Home,
  Inbox,
  KeyRound,
  LifeBuoy,
  ListChecks,
  MessageSquare,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { INTEGRATIONS, LEAD_SOURCE_COLORS, LEAD_SOURCE_LABELS, formatINR, type LeadSource } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { CountUp } from '@/components/motion/reveal';
import { useFreeMode } from '@/lib/config';

const tip = { contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, fontSize: 12 } };
const PIE = ['#4F46E5', '#F59E0B', '#10B981', '#0EA5E9', '#E11D48', '#8B5CF6'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const freeMode = useFreeMode();
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api<any>('/admin/dashboard') });
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const k = d?.kpis;
  const missing = (d?.integrations ?? []).filter((i: any) => !i.configured);
  const queues = k
    ? [
        {
          href: '/admin/moderation',
          label: 'Listings review के लिए',
          n: k.pendingListings,
          icon: ListChecks,
          tone: 'text-brand-600 bg-brand-50 dark:bg-brand-500/15',
        },
        { href: '/admin/kyc', label: 'KYC documents', n: k.kycPending, icon: BadgeCheck, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15' },
        { href: '/admin/reports', label: 'Reported listings', n: k.reportsOpen, icon: ShieldAlert, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/15' },
        { href: '/admin/support', label: 'Support tickets', n: k.openTickets, icon: LifeBuoy, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15' },
      ]
    : [];

  return (
    <>
      <PageHeader title={`नमस्ते, ${user?.name?.split(' ')[0] ?? 'Admin'} 👋`} subtitle="Platform का live हाल — users, brokers, revenue और pending काम" />

      {missing.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:flex-row sm:items-center dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
            <KeyRound className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">{missing.length} integrations अभी configure नहीं हैं</p>
            <p className="text-sm text-muted">
              {missing.map((m: any) => INTEGRATIONS.find((x) => x.key === m.key)?.name ?? m.key).join(', ')} — इनके बिना कुछ features काम नहीं करेंगे।
            </p>
          </div>
          <Link href="/admin/settings/integrations" className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 dark:text-amber-300">
            Credentials center <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      )}

      {!d ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {freeMode ? (
              <Stat
                label="Leads (30d)"
                value={<CountUp to={k.leads30} />}
                icon={<TrendingUp className="size-5" />}
                tone="success"
                hint="Free mode — billing बंद"
              />
            ) : (
              <Stat
                label="MRR"
                value={formatINR(k.mrr)}
                icon={<TrendingUp className="size-5" />}
                tone="success"
                hint={`30 दिन revenue ${formatINR(k.revenue30)}`}
              />
            )}
            <Stat label="Users" value={<CountUp to={k.users} />} icon={<Users className="size-5" />} />
            <Stat label="Broker firms" value={<CountUp to={k.brokers} />} icon={<Building2 className="size-5" />} tone="info" />
            <Stat
              label="Live listings"
              value={<CountUp to={k.listings} />}
              icon={<Home className="size-5" />}
              tone="warning"
              hint={`${k.leads30} leads · ${k.enquiries30} enquiries (30d)`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {queues.map((x, i) => (
              <motion.div key={x.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={x.href} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <span className={`grid size-11 place-items-center rounded-xl ${x.tone}`}>
                    <x.icon className="size-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-display text-2xl font-extrabold">{x.n}</p>
                    <p className="text-xs text-muted">{x.label}</p>
                  </div>
                  {x.n > 0 ? (
                    <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-1 group-hover:text-fg" />
                  ) : (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  )}
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <p className="mb-4 font-display font-bold">पिछले 30 दिन</p>
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={d.series.map((s: any) => ({ ...s, day: formatDate(s.day, { day: 'numeric', month: 'short' }) }))}>
                    <defs>
                      {[
                        ['u', '#4F46E5'],
                        ['l', '#F59E0B'],
                        ['d', '#10B981'],
                      ].map(([id, c]) => (
                        <linearGradient key={id} id={`a-${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={c} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip {...tip} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="users" name="Signups" stroke="#4F46E5" strokeWidth={2} fill="url(#a-u)" />
                    <Area type="monotone" dataKey="listings" name="Listings" stroke="#F59E0B" strokeWidth={2} fill="url(#a-l)" />
                    <Area type="monotone" dataKey="leads" name="Leads" stroke="#10B981" strokeWidth={2} fill="url(#a-d)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <p className="mb-4 font-display font-bold">Plan mix</p>
              {d.planMix.length ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={d.planMix} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={90} paddingAngle={3}>
                        {d.planMix.map((_: any, i: number) => (
                          <Cell key={i} fill={PIE[i % PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...tip} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="grid h-64 place-items-center text-sm text-muted">अभी कोई subscription नहीं</p>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {!freeMode && (
              <div className="card p-5">
                <p className="mb-4 flex items-center gap-2 font-display font-bold">
                  <BadgeIndianRupee className="size-5 text-emerald-600" /> Revenue (12 महीने)
                </p>
                {d.revenue.length ? (
                  <div className="h-60">
                    <ResponsiveContainer>
                      <BarChart data={d.revenue.map((r: any) => ({ ...r, month: formatDate(r.month, { month: 'short', year: '2-digit' }) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} width={50} />
                        <Tooltip {...tip} formatter={(v) => formatINR(Number(v))} />
                        <Bar dataKey="amount" name="Revenue" fill="#10B981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="grid h-60 place-items-center text-center text-sm text-muted">
                    अभी कोई payment नहीं।
                    <br />
                    Razorpay जोड़ें और plans/boosts बेचना शुरू करें।
                  </p>
                )}
              </div>
            )}
            <div className="card p-5">
              <p className="mb-4 flex items-center gap-2 font-display font-bold">
                <Inbox className="size-5 text-brand-600" /> Lead sources (platform-wide, 30d)
              </p>
              {d.leadSources.length ? (
                <div className="space-y-2.5">
                  {[...d.leadSources]
                    .sort((a: any, b: any) => b.count - a.count)
                    .map((s: any) => {
                      const max = Math.max(...d.leadSources.map((x: any) => x.count));
                      const c = LEAD_SOURCE_COLORS[s.source as LeadSource] ?? '#64748b';
                      return (
                        <div key={s.source}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="font-semibold">{LEAD_SOURCE_LABELS[s.source as LeadSource] ?? s.source}</span>
                            <span className="text-muted">{s.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(s.count / max) * 100}%` }}
                              className="h-full rounded-full"
                              style={{ background: c }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="grid h-60 place-items-center text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="size-4" /> अभी कोई lead नहीं
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="mb-3 font-display font-bold">Integrations status</p>
            <div className="flex flex-wrap gap-2">
              {d.integrations.map((i: any) => {
                const def = INTEGRATIONS.find((x) => x.key === i.key);
                return (
                  <Link
                    key={i.key}
                    href={`/admin/settings/integrations?key=${i.key}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
                  >
                    {i.configured ? (
                      i.lastTestOk === false ? (
                        <AlertTriangle className="size-3.5 text-rose-500" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      )
                    ) : (
                      <span className="size-2 rounded-full bg-amber-500" />
                    )}
                    {def?.name ?? i.key}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
