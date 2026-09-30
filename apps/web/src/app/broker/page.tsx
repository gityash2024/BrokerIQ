'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Flame,
  IndianRupee,
  Inbox,
  MessageCircle,
  MessagesSquare,
  Phone,
  UserX,
} from 'lucide-react';
import {
  LEAD_SOURCE_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  OPEN_LEAD_STAGES,
  formatPriceShort,
  timeAgo,
  whatsappLink,
} from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { SourceBadge, StageBadge } from '@/components/broker/bits';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { Empty, Skeleton, Stat } from '@/components/ui/misc';
import { CountUp } from '@/components/motion/reveal';

function SetupChecklist() {
  const { user } = useAuth();
  const c = useQuery({ queryKey: ['connectors'], queryFn: () => api<any>('/broker/connectors'), enabled: user?.role === 'BROKER_ADMIN' });
  const a = useQuery({ queryKey: ['automations'], queryFn: () => api<any[]>('/automations'), enabled: user?.role === 'BROKER_ADMIN' });
  const l = useQuery({ queryKey: ['my-listings', '', ''], queryFn: () => api<any>('/listings/mine?pageSize=1') });
  const t = useQuery({ queryKey: ['team'], queryFn: () => api<any>('/broker/team') });
  if (user?.role !== 'BROKER_ADMIN' || !c.data) return null;
  const has = (k: string) => c.data.connectors.find((x: any) => x.key === k)?.config?.configured;
  const steps = [
    { done: has('email_inbox'), t: 'Housing / 99acres / MagicBricks inbox connect करें', href: '/broker/connectors?key=email_inbox' },
    { done: has('whatsapp'), t: 'अपना WhatsApp Business number जोड़ें', href: '/broker/connectors?key=whatsapp' },
    { done: (a.data?.length ?? 0) > 0, t: 'पहला automation चालू करें (auto WhatsApp welcome)', href: '/broker/automations' },
    { done: (l.data?.total ?? 0) > 0, t: 'पहली listing डालें या register scan करें', href: '/broker/listings/new' },
    { done: (t.data?.members?.length ?? 0) > 1, t: 'Team member invite करें', href: '/broker/team' },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-indigo-700 p-5 text-white">
        <div>
          <p className="font-display text-lg font-bold">Setup पूरा करें 🚀</p>
          <p className="text-sm text-white/75">
            {done}/{steps.length} steps — पूरा setup = 3x ज़्यादा converted leads
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-white/20">
          <motion.div className="h-full bg-saffron-400" initial={{ width: 0 }} animate={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="divide-y divide-line">
        {steps.map((s) => (
          <Link key={s.t} href={s.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
            {s.done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5 text-subtle" />}
            <span className={s.done ? 'text-muted line-through' : 'font-medium'}>{s.t}</span>
            {!s.done && <ArrowRight className="ml-auto size-4 text-subtle" />}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BrokerDashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['broker-dashboard'], queryFn: () => api<any>('/broker/dashboard'), refetchInterval: 60_000 });
  if (q.error) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const pipeline = OPEN_LEAD_STAGES.map((s) => ({ stage: s, count: d?.pipeline.find((p: any) => p.stage === s)?.count ?? 0 }));
  const maxP = Math.max(1, ...pipeline.map((p) => p.count));
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${user?.name.split(' ')[0]} 👋`}
        subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Button href="/broker/leads" variant="secondary">
            Lead inbox <ArrowRight className="size-4" />
          </Button>
        }
      />
      {!d ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link href="/broker/leads?view=new">
            <Stat label="आज की नई leads" value={<CountUp to={d.kpis.newToday} />} icon={<Inbox className="size-5" />} hint={`${d.kpis.open} open leads`} />
          </Link>
          <Link href="/broker/follow-ups?view=overdue">
            <Stat
              label="Overdue follow-ups"
              value={<CountUp to={d.kpis.overdue} />}
              icon={<AlertTriangle className="size-5" />}
              tone={d.kpis.overdue ? 'danger' : 'success'}
            />
          </Link>
          {user?.role === 'BROKER_ADMIN' ? (
            <Link href="/broker/leads?view=unassigned">
              <Stat label="Unassigned" value={<CountUp to={d.kpis.unassigned} />} icon={<UserX className="size-5" />} tone="warning" />
            </Link>
          ) : (
            <Link href="/broker/inbox">
              <Stat label="Unread messages" value={d.kpis.unreadMessages} icon={<MessagesSquare className="size-5" />} tone="info" />
            </Link>
          )}
          <Link href="/broker/deals">
            <Stat
              label="इस महीने commission"
              value={formatPriceShort(d.kpis.commissionThisMonth)}
              icon={<IndianRupee className="size-5" />}
              tone="success"
              hint={`${d.kpis.wonThisMonth} deals won`}
            />
          </Link>
        </div>
      )}
      <SetupChecklist />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="card">
          <div className="flex items-center justify-between border-b border-line p-5">
            <h2 className="flex items-center gap-2 font-display font-bold">
              <Flame className="size-5 text-rose-500" /> आज के follow-ups
            </h2>
            <Link href="/broker/follow-ups" className="text-sm font-semibold text-brand-600">
              All →
            </Link>
          </div>
          {!d?.todayFollowUps.length ? (
            <Empty className="m-5 border-none" title="आज कोई follow-up नहीं 🎉" text="नई leads पर focus करें।" />
          ) : (
            <div className="divide-y divide-line">
              {d.todayFollowUps.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/broker/leads/${f.lead.id}`} className="font-semibold hover:text-brand-600">
                      {f.lead.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {f.type} · {formatDateTime(f.dueAt)}
                      {f.note ? ` · ${f.note}` : ''}
                    </p>
                  </div>
                  {new Date(f.dueAt) < new Date() && <span className="text-[11px] font-bold text-rose-600">OVERDUE</span>}
                  <Button size="icon-sm" variant="secondary" href={`tel:${f.lead.phone}`} aria-label="Call">
                    <Phone className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="whatsapp" href={whatsappLink(f.lead.phone)} external aria-label="WhatsApp">
                    <MessageCircle className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-display font-bold">
            <CalendarCheck className="size-5 text-brand-600" /> आज की site visits
          </h2>
          {!d?.todayVisits.length ? (
            <p className="mt-4 text-sm text-muted">आज कोई visit scheduled नहीं।</p>
          ) : (
            <div className="mt-4 space-y-3">
              {d.todayVisits.map((v: any) => (
                <Link key={v.id} href={`/broker/leads/${v.lead.id}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-600 text-xs font-bold text-white">
                    {new Date(v.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{v.lead.name}</p>
                    <p className="truncate text-xs text-muted">{v.listing?.title ?? v.address ?? 'Location TBD'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="font-display font-bold">Pipeline</h2>
          <div className="mt-5 space-y-3">
            {pipeline.map((p) => (
              <Link key={p.stage} href={`/broker/leads?stage=${p.stage}`} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted">{LEAD_STAGE_LABELS[p.stage]}</span>
                <div className="h-8 flex-1 overflow-hidden rounded-lg bg-surface-2">
                  <motion.div
                    className="flex h-full items-center rounded-lg px-3 text-xs font-bold text-white"
                    style={{ background: LEAD_STAGE_COLORS[p.stage] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(6, (p.count / maxP) * 100)}%` }}
                    transition={{ duration: 0.8 }}
                  >
                    {p.count}
                  </motion.div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display font-bold">Lead sources (7 days)</h2>
          {d?.sources7d.length ? (
            <>
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={d.sources7d} dataKey="count" nameKey="source" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {d.sources7d.map((s: any) => (
                        <Cell key={s.source} fill={LEAD_SOURCE_COLORS[s.source as keyof typeof LEAD_SOURCE_COLORS]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [v, LEAD_SOURCE_LABELS[n as keyof typeof LEAD_SOURCE_LABELS]]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.sources7d.map((s: any) => (
                  <SourceBadge key={s.source} source={s.source} />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              पिछले 7 दिन में कोई lead नहीं।{' '}
              <Link href="/broker/connectors" className="text-brand-600">
                Connectors जोड़ें →
              </Link>
            </p>
          )}
        </div>
      </div>
      <div className="card">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="font-display font-bold">Latest leads</h2>
          <Link href="/broker/leads" className="text-sm font-semibold text-brand-600">
            All →
          </Link>
        </div>
        <div className="divide-y divide-line">
          {d?.recentLeads.map((l: any) => (
            <Link key={l.id} href={`/broker/leads/${l.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2">
              <span className="min-w-40 flex-1 font-semibold">{l.name}</span>
              <SourceBadge source={l.source} />
              <StageBadge stage={l.stage} />
              <span className="w-28 text-right text-xs text-subtle">{timeAgo(l.createdAt)}</span>
            </Link>
          ))}
          {!d?.recentLeads.length && <p className="p-5 text-sm text-muted">अभी कोई lead नहीं।</p>}
        </div>
      </div>
    </div>
  );
}
