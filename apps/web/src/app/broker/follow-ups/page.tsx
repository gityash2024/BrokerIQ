'use client';
import { leadInboxUrl } from '@/lib/inbox-composer';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { AlarmClock, CalendarPlus, Check, Clock, ListChecks, Mail, MessageCircle, Phone, Trash2, Users, X } from 'lucide-react';
import { FollowUpType, followUpDateBoundary, followUpIstDayEnd, followUpTomorrowAtTen } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate, qs, toLocalInput } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { StageBadge, useAssignees } from '@/components/broker/bits';
import { LeadPicker } from '@/components/broker/lead-picker';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

type View = 'today' | 'overdue' | 'upcoming' | 'done' | 'all';
type FollowUpPage = { items: any[]; total: number; page: number; totalPages: number };
const TYPE_ICON = { CALL: Phone, WHATSAPP: MessageCircle, MEETING: Users, EMAIL: Mail, OTHER: ListChecks } as const;

function dayKey(d: Date) {
  const diff = Math.round((followUpIstDayEnd(d).getTime() - followUpIstDayEnd().getTime()) / 86400_000);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'आज';
  if (diff === 1) return 'कल';
  return formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function FollowUpsPage() {
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const team = useAssignees();
  const [view, setView] = useState<View>('today');
  const [agent, setAgent] = useState('');
  const [done, setDone] = useState<any>(null);
  const [outcome, setOutcome] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const fromDate = from ? followUpDateBoundary(from) : undefined;
  const toDate = to ? followUpDateBoundary(to, true) : undefined;
  const invalidDates = !!((from && !fromDate) || (to && !toDate) || (fromDate && toDate && fromDate > toDate));
  const sharedParams = { search, assignedToId: agent, from: fromDate, to: toDate };
  const params = {
    ...sharedParams,
    paginated: 'true',
    page,
    view: view === 'done' ? 'all' : view,
    status: view === 'done' ? 'DONE' : view === 'all' ? status : undefined,
    sortBy: view === 'done' ? 'completedAt' : 'dueAt',
    sortOrder: view === 'done' ? 'desc' : 'asc',
  };
  const q = useQuery({
    queryKey: ['follow-ups', view, agent, page, search, from, to, status],
    queryFn: () => api<FollowUpPage>(`/follow-ups${qs(params)}`),
    enabled: !invalidDates,
  });
  const counts = useQuery({
    queryKey: ['follow-ups', 'counts', agent, search, from, to],
    queryFn: () => api<{ today: number; overdue: number }>(`/follow-ups/summary${qs(sharedParams)}`),
    enabled: !invalidDates,
    refetchInterval: 60000,
  });
  const inv = [['follow-ups'], ['broker-dashboard']];
  const update = useApiMutation(({ id, ...b }: any) => patch(`/follow-ups/${id}`, b), { invalidate: inv });
  const remove = useApiMutation((id: string) => del(`/follow-ups/${id}`), { success: 'Follow-up हटाया', invalidate: inv });

  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const f of q.data?.items ?? []) {
      const k = view === 'done' ? formatDate(f.completedAt ?? f.dueAt, { day: 'numeric', month: 'short', weekday: 'short' }) : dayKey(new Date(f.dueAt));
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m.entries()];
  }, [q.data, view]);

  const snooze = (f: any, ms: number | 'tomorrow') => {
    let d = new Date(Date.now() + (typeof ms === 'number' ? ms : 0));
    if (ms === 'tomorrow') {
      d = followUpTomorrowAtTen();
    }
    update.mutate({ id: f.id, dueAt: d.toISOString() });
  };

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle="कोई भी client छूटे नहीं — समय पर reminder push और email से भी आता है"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <CalendarPlus className="size-4" /> Follow-up जोड़ें
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={view}
          onChange={(value) => {
            setView(value);
            setPage(1);
          }}
          options={[
            { value: 'today', label: 'आज तक', count: counts.data?.today },
            { value: 'overdue', label: 'Overdue', count: counts.data?.overdue },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
        {admin && (
          <Select
            value={agent}
            onChange={(e) => {
              setAgent(e.target.value);
              setPage(1);
            }}
            className="h-10 w-44"
          >
            <option value="">पूरी team</option>
            {(team.data?.members ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search lead / note">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, phone, email or note"
          />
        </Field>
        <Field label="Due from (IST)">
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Due to (IST)">
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        {view === 'all' ? (
          <Field label="Status">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {['PENDING', 'DONE', 'MISSED', 'CANCELLED'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setFrom('');
              setTo('');
              setAgent('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {view === 'all' && (
        <Button
          className="mb-4"
          variant="secondary"
          onClick={() => {
            setSearch('');
            setFrom('');
            setTo('');
            setAgent('');
            setStatus('');
            setPage(1);
          }}
        >
          Clear filters
        </Button>
      )}
      {invalidDates ? (
        <p role="alert" className="mb-5 text-sm text-rose-600">
          Valid start/end dates चुनें; end date start के बाद होनी चाहिए।
        </p>
      ) : q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !q.data.items.length ? (
        <Empty
          icon={<Check className="size-7" />}
          title={view === 'overdue' ? 'कोई overdue follow-up नहीं 🎉' : view === 'done' ? 'अभी कोई completed follow-up नहीं' : 'सब clear है'}
          text="Lead detail page से या ऊपर के button से follow-up schedule करें।"
        />
      ) : (
        <div className="space-y-7">
          {groups.map(([k, items]) => (
            <section key={k}>
              <p className={cn('mb-2.5 text-xs font-bold tracking-wider uppercase', k === 'Overdue' ? 'text-rose-600' : 'text-subtle')}>
                {k} · {items.length}
              </p>
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {items.map((f) => {
                    const Icon = TYPE_ICON[f.type as keyof typeof TYPE_ICON] ?? ListChecks;
                    const overdue = f.status === 'PENDING' && new Date(f.dueAt) < new Date();
                    return (
                      <motion.div
                        key={f.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        className={cn('card flex flex-col gap-3 p-4 sm:flex-row sm:items-center', overdue && 'border-rose-200 dark:border-rose-500/30')}
                      >
                        <div
                          className={cn(
                            'grid size-11 shrink-0 place-items-center rounded-xl',
                            f.status === 'DONE'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15'
                              : overdue
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15'
                                : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15',
                          )}
                        >
                          {f.status === 'DONE' ? <Check className="size-5" /> : <Icon className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/broker/leads/${f.lead.id}`} className="font-semibold hover:text-brand-600">
                              {f.lead.name || f.lead.phone}
                            </Link>
                            <StageBadge stage={f.lead.stage} />
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{f.note || `${f.type.toLowerCase()} follow-up`}</p>
                          <p className={cn('mt-1 flex items-center gap-1 text-xs', overdue ? 'font-semibold text-rose-600' : 'text-subtle')}>
                            <Clock className="size-3" /> {formatDate(f.dueAt, { dateStyle: 'medium', timeStyle: 'short' })}
                            {admin && f.assignedTo && (
                              <span className="ml-2 inline-flex items-center gap-1">
                                <Avatar name={f.assignedTo.name} size={16} /> {f.assignedTo.name}
                              </span>
                            )}
                          </p>
                        </div>
                        {f.status === 'PENDING' && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button size="icon-sm" variant="ghost" href={`tel:${f.lead.phone}`} aria-label="Call">
                              <Phone className="size-4" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" href={leadInboxUrl(f.lead.id)} aria-label="WhatsApp">
                              <MessageCircle className="size-4 text-emerald-600" />
                            </Button>
                            <Button size="xs" variant="secondary" href={leadInboxUrl(f.lead.id, 'SMS')} aria-label="SMS">
                              SMS
                            </Button>
                            <Button size="xs" variant="secondary" href={leadInboxUrl(f.lead.id, 'EMAIL')}>
                              Email
                            </Button>
                            <Select
                              className="h-8 w-28 rounded-lg text-xs"
                              value=""
                              onChange={(e) => e.target.value && snooze(f, e.target.value === 'tomorrow' ? 'tomorrow' : Number(e.target.value))}
                            >
                              <option value="">Snooze…</option>
                              <option value={3600_000}>1 घंटा</option>
                              <option value={3 * 3600_000}>3 घंटे</option>
                              <option value="tomorrow">कल 10 बजे</option>
                              <option value={3 * 86400_000}>3 दिन</option>
                            </Select>
                            <Button size="xs" variant="success" onClick={() => (setDone(f), setOutcome(''))}>
                              <Check className="size-3.5" /> Done
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => update.mutate({ id: f.id, status: 'MISSED' })}
                              aria-label="Missed"
                              title="Missed"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        )}
                        {f.status !== 'PENDING' && (
                          <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate(f.id)} aria-label="Delete">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {!invalidDates && q.data && (
        <div className="my-5 flex items-center justify-between gap-3 text-sm">
          <p>
            {q.data.total} matching follow-ups · Page {page} / {Math.max(1, q.data.totalPages)}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={page >= q.data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!done}
        onOpenChange={(v) => !v && setDone(null)}
        title="Follow-up पूरा हुआ"
        description={done ? `${done.lead.name || done.lead.phone} — क्या बात हुई? (timeline में save होगा)` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDone(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              loading={update.isPending}
              onClick={() => update.mutate({ id: done.id, status: 'DONE', outcomeNote: outcome || undefined }, { onSuccess: () => setDone(null) })}
            >
              <Check className="size-4" /> Save
            </Button>
          </>
        }
      >
        <Textarea autoFocus value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="जैसे: Sunday को visit के लिए तैयार, budget 1.5 Cr तक" />
      </Dialog>
      <AddFollowUp open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function AddFollowUp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [lead, setLead] = useState<any>(null);
  const [type, setType] = useState<string>('CALL');
  const [dueAt, setDueAt] = useState(() => toLocalInput(new Date(Date.now() + 3600_000)));
  const [note, setNote] = useState('');
  const create = useApiMutation(() => post('/follow-ups', { leadId: lead.id, type, dueAt: new Date(dueAt).toISOString(), note: note || null }), {
    success: 'Follow-up scheduled',
    invalidate: [['follow-ups'], ['broker-dashboard']],
    onSuccess: () => {
      onOpenChange(false);
      setLead(null);
      setNote('');
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="नया follow-up"
      footer={
        <Button disabled={!lead} loading={create.isPending} onClick={() => create.mutate(undefined)}>
          <AlarmClock className="size-4" /> Schedule
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Lead" required>
          <LeadPicker value={lead} onChange={setLead} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.keys(FollowUpType).map((t) => (
                <option key={t} value={t}>
                  {t[0] + t.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="कब" required>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="क्या बात करनी है…" />
        </Field>
      </div>
    </Dialog>
  );
}
