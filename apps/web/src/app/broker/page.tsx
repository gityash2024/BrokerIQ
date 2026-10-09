'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  Flame,
  Handshake,
  IndianRupee,
  Inbox,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  ScanLine,
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
      {/* Executive Quick-Action Deck */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href="/broker/inventory"
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:scale-105 dark:bg-emerald-500/15">
            <FileSpreadsheet className="size-5" />
          </div>
          <span className="text-xs font-bold text-fg">Property Ledger</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
            {d?.kpis.totalInventory ?? 1698} Units
          </span>
        </Link>

        <Link
          href="/broker/scanner"
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-purple-50 text-purple-600 transition group-hover:scale-105 dark:bg-purple-500/15">
            <ScanLine className="size-5" />
          </div>
          <span className="text-xs font-bold text-fg">AI Book Scan</span>
          <span className="text-[10px] text-muted">Register OCR</span>
        </Link>

        <Link
          href="/broker/leads"
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:scale-105 dark:bg-brand-500/15">
            <Inbox className="size-5" />
          </div>
          <span className="text-xs font-bold text-fg">Leads Inbox</span>
          <span className="text-[10px] text-muted">{d?.kpis.open ?? 0} Active</span>
        </Link>

        <Link
          href="/broker/inbox"
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-[#25D366]/10 text-[#25D366] transition group-hover:scale-105">
            <MessagesSquare className="size-5" />
          </div>
          <span className="text-xs font-bold text-fg">WhatsApp & Chat</span>
          <span className="text-[10px] text-muted">{d?.kpis.unreadMessages ? `${d.kpis.unreadMessages} Unread` : 'All clear'}</span>
        </Link>

        <Link
          href="/broker/network"
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:scale-105 dark:bg-indigo-500/15">
            <Handshake className="size-5" />
          </div>
          <span className="text-xs font-bold text-fg">Co-Broking</span>
          <span className="text-[10px] text-muted">Broker Network</span>
        </Link>

        <Link
          href="/broker/agreements"
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-brand-500 hover:shadow-md"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:scale-105 dark:bg-amber-500/15">
            <CheckCircle2 className="size-5" />
          </div>
          <span className="text-xs font-bold text-fg">Rent Agreement</span>
          <span className="text-[10px] text-muted">Instant e-Sign</span>
        </Link>
      </div>

      {!d ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Link href="/broker/inventory">
            <Stat
              label="Verified Register"
              value={<CountUp to={d.kpis.totalInventory ?? 1698} />}
              icon={<FileSpreadsheet className="size-5" />}
              tone="success"
              hint="117 Pages Cleaned"
            />
          </Link>
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
            <Link href="/broker/connectors">
              <Stat
                label="Housing Portal"
                value={d.housingConnector?.status === 'ACTIVE' ? 'Connected' : 'Configured'}
                icon={<Building2 className="size-5" />}
                tone={d.housingConnector?.status === 'ACTIVE' ? 'success' : 'warning'}
                hint={`${d.housingConnector?.leadsImported ?? 0} Leads synced`}
              />
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

      {/* Gurgaon Prime Sectors Inventory Heatmap */}
      {d?.sectors?.length > 0 && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
                <MapPin className="size-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base">Gurgaon Prime Sectors (Register Distribution)</h2>
                <p className="text-xs text-muted">117 Handwritten Register Pages — 1,698 Verified Units</p>
              </div>
            </div>
            <Link
              href="/broker/inventory"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Open Full Ledger →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {d.sectors.map((s: any) => (
              <Link
                key={s.sector}
                href={`/broker/inventory?sector=${encodeURIComponent(s.sector)}`}
                className="group flex flex-col justify-between rounded-xl border border-line bg-surface-2 p-3 transition hover:border-brand-500 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-fg group-hover:text-brand-600 truncate">{s.sector}</span>
                  <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-brand-500/20 dark:text-brand-300">
                    {s.count}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
                  <span>Units</span>
                  <ArrowRight className="size-3 text-subtle transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
