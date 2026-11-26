'use client';
import { leadDialUrl } from '@brokeriq/shared';
import { useFlag, useConfig } from '@/lib/config';
import { BackLink } from '@/components/ui/back-button';
import { ConnectLeadActivity } from '@/components/panel/connect-profile';
import { hasPreviousPage, pushRouteView, useGoBack, useRouteState } from '@/lib/navigation';
import { submitTask } from '@/lib/task-submissions';
import { leadInboxUrl, openLeadInbox } from '@/lib/inbox-composer';
import { VisitItinerary } from '@/components/broker/visit-itinerary';
import { VisitShortlist } from '@/components/broker/visit-shortlist';
import Link from 'next/link';
import { Fragment, use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bot,
  CalendarCheck,
  CalendarPlus,
  Check,
  Handshake,
  Headphones,
  Home,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Send,
  Share2,
  Sparkles,
  StickyNote,
  Trash2,
  Zap,
  FileBarChart,
} from 'lucide-react';
import {
  FURNISHING_LABELS,
  leadContactChanges,
  leadContactDraft,
  type LeadContactInput,
  futureConnectDate,
  type ConnectActionDraft,
  LEAD_STAGES,
  visitShortlistedIds,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  PROPERTY_TYPE_LABELS,
  VISIT_STATUS_LABELS,
  formatINR,
  formatPriceShort,
  timeAgo,
  RENTABLE_TYPES,
  moduleAllowed,
  type LocalityListItem,
} from '@brokeriq/shared';
import { api, apiBlob, ApiError, errorMessage } from '@/lib/api';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDateTime, img, toLocalInput } from '@/lib/utils';
import { SourceBadge, TempBadge, useAssignees } from '@/components/broker/bits';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Badge, Empty, PageLoader } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ComparisonDialog } from '@/components/broker/growth-tools';
import { ApiErrorState, IntegrationBanner } from '@/components/ui/api-error';
import { VideoJoin } from '@/components/site/video-join';
import { LeadRequirements } from '@/components/broker/launch/lead-requirements';

const ACT_ICON: Record<string, any> = {
  NOTE: StickyNote,
  CALL: PhoneCall,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  STAGE_CHANGE: Zap,
  ASSIGNMENT: Avatar,
  SITE_VISIT: CalendarCheck,
  FOLLOW_UP: CalendarPlus,
  PROPERTY_SHARED: Share2,
  ENQUIRY: Send,
  AUTOMATION: Bot,
  SYSTEM: Sparkles,
};

export default function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const config = useConfig();
  const allowed = (key: string) =>
    moduleAllowed(config.modules, key, user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '')) && hasDelegatedAccess(user, key, 'view');
  const router = useRouter();
  const qc = useQueryClient();
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const canAssign = user?.role === 'BROKER_ADMIN' || (delegated && hasDelegatedAccess(user, 'leads', 'assign'));
  const canDelete = user?.role === 'BROKER_ADMIN' || (delegated && hasDelegatedAccess(user, 'leads', 'view', 'delete'));
  const canEditContact = user?.role === 'BROKER_ADMIN' || (delegated && hasDelegatedAccess(user, 'leads', 'view', 'edit'));
  const canEdit = hasDelegatedAccess(user, 'leads', 'edit');
  const canCreateTask = hasDelegatedAccess(user, 'leads', 'create');
  const canSharePhotos = allowed('inventory') && allowed('inbox') && hasDelegatedAccess(user, 'inbox', 'edit', 'send');
  const team = useAssignees();
  const q = useQuery({ queryKey: ['lead', id], queryFn: () => api<any>(`/leads/${id}`) });
  const query = useSearchParams();
  const entryTab = query.get('tab');
  const [tab, setTab] = useRouteState<'timeline' | 'shortlist' | 'matches' | 'tasks' | 'requirement'>('detail.tab',
    entryTab === 'shortlist' || entryTab === 'tasks' || entryTab === 'requirement' ? entryTab : 'timeline',
  );
  const [editingContact, setEditingContact] = useRouteState('detail.editContact', false);
  const returnToLead = useGoBack(`/broker/leads/${id}`, { samePath: true });
  function closeContactEditor() {
    if (hasPreviousPage({ samePath: true })) returnToLead();
    else setEditingContact(false);
  }
  const [advanceFollowUpStage, setAdvanceFollowUpStage] = useState(false);
  const [connectDraft, setConnectDraft] = useState<{ note: string; at: Date | null; revision: number } | null>(null);
  function draftConnectAction(action: ConnectActionDraft) {
    const at = futureConnectDate(action.at);
    if (action.kind === 'SITE_VISIT') {
      const params = new URLSearchParams({ lead: id });
      if (at) params.set('when', at.toISOString());
      router.push('/broker/visits/new?' + params.toString());
      return;
    }
    setAdvanceFollowUpStage(false);
    setConnectDraft((prior) => ({ note: action.note, at, revision: (prior?.revision ?? 0) + 1 }));
    setTab('tasks');
  }
  const openFollowUpStage = () => {
    setAdvanceFollowUpStage(canEdit);
    setTab('tasks');
  };
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [notInterestedOpen, setNotInterestedOpen] = useState(false);
  const [notInterestedReason, setNotInterestedReason] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lead', id] });
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
    qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
    qc.invalidateQueries({ queryKey: ['agent-assignments'] });
    qc.invalidateQueries({ queryKey: ['agent-assignment-records'] });
  };
  const stage = useApiMutation((b: { stage: string; lostReason?: string }) => patch(`/leads/${id}/stage`, b), { onSuccess: refresh });
  const assign = useApiMutation((assignedToId: string | null) => patch(`/leads/${id}/assign`, { assignedToId }), { success: 'Assigned', onSuccess: refresh });
  const acceptAssignment = useApiMutation((assignmentId: string | null) => post(`/leads/${id}/assignment/accept`, { assignmentId }), {
    success: 'Lead accepted',
    onSuccess: refresh,
  });
  const declineAssignment = useApiMutation((assignmentId: string | null) => post(`/leads/${id}/assignment/decline`, { assignmentId }), {
    success: 'Lead declined',
    onSuccess: () => {
      if (hasPreviousPage()) router.back();
      else router.replace('/broker/leads');
      refresh();
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const remove = useApiMutation(() => del(`/leads/${id}`), {
    success: 'Lead deleted',
    invalidate: [['leads'], ['kanban'], ['broker-dashboard'], ['agent-assignments'], ['agent-assignment-records']],
    onSuccess: () => {
      if (hasPreviousPage()) router.back();
      else router.replace('/broker/leads');
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.error) return <ApiErrorState error={q.error} />;
  const l = q.data;
  const stageIdx = LEAD_STAGES.indexOf(l.stage);

  return (
    <div className="space-y-6">
      <BackLink href="/broker/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Leads
      </BackLink>

      {!!l.assignedTo && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">{l.assignmentAcceptedAt ? `Accepted by ${l.assignedTo.name}` : `Awaiting acceptance from ${l.assignedTo.name}`}</p>
          {l.assignedTo.id === user?.id && !l.assignmentAcceptedAt && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={declineAssignment.isPending}
                loading={acceptAssignment.isPending}
                onClick={() => acceptAssignment.mutate(l.assignmentId ?? null)}
              >
                Accept assigned lead
              </Button>
              <Button
                variant="secondary"
                disabled={acceptAssignment.isPending}
                loading={declineAssignment.isPending}
                onClick={() => {
                  if (window.confirm('Decline this lead and return it to the broker for reassignment?')) declineAssignment.mutate(l.assignmentId ?? null);
                }}
              >
                Decline lead
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-6 xl:flex-row xl:items-center">
          <Avatar name={l.name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold">{l.name}</h1>
              <TempBadge t={l.temperature} />
              {l.scoredAt && (
                <span title={(l.scoreReasons ?? []).join(' · ')}>
                  <Badge tone="brand">Score {l.score}</Badge>
                </span>
              )}
              {l.repeatCount > 0 && <Badge tone="info">{l.repeatCount + 1}× enquired</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-semibold text-fg">{l.phone}</span>
              {l.reference && <span className="font-mono text-xs">{l.reference}</span>}
              {l.email && <span>{l.email}</span>}
              <SourceBadge source={l.source} />
              {l.sourceDetail && <span className="text-xs">{l.sourceDetail}</span>}
              <span className="text-xs">· {timeAgo(l.createdAt)}</span>
            </p>
            {canEditContact && (
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => {
                if (!pushRouteView({ 'detail.editContact': true })) setEditingContact(true);
              }}>
                <Pencil className="size-4" /> Edit lead
              </Button>
            )}
            {l.scoreReasons?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Score के कारण">
                {l.scoreReasons.map((r: string) => (
                  <span key={r} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href={leadDialUrl(l.phone)} disabled={!leadDialUrl(l.phone)} onClick={() => setTimeout(() => setTab('timeline'), 300)}>
              <Phone className="size-4" /> Call
            </Button>
            {allowed('legacy') && <ClickToCall leadId={l.id} onDone={refresh} />}
            <>
              <Button access={hasDelegatedAccess(user, 'inbox', 'view', 'edit')} variant="whatsapp" href={leadInboxUrl(l.id)}>
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
              <Button
                access={hasDelegatedAccess(user, 'inbox', 'view', 'edit')}
                size="xs"
                variant="secondary"
                href={leadInboxUrl(l.id, 'SMS')}
                aria-label="SMS"
              >
                SMS
              </Button>
              <Button access={hasDelegatedAccess(user, 'inbox', 'view', 'edit')} size="xs" variant="secondary" href={leadInboxUrl(l.id, 'EMAIL')}>
                Email
              </Button>
            </>
            <Select disabled={!canAssign} className="h-11 w-44" value={l.assignedTo?.id ?? ''} onChange={(e) => assign.mutate(e.target.value || null)}>
              <option value="">Unassigned</option>
              {team.data?.members
                .filter((m: any) => !m.status || m.status === 'ACTIVE')
                .map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </div>
        </div>
        {/* Stage stepper */}
        <div role="group" aria-label="Lead progress" className="flex overflow-x-auto border-t border-line scrollbar-none">
          {LEAD_STAGES.map((s, i) => {
            const active = s === l.stage;
            const past = i < stageIdx && s !== 'NOT_INTERESTED' && l.stage !== 'LOST' && l.stage !== 'NOT_INTERESTED';
            return (
              <Fragment key={s}>
                {s === 'SITE_VISIT' && (
                  <Link
                    href={`/broker/leads/${l.id}/photos`}
                    aria-disabled={!canSharePhotos || undefined}
                    onClick={(event) => {
                      if (!canSharePhotos) {
                        event.preventDefault();
                        toast.info('Ask your Broker Admin for permission to share photos.');
                      }
                    }}
                    className="flex min-w-28 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-bold text-brand-600 transition hover:bg-surface-2"
                  >
                    <Share2 className="size-3.5 shrink-0" /> Share photos
                  </Link>
                )}
                <button
                  aria-pressed={active}
                  disabled={
                    (!canEdit && s !== 'SHORTLISTED') || stage.isPending || (s === 'FOLLOW_UP' && !canCreateTask) || (s === 'PHOTOS_SHARED' && !canSharePhotos)
                  }
                  onClick={() => {
                    if (s === 'FOLLOW_UP') openFollowUpStage();
                    else if (s === 'PHOTOS_SHARED') router.push(`/broker/leads/${l.id}/photos`);
                    else if (s === 'SHORTLISTED') setTab('shortlist');
                    else if (s === 'SITE_VISIT' && canCreateTask) router.push(`/broker/visits/new?lead=${encodeURIComponent(l.id)}`);
                    else if (s === 'LOST') setLostOpen(true);
                    else if (s === 'NOT_INTERESTED') setNotInterestedOpen(true);
                    else stage.mutate({ stage: s });
                  }}
                  className={cn(
                    'relative flex min-w-28 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-bold transition',
                    active ? 'text-white' : past ? 'text-fg' : 'text-subtle hover:bg-surface-2',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="stage-bg"
                      className="absolute inset-0"
                      style={{ background: LEAD_STAGE_COLORS[s] }}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {past && <Check className="size-3.5" style={{ color: LEAD_STAGE_COLORS[s] }} />}
                    {LEAD_STAGE_LABELS[s]}
                  </span>
                </button>
                {s === 'FOLLOW_UP' && (
                  <button
                    disabled={!canCreateTask}
                    type="button"
                    aria-controls="lead-tasks"
                    onClick={openFollowUpStage}
                    className="flex min-w-28 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-bold text-brand-600 transition hover:bg-surface-2"
                  >
                    <CalendarPlus className="size-3.5 shrink-0" /> Schedule follow-up
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Segmented
            value={tab}
            onChange={(value) => {
              setAdvanceFollowUpStage(false);
              setTab(value);
            }}
            options={[
              { value: 'timeline', label: 'Timeline' },
              ...(!delegated || allowed('inventory') ? [{ value: 'matches' as const, label: 'Matching properties' }] : []),
              { value: 'tasks', label: 'Follow-ups & visits', count: l.followUps.filter((f: any) => f.status === 'PENDING').length || undefined },
              { value: 'shortlist' as const, label: 'Shortlisted' },
              { value: 'requirement', label: 'Requirement' },
            ]}
          />
          {tab === 'shortlist' && <VisitShortlist visits={l.visits} canEdit={canEdit} onChange={refresh} />}
          {tab === 'timeline' && <Timeline lead={l} onChange={refresh} />}
          {tab === 'matches' && (!delegated || allowed('inventory')) && <LeadRequirements lead={l} />}
          {tab === 'tasks' && (
            <section id="lead-tasks" aria-label="Lead follow-ups and visits">
              <Tasks key={connectDraft?.revision ?? 0} lead={l} onChange={refresh} canCreate={canCreateTask} canEdit={canEdit}
                advanceStage={advanceFollowUpStage} connectDraft={connectDraft} clearConnectDraft={() => setConnectDraft(null)} />
            </section>
          )}
          {tab === 'requirement' && <LeadRequirements lead={l} />}
        </div>
        <div className="space-y-4">
          {allowed('assistant') && <AiCard lead={l} onChange={refresh} />}
          {allowed('legacy') && <CallsCard leadId={l.id} />}
          {config.flags.connect_enabled && allowed('automation') && <ConnectLeadActivity leadId={l.id} enabled draftAction={canCreateTask ? draftConnectAction : undefined} />}
          {allowed('deals') && <DealsCard lead={l} onChange={refresh} />}
          <div className="card space-y-3 p-5 text-sm">
            <h3 className="font-display font-bold">Details</h3>
            <Row k="Owner" v={l.assignedTo?.name ?? 'Unassigned'} />
            <Row k="Created" v={formatDateTime(l.createdAt)} />
            <Row k="Last activity" v={l.lastActivityAt ? timeAgo(l.lastActivityAt) : '—'} />
            {l.listing && (
              <Row
                k="Enquired on"
                v={
                  <Link className="text-brand-600" href={`/property/${l.listing.slug}`}>
                    {l.listing.title}
                  </Link>
                }
              />
            )}
            {l.notes && <p className="rounded-xl bg-surface-2 p-3 text-xs whitespace-pre-line">{l.notes}</p>}
            <TagEditor access={canEdit} lead={l} onChange={refresh} />
            <Button
              access={canDelete}
              variant="ghost"
              size="sm"
              className="text-rose-600"
              onClick={() => confirm('यह lead delete करें?') && remove.mutate(undefined)}
            >
              <Trash2 className="size-4" /> Delete lead
            </Button>
          </div>
        </div>
      </div>

      {canEditContact && editingContact && (
        <EditLeadContact lead={l} onClose={closeContactEditor} onSave={refresh} />
      )}
      <Dialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        title="Lead lost mark करें"
        footer={
          <Button variant="danger" onClick={() => (stage.mutate({ stage: 'LOST', lostReason }), setLostOpen(false))}>
            Mark lost
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {['Budget mismatch', 'Bought elsewhere', 'Not responding', 'Location mismatch', 'Just browsing', 'Fake enquiry'].map((r) => (
            <Chip key={r} active={lostReason === r} onClick={() => setLostReason(r)}>
              {r}
            </Chip>
          ))}
        </div>
        <Input className="mt-3" placeholder="या अपना कारण लिखें" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
      </Dialog>

      <Dialog
        open={notInterestedOpen}
        onOpenChange={setNotInterestedOpen}
        title="Lead 'Not interested' mark करें"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => (stage.mutate({ stage: 'NOT_INTERESTED' }), setNotInterestedOpen(false))}>
              Skip reason
            </Button>
            <Button
              variant="secondary"
              onClick={() => (stage.mutate({ stage: 'NOT_INTERESTED', lostReason: notInterestedReason }), setNotInterestedOpen(false))}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {['Budget mismatch', 'Location mismatch', 'Plan postponed', 'Exploring later', 'Looking for different BHK', 'Not looking anymore'].map((r) => (
            <Chip key={r} active={notInterestedReason === r} onClick={() => setNotInterestedReason(r)}>
              {r}
            </Chip>
          ))}
        </div>
        <Input className="mt-3" placeholder="या कोई अन्य कारण लिखें" value={notInterestedReason} onChange={(e) => setNotInterestedReason(e.target.value)} />
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Timeline({ lead, onChange }: { lead: any; onChange: () => void }) {
  const [type, setType] = useState<'NOTE' | 'CALL' | 'WHATSAPP'>('NOTE');
  const [content, setContent] = useState('');
  const [outcome, setOutcome] = useState('CONNECTED');
  const [waError, setWaError] = useState<ApiError | null>(null);
  const add = useApiMutation(() => post(`/leads/${lead.id}/activities`, { type, content, callOutcome: type === 'CALL' ? outcome : null }), {
    onSuccess: () => (setContent(''), onChange()),
  });
  const sendWa = async () => {
    setWaError(null);
    try {
      await post('/whatsapp/send', { leadId: lead.id, text: content });
      toast.success('WhatsApp भेजा गया ✓');
      setContent('');
      onChange();
    } catch (e) {
      if (e instanceof ApiError && e.isNotConfigured) setWaError(e);
      else toast.error(errorMessage(e));
    }
  };
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-2">
          {(
            [
              ['NOTE', 'Note', StickyNote],
              ['CALL', 'Log call', PhoneCall],
              ['WHATSAPP', 'Send WhatsApp', MessageCircle],
            ] as const
          ).map(([v, l, I]) => (
            <Chip key={v} active={type === v} onClick={() => setType(v)}>
              <I className="size-4" /> {l}
            </Chip>
          ))}
        </div>
        {type === 'CALL' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {['CONNECTED', 'NO_ANSWER', 'BUSY', 'SWITCHED_OFF', 'CALLBACK', 'WRONG_NUMBER'].map((o) => (
              <Chip key={o} active={outcome === o} onClick={() => setOutcome(o)}>
                {o.replace('_', ' ').toLowerCase()}
              </Chip>
            ))}
          </div>
        )}
        <Textarea
          className="mt-3"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === 'WHATSAPP' ? 'Message लिखें… (आपके connected WhatsApp number से जाएगा)' : type === 'CALL' ? 'Call में क्या बात हुई?' : 'Note लिखें…'
          }
        />
        {waError?.body.integration && (
          <div className="mt-3 space-y-2">
            <IntegrationBanner compact name={waError.body.integration.name} message={waError.body.message} href={waError.body.integration.settingsPath} />
            <Button size="sm" variant="whatsapp" onClick={() => openLeadInbox(lead.id, content)}>
              Inbox में draft खोलें
            </Button>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          {type === 'WHATSAPP' ? (
            <Button variant="whatsapp" onClick={sendWa} disabled={!content.trim()}>
              <Send className="size-4" /> भेजें
            </Button>
          ) : (
            <Button onClick={() => add.mutate(undefined)} loading={add.isPending} disabled={type === 'NOTE' && !content.trim()}>
              Save
            </Button>
          )}
        </div>
      </div>
      <div className="relative space-y-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line">
        {lead.activities.map((a: any) => {
          const Icon = ACT_ICON[a.type] ?? Sparkles;
          return (
            <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="relative">
              <span className="absolute top-1 -left-6 grid size-6 place-items-center rounded-full border-2 border-surface bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {Icon === Avatar ? <Zap className="size-3" /> : <Icon className="size-3" />}
              </span>
              <div className="card p-3.5">
                <p className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="font-semibold text-fg">
                    {a.type.replace('_', ' ')}
                    {a.callOutcome ? ` · ${a.callOutcome.replace('_', ' ').toLowerCase()}` : ''}
                  </span>
                  <span>
                    {a.user?.name ?? 'System'} · {timeAgo(a.createdAt)}
                  </span>
                </p>
                {a.content && <p className="mt-1 text-sm whitespace-pre-line">{a.content}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Matches({ lead }: { lead: any }) {
  const [scope, setScope] = useState<'org' | 'all'>('org');
  const coBrokingOn = useFlag('cobroking');
  const q = useQuery({ queryKey: ['matches', lead.id, scope], queryFn: () => api<any[]>(`/leads/${lead.id}/matches?scope=${scope}`) });
  const share = async (listingId: string) => {
    try {
      const r = await post<any>(`/leads/${lead.id}/share`, { listingId });
      openLeadInbox(lead.id, r.text);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const coBroke = async (listingId: string) => {
    try {
      await post('/cobroking/requests', { listingId, leadId: lead.id });
      toast.success('Co-broke request भेजी — listing firm के accept करने पर contact मिलेगा');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'org', label: 'मेरी inventory' },
            { value: 'all', label: 'पूरा marketplace' },
          ]}
        />
        {!lead.requirement && <span className="text-xs text-amber-600">Requirement भरें तो matching बेहतर होगी</span>}
        <CompareButton lead={lead} />
      </div>
      {!q.data?.length ? (
        <Empty icon={<Home className="size-6" />} title="कोई matching property नहीं" text="Requirement बदलें या marketplace में देखें।" />
      ) : (
        q.data.map((m) => (
          <div key={m.id} className="card flex items-center gap-4 p-3">
            <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              {m.coverUrl && <img src={img(m.coverUrl, 240)} alt="" className="h-full w-full object-cover" />}
              <span className="absolute top-1 left-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{m.matchScore}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/property/${m.slug}`} target="_blank" className="line-clamp-1 font-semibold hover:text-brand-600">
                {m.title}
              </Link>
              <p className="text-sm font-bold">
                {formatPriceShort(m.price)}
                {m.purpose === 'RENT' ? '/mo' : ''}
              </p>
              <p className="text-xs text-muted">
                {m.locality.name}
                {m.organization && m.organization.id !== lead.organizationId ? ` · ${m.organization.name}` : ''}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="whatsapp" onClick={() => share(m.id)}>
                <Share2 className="size-4" /> Share
              </Button>
              {coBrokingOn && m.coBroking && m.organization && m.organization.id !== lead.organizationId && (
                <Button size="xs" variant="secondary" onClick={() => coBroke(m.id)}>
                  <Handshake className="size-3.5" /> Co-broke
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Tasks({
  lead,
  onChange,
  canCreate,
  canEdit,
  advanceStage,
  connectDraft,
  clearConnectDraft,
}: {
  lead: any;
  onChange: () => void;
  canCreate: boolean;
  canEdit: boolean;
  advanceStage: boolean;
  connectDraft: { note: string; at: Date | null } | null;
  clearConnectDraft: () => void;
}) {
  const [fu, setFu] = useState(() => ({ type: 'CALL',
    dueAt: connectDraft ? (connectDraft.at ? toLocalInput(connectDraft.at) : '') : toLocalInput(new Date(Date.now() + 2 * 3600_000)),
    note: connectDraft?.note ?? '',
  }));
  const addFu = useApiMutation(
    (retry?: boolean) => {
      if (retry) return submitTask('/follow-ups', lead.id);
      const payload = {
        leadId: lead.id,
        type: fu.type,
        dueAt: new Date(fu.dueAt).toISOString(),
        note: fu.note || null,
        ...(advanceStage ? { advanceStage: true } : {}),
      };
      return submitTask('/follow-ups', lead.id, payload);
    },
    {
      success: 'Follow-up scheduled ⏰',
      onSuccess: () => {
        setFu({ ...fu, note: '' });
        if (connectDraft) clearConnectDraft();
        onChange();
      },
    },
  );
  const doneFu = useApiMutation((id: string) => patch(`/follow-ups/${id}`, { status: 'DONE' }), { onSuccess: onChange });
  const visitSt = useApiMutation((v: { id: string; status: string }) => patch(`/visits/${v.id}`, { status: v.status }), { onSuccess: onChange });
  const quick = (h: number) => setFu({ ...fu, dueAt: toLocalInput(new Date(Date.now() + h * 3600_000)) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-display font-bold">
          <CalendarPlus className="size-5 text-brand-600" /> Follow-up
        </h3>
        <>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['1 घंटा', 1],
              ['4 घंटे', 4],
              ['कल', 20],
              ['3 दिन', 72],
            ].map(([l, h]) => (
              <Chip key={l as string} onClick={() => quick(h as number)}>
                {l}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select disabled={!canCreate} value={fu.type} onChange={(e) => setFu({ ...fu, type: e.target.value })}>
              {['CALL', 'WHATSAPP', 'MEETING', 'EMAIL', 'SMS', 'OTHER'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Input disabled={!canCreate} type="datetime-local" value={fu.dueAt} onChange={(e) => setFu({ ...fu, dueAt: e.target.value })} />
          </div>
          <Input disabled={!canCreate} placeholder="Note" value={fu.note} onChange={(e) => setFu({ ...fu, note: e.target.value })} />
          <Button access={canCreate} disabled={!fu.dueAt} onClick={() => addFu.mutate(undefined)} loading={addFu.isPending}>
            Schedule
          </Button>
          <Button access={canCreate} variant="secondary" className="ml-2" disabled={addFu.isPending} onClick={() => addFu.mutate(true)}>
            Retry saved
          </Button>
        </>
        <div className="space-y-2 pt-2">
          {lead.followUps.map((f: any) => (
            <div key={f.id} className={cn('flex items-center gap-2 rounded-xl border border-line p-2.5 text-sm', f.status !== 'PENDING' && 'opacity-60')}>
              <button
                disabled={!canEdit || f.status !== 'PENDING'}
                onClick={() => doneFu.mutate(f.id)}
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border-2',
                  f.status === 'DONE' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line hover:border-emerald-500',
                )}
                aria-label="Mark done"
              >
                {f.status === 'DONE' && <Check className="size-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('font-medium', f.status === 'DONE' && 'line-through')}>
                  {f.type} · {formatDateTime(f.dueAt)}
                </p>
                {f.note && <p className="truncate text-xs text-muted">{f.note}</p>}
              </div>
              {f.status === 'PENDING' && new Date(f.dueAt) < new Date() && <Badge tone="danger">Overdue</Badge>}
            </div>
          ))}
        </div>
      </div>
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-display font-bold">
          <CalendarCheck className="size-5 text-brand-600" /> Site visit
        </h3>
        <Button access={canCreate} href={`/broker/visits/new?lead=${encodeURIComponent(lead.id)}`}>
          Schedule visit
        </Button>
        <div className="space-y-2 pt-2">
          {lead.visits.map((v: any) => (
            <div key={v.id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{formatDateTime(v.scheduledAt)}</p>
                <Badge tone={v.status === 'COMPLETED' ? 'success' : v.status === 'CANCELLED' || v.status === 'NO_SHOW' ? 'danger' : 'info'}>
                  {VISIT_STATUS_LABELS[v.status as keyof typeof VISIT_STATUS_LABELS]}
                </Badge>
              </div>
              <p className="text-xs text-muted">
                {visitShortlistedIds(v.propertySnapshot).length ? null : v.propertySnapshot?.title || v.listing?.title || v.address}
              </p>
              <VisitItinerary snapshot={v.propertySnapshot} remainingOnly />
              {['SCHEDULED', 'CONFIRMED'].includes(v.status) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <VideoJoin visit={v} size="xs" />
                  <>
                    <Button
                      access={canEdit}
                      size="xs"
                      variant="success"
                      disabled={visitSt.isPending}
                      onClick={() => visitSt.mutate({ id: v.id, status: 'COMPLETED' })}
                    >
                      Done
                    </Button>
                    <Button access={canEdit} size="xs" variant="secondary" onClick={() => visitSt.mutate({ id: v.id, status: 'NO_SHOW' })}>
                      No-show
                    </Button>
                    <Button access={canEdit} size="xs" variant="ghost" onClick={() => visitSt.mutate({ id: v.id, status: 'CANCELLED' })}>
                      Cancel
                    </Button>
                  </>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditLeadContact({ lead, onClose, onSave }: {
  lead: LeadContactInput & { id: string }; onClose: () => void; onSave: () => void;
}) {
  const [original] = useState(() => leadContactDraft(lead));
  const [draft, setDraft] = useState(original);
  const changes = leadContactChanges(original, draft);
  const changed = changes.success && Object.keys(changes.data).length > 0;
  const save = useApiMutation((value: LeadContactInput) => patch(`/leads/${lead.id}`, value), {
    success: 'Lead updated', onSuccess: onSave,
  });
  return (
    <Dialog open title="Edit lead" onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (changed) save.mutate(changes.data, { onSuccess: onClose });
      }}>
        <Field label="Name"><Input maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
        <Field label="Phone"><Input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
        <Field label="Alternate phone"><Input type="tel" value={draft.alternatePhone} onChange={(event) => setDraft({ ...draft, alternatePhone: event.target.value })} /></Field>
        <Field label="Email"><Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
        <Field label="Notes"><Textarea maxLength={4000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
        {!changes.success && <p className="text-sm text-rose-600" role="status">{changes.error.issues[0]?.message}</p>}
        <Button type="submit" loading={save.isPending} disabled={!changed}>Save changes</Button>
      </form>
    </Dialog>
  );
}

function Requirement({ lead, onChange }: { lead: any; onChange: () => void }) {
  const r = lead.requirement ?? {};
  const { data: locs } = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }),
    staleTime: 600_000,
  });
  const [f, setF] = useState({
    purpose: r.purpose ?? 'RENT',
    propertyTypes: r.propertyTypes ?? [],
    localityIds: r.localityIds ?? [],
    minBudget: r.minBudget ?? '',
    maxBudget: r.maxBudget ?? '',
    bedrooms: r.bedrooms ?? [],
    furnishing: r.furnishing ?? '',
    notes: r.notes ?? '',
  });
  const save = useApiMutation(
    () =>
      patch(`/leads/${lead.id}`, {
        requirement: {
          ...f,
          minBudget: f.minBudget ? Number(f.minBudget) : null,
          maxBudget: f.maxBudget ? Number(f.maxBudget) : null,
          furnishing: f.furnishing || null,
        },
      }),
    { success: 'Requirement saved', onSuccess: onChange },
  );
  const t = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap gap-2">
        {Object.entries(PROPERTY_TYPE_LABELS)
          .filter(([k]) => RENTABLE_TYPES.includes(k as any))
          .slice(0, 10)
          .map(([k, v]) => (
            <Chip key={k} active={f.propertyTypes.includes(k)} onClick={() => setF({ ...f, propertyTypes: t(f.propertyTypes, k) })}>
              {v}
            </Chip>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((b) => (
          <Chip key={b} active={f.bedrooms.includes(b)} onClick={() => setF({ ...f, bedrooms: t(f.bedrooms, b) })}>
            {b} BHK
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min budget" hint={f.minBudget ? formatPriceShort(Number(f.minBudget)) : undefined}>
          <Input inputMode="numeric" value={f.minBudget} onChange={(e) => setF({ ...f, minBudget: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Max budget" hint={f.maxBudget ? formatPriceShort(Number(f.maxBudget)) : undefined}>
          <Input inputMode="numeric" value={f.maxBudget} onChange={(e) => setF({ ...f, maxBudget: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </div>
      <Select value={f.furnishing} onChange={(e) => setF({ ...f, furnishing: e.target.value })}>
        <option value="">Any furnishing</option>
        {Object.entries(FURNISHING_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
      <Select value="" onChange={(e) => e.target.value && setF({ ...f, localityIds: t(f.localityIds, e.target.value) })}>
        <option value="">+ Locality जोड़ें</option>
        {locs?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap gap-1.5">
        {f.localityIds.map((id: string) => (
          <Chip key={id} active onClick={() => setF({ ...f, localityIds: t(f.localityIds, id) })}>
            {locs?.find((l) => l.id === id)?.name ?? '…'} ✕
          </Chip>
        ))}
      </div>
      <Textarea placeholder="और details" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
        Save requirement
      </Button>
    </div>
  );
}

function AiCard({ lead, onChange }: { lead: any; onChange: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      setData(await post(`/leads/${lead.id}/ai`));
      onChange();
    } catch (e) {
      if (e instanceof ApiError) setErr(e);
      else toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const summary = data?.summary ?? lead.aiSummary;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-brand-600 p-4 text-white">
        <p className="flex items-center gap-2 font-display font-bold">
          <Sparkles className="size-5" /> AI insights
        </p>
        <Button size="xs" variant="secondary" className="border-white/30 bg-white/15 text-white hover:bg-white/25" onClick={run} loading={loading}>
          {summary ? 'Refresh' : 'Analyse'}
        </Button>
      </div>
      <div className="space-y-3 p-4 text-sm">
        {err?.isNotConfigured && err.body.integration ? (
          <IntegrationBanner compact name={err.body.integration.name} message={err.body.message} />
        ) : err ? (
          <p className="text-rose-600">{err.body.message}</p>
        ) : null}
        {summary ? (
          <p className="whitespace-pre-line">{summary}</p>
        ) : (
          !err && <p className="text-muted">AI से इस lead का summary, intent score और अगला best step पाएँ।</p>
        )}
        {data?.nextAction && (
          <p className="rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
            <b>Next:</b> {data.nextAction}
          </p>
        )}
        {data?.suggestedReply && (
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs font-bold text-muted">Suggested WhatsApp reply</p>
            <p className="mt-1">{data.suggestedReply}</p>
            <Button size="xs" variant="whatsapp" className="mt-2" onClick={() => openLeadInbox(lead.id, data.suggestedReply)}>
              Use
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DealsCard({ lead, onChange }: { lead: any; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: lead.listing?.title ?? `${lead.name} deal`, dealValue: '', commissionPct: '1', closed: true });
  const m = useApiMutation(
    () =>
      post('/deals', {
        leadId: lead.id,
        listingId: lead.listing?.id ?? null,
        title: f.title,
        dealValue: Number(f.dealValue),
        commissionPct: Number(f.commissionPct),
        closedAt: f.closed ? new Date().toISOString() : null,
      }),
    { success: '🎉 Deal saved!', onSuccess: () => (setOpen(false), onChange()) },
  );
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display font-bold">
          <Handshake className="size-5 text-emerald-600" /> Deals
        </h3>
        <Button size="xs" variant="success" onClick={() => setOpen(true)}>
          + Deal
        </Button>
      </div>
      {lead.deals.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Deal close होते ही यहाँ record करें — commission tracking अपने-आप।</p>
      ) : (
        <div className="mt-3 space-y-2">
          {lead.deals.map((d: any) => (
            <div key={d.id} className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="font-semibold">{d.title}</p>
              <p className="text-muted">
                {formatPriceShort(d.dealValue)} · commission {d.commissionAmount ? formatINR(d.commissionAmount) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Deal record करें"
        footer={
          <Button onClick={() => m.mutate(undefined)} loading={m.isPending} disabled={!f.dealValue}>
            Save deal
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal value (₹)" hint={f.dealValue ? formatPriceShort(Number(f.dealValue)) : undefined}>
              <Input inputMode="numeric" value={f.dealValue} onChange={(e) => setF({ ...f, dealValue: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="Commission %" hint={f.dealValue ? formatINR((Number(f.dealValue) * Number(f.commissionPct)) / 100) : undefined}>
              <Input inputMode="decimal" value={f.commissionPct} onChange={(e) => setF({ ...f, commissionPct: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.closed} onChange={(e) => setF({ ...f, closed: e.target.checked })} /> Deal closed (lead को WON mark करें)
          </label>
        </div>
      </Dialog>
    </div>
  );
}

function TagEditor({ access, lead, onChange }: { access: boolean; lead: any; onChange: () => void }) {
  const [t, setT] = useState('');
  const save = useApiMutation((tags: string[]) => patch(`/leads/${lead.id}`, { tags }), { onSuccess: onChange });
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {lead.tags.map((x: string) => (
          <button
            key={x}
            disabled={!access}
            onClick={() => save.mutate(lead.tags.filter((y: string) => y !== x))}
            className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            #{x} ✕
          </button>
        ))}
      </div>
      <form className="mt-2" onSubmit={(e) => (e.preventDefault(), access && t.trim() && save.mutate([...lead.tags, t.trim()]), setT(''))}>
        <Input
          disabled={!access}
          title={!access ? 'Lead edit access required' : undefined}
          className="h-9 text-xs"
          placeholder="+ tag"
          value={t}
          onChange={(e) => setT(e.target.value)}
        />
      </form>
    </div>
  );
}

/** Exotel click-to-call: the agent's phone rings first, then the lead. */
function ClickToCall({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await post(`/leads/${leadId}/call`);
      toast.success('📞 Call लग रही है — पहले आपका phone बजेगा');
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.isNotConfigured)
        toast.error('Click-to-call के लिए Lead connectors में Exotel जोड़ें', {
          action: { label: 'Setup', onClick: () => router.push('/broker/connectors?key=exotel') },
        });
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" onClick={run} loading={busy} title="Exotel से call — recording और duration lead में save होगी">
      <PhoneCall className="size-4" /> Click-to-call
    </Button>
  );
}

function CallsCard({ leadId }: { leadId: string }) {
  const q = useQuery({ queryKey: ['lead-calls', leadId], queryFn: () => api<any[]>(`/leads/${leadId}/calls`), retry: false });
  const [audio, setAudio] = useState<Record<string, string>>({});
  if (!q.data?.length) return null;
  const play = async (id: string) => {
    try {
      const recording = await apiBlob(`/calls/${id}/recording`);
      const url = URL.createObjectURL(recording.type ? recording : new Blob([recording], { type: 'audio/mpeg' }));
      setAudio((a) => ({ ...a, [id]: url }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="card space-y-2 p-5 text-sm">
      <h3 className="font-display font-bold">Calls</h3>
      {q.data.slice(0, 8).map((c) => (
        <div key={c.id} className="space-y-1.5 border-b border-line pb-2 last:border-0">
          <div className="flex items-center justify-between gap-2">
            <span>
              {c.direction === 'inbound' ? '📲 Incoming' : '📞 Outgoing'} · {c.status}
              {c.durationSec ? ` · ${Math.ceil(c.durationSec / 60)} min` : ''}
            </span>
            <span className="text-xs text-muted">{timeAgo(c.startedAt)}</span>
          </div>
          {c.recordingUrl &&
            (audio[c.id] ? (
              <audio controls src={audio[c.id]} className="h-9 w-full" />
            ) : (
              <Button size="xs" variant="ghost" onClick={() => play(c.id)}>
                <Headphones className="size-3.5" /> Recording सुनें
              </Button>
            ))}
        </div>
      ))}
    </div>
  );
}

function CompareButton({ lead }: { lead: { id: string; name: string; phone: string } }) {
  const on = useFlag('comparison_pdf');
  const [open, setOpen] = useState(false);
  if (!on) return null;
  return (
    <>
      <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setOpen(true)}>
        <FileBarChart className="size-4" /> Comparison PDF
      </Button>
      <ComparisonDialog lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}
