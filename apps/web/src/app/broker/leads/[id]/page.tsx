'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  LEAD_STAGES,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  PROPERTY_TYPE_LABELS,
  VISIT_STATUS_LABELS,
  formatINR,
  formatPriceShort,
  timeAgo,
  whatsappLink,
  RENTABLE_TYPES,
} from '@brokeriq/shared';
import { api, ApiError, authStore, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { API_URL, cn, formatDateTime, img, toLocalInput } from '@/lib/utils';
import { SourceBadge, TempBadge, useTeam } from '@/components/broker/bits';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Badge, Empty, PageLoader } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ComparisonDialog } from '@/components/broker/growth-tools';
import { ApiErrorState, IntegrationBanner } from '@/components/ui/api-error';
import { VideoJoin } from '@/components/site/video-join';
import { useFlag } from '@/lib/config';

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
  const router = useRouter();
  const qc = useQueryClient();
  const admin = user?.role === 'BROKER_ADMIN';
  const team = useTeam();
  const q = useQuery({ queryKey: ['lead', id], queryFn: () => api<any>(`/leads/${id}`) });
  const [tab, setTab] = useState<'timeline' | 'matches' | 'tasks' | 'requirement'>('timeline');
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lead', id] });
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
  };
  const stage = useApiMutation((b: { stage: string; lostReason?: string }) => patch(`/leads/${id}/stage`, b), { onSuccess: refresh });
  const assign = useApiMutation((assignedToId: string | null) => patch(`/leads/${id}/assign`, { assignedToId }), { success: 'Assigned', onSuccess: refresh });
  const remove = useApiMutation(() => del(`/leads/${id}`), { success: 'Lead deleted', onSuccess: () => router.push('/broker/leads') });

  if (q.isLoading) return <PageLoader />;
  if (q.error) return <ApiErrorState error={q.error} />;
  const l = q.data;
  const stageIdx = LEAD_STAGES.indexOf(l.stage);

  return (
    <div className="space-y-6">
      <Link href="/broker/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Leads
      </Link>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center">
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
              {l.email && <span>{l.email}</span>}
              <SourceBadge source={l.source} />
              {l.sourceDetail && <span className="text-xs">{l.sourceDetail}</span>}
              <span className="text-xs">· {timeAgo(l.createdAt)}</span>
            </p>
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
            <Button href={`tel:${l.phone}`} onClick={() => setTimeout(() => setTab('timeline'), 300)}>
              <Phone className="size-4" /> Call
            </Button>
            <ClickToCall leadId={l.id} onDone={refresh} />
            <Button variant="whatsapp" href={whatsappLink(l.phone, `नमस्ते ${l.name.split(' ')[0]} जी,`)} external>
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
            {admin && (
              <Select className="h-11 w-44" value={l.assignedTo?.id ?? ''} onChange={(e) => assign.mutate(e.target.value || null)}>
                <option value="">Unassigned</option>
                {team.data?.members
                  .filter((m: any) => m.status === 'ACTIVE')
                  .map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            )}
          </div>
        </div>
        {/* Stage stepper */}
        <div className="flex overflow-x-auto border-t border-line scrollbar-none">
          {LEAD_STAGES.map((s, i) => {
            const active = s === l.stage;
            const past = i < stageIdx && l.stage !== 'LOST';
            return (
              <button
                key={s}
                onClick={() => (s === 'LOST' ? setLostOpen(true) : stage.mutate({ stage: s }))}
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
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'matches', label: 'Matching properties' },
              { value: 'tasks', label: 'Follow-ups & visits', count: l.followUps.filter((f: any) => f.status === 'PENDING').length || undefined },
              { value: 'requirement', label: 'Requirement' },
            ]}
          />
          {tab === 'timeline' && <Timeline lead={l} onChange={refresh} />}
          {tab === 'matches' && <Matches lead={l} />}
          {tab === 'tasks' && <Tasks lead={l} onChange={refresh} />}
          {tab === 'requirement' && <Requirement lead={l} onChange={refresh} />}
        </div>
        <div className="space-y-4">
          <AiCard lead={l} onChange={refresh} />
          <CallsCard leadId={l.id} />
          <DealsCard lead={l} onChange={refresh} />
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
            <TagEditor lead={l} onChange={refresh} />
            {admin && (
              <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => confirm('यह lead delete करें?') && remove.mutate(undefined)}>
                <Trash2 className="size-4" /> Delete lead
              </Button>
            )}
          </div>
        </div>
      </div>

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
            <Button size="sm" variant="whatsapp" href={whatsappLink(lead.phone, content)} external>
              WhatsApp app में खोलें
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
  const share = async (listingId: string, viaApi: boolean) => {
    try {
      const r = await post<any>(`/leads/${lead.id}/share`, { listingId });
      if (viaApi) {
        try {
          await post('/whatsapp/send', { leadId: lead.id, text: r.text });
          toast.success('Property WhatsApp पर भेज दी ✓');
          return;
        } catch (e) {
          if (!(e instanceof ApiError && e.isNotConfigured)) throw e;
        }
      }
      window.open(whatsappLink(lead.phone, r.text), '_blank');
    } catch (e) {
      toast.error(errorMessage(e));
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
              <Button size="sm" variant="whatsapp" onClick={() => share(m.id, true)}>
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

function Tasks({ lead, onChange }: { lead: any; onChange: () => void }) {
  const tomorrow = new Date(Date.now() + 86400_000);
  tomorrow.setHours(11, 0, 0, 0);
  const [fu, setFu] = useState({ type: 'CALL', dueAt: toLocalInput(new Date(Date.now() + 2 * 3600_000)), note: '' });
  const [vi, setVi] = useState({ scheduledAt: toLocalInput(tomorrow), listingId: '', address: '', note: '', mode: 'IN_PERSON' as 'IN_PERSON' | 'VIDEO' });
  const videoOn = useFlag('video_visits');
  const addFu = useApiMutation(() => post('/follow-ups', { leadId: lead.id, type: fu.type, dueAt: new Date(fu.dueAt).toISOString(), note: fu.note || null }), {
    success: 'Follow-up scheduled ⏰',
    onSuccess: () => (setFu({ ...fu, note: '' }), onChange()),
  });
  const doneFu = useApiMutation((id: string) => patch(`/follow-ups/${id}`, { status: 'DONE' }), { onSuccess: onChange });
  const addVisit = useApiMutation(
    () =>
      post('/visits', {
        leadId: lead.id,
        scheduledAt: new Date(vi.scheduledAt).toISOString(),
        listingId: vi.listingId || null,
        address: vi.address || null,
        note: vi.note || null,
        mode: vi.mode,
      }),
    { success: vi.mode === 'VIDEO' ? 'Video visit scheduled 🎥 — link visit पर है' : 'Site visit scheduled 🏠', onSuccess: onChange },
  );
  const visitSt = useApiMutation((v: { id: string; status: string }) => patch(`/visits/${v.id}`, { status: v.status }), { onSuccess: onChange });
  const quick = (h: number) => setFu({ ...fu, dueAt: toLocalInput(new Date(Date.now() + h * 3600_000)) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-display font-bold">
          <CalendarPlus className="size-5 text-brand-600" /> Follow-up
        </h3>
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
          <Select value={fu.type} onChange={(e) => setFu({ ...fu, type: e.target.value })}>
            {['CALL', 'WHATSAPP', 'MEETING', 'EMAIL', 'OTHER'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Input type="datetime-local" value={fu.dueAt} onChange={(e) => setFu({ ...fu, dueAt: e.target.value })} />
        </div>
        <Input placeholder="Note" value={fu.note} onChange={(e) => setFu({ ...fu, note: e.target.value })} />
        <Button onClick={() => addFu.mutate(undefined)} loading={addFu.isPending}>
          Schedule
        </Button>
        <div className="space-y-2 pt-2">
          {lead.followUps.map((f: any) => (
            <div key={f.id} className={cn('flex items-center gap-2 rounded-xl border border-line p-2.5 text-sm', f.status !== 'PENDING' && 'opacity-60')}>
              <button
                onClick={() => f.status === 'PENDING' && doneFu.mutate(f.id)}
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
        {videoOn && (
          <Segmented
            size="sm"
            value={vi.mode}
            onChange={(mode) => setVi({ ...vi, mode })}
            options={[
              { value: 'IN_PERSON', label: 'Property पर' },
              { value: 'VIDEO', label: '🎥 Video call' },
            ]}
          />
        )}
        <Input type="datetime-local" value={vi.scheduledAt} onChange={(e) => setVi({ ...vi, scheduledAt: e.target.value })} />
        {vi.mode === 'IN_PERSON' && (
          <Input placeholder="Address / meeting point" value={vi.address} onChange={(e) => setVi({ ...vi, address: e.target.value })} />
        )}
        <Input placeholder="Note" value={vi.note} onChange={(e) => setVi({ ...vi, note: e.target.value })} />
        <Button onClick={() => addVisit.mutate(undefined)} loading={addVisit.isPending}>
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
              {v.listing && <p className="text-xs text-muted">{v.listing.title}</p>}
              {['SCHEDULED', 'CONFIRMED'].includes(v.status) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <VideoJoin visit={v} size="xs" />
                  <Button size="xs" variant="success" onClick={() => visitSt.mutate({ id: v.id, status: 'COMPLETED' })}>
                    Done
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => visitSt.mutate({ id: v.id, status: 'NO_SHOW' })}>
                    No-show
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => visitSt.mutate({ id: v.id, status: 'CANCELLED' })}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Requirement({ lead, onChange }: { lead: any; onChange: () => void }) {
  const r = lead.requirement ?? {};
  const { data: locs } = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
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
            <Button size="xs" variant="whatsapp" className="mt-2" href={whatsappLink(lead.phone, data.suggestedReply)} external>
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

function TagEditor({ lead, onChange }: { lead: any; onChange: () => void }) {
  const [t, setT] = useState('');
  const save = useApiMutation((tags: string[]) => patch(`/leads/${lead.id}`, { tags }), { onSuccess: onChange });
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {lead.tags.map((x: string) => (
          <button
            key={x}
            onClick={() => save.mutate(lead.tags.filter((y: string) => y !== x))}
            className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            #{x} ✕
          </button>
        ))}
      </div>
      <form className="mt-2" onSubmit={(e) => (e.preventDefault(), t.trim() && save.mutate([...lead.tags, t.trim()]), setT(''))}>
        <Input className="h-9 text-xs" placeholder="+ tag" value={t} onChange={(e) => setT(e.target.value)} />
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
      const res = await fetch(`${API_URL}/api/calls/${id}/recording`, { headers: { Authorization: `Bearer ${authStore.get()?.accessToken ?? ''}` } });
      if (!res.ok) throw new Error('Recording नहीं मिली');
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: res.headers.get('content-type') ?? 'audio/mpeg' }));
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
