'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, Reorder, motion } from 'motion/react';
import { ArrowDown, Bell, CalendarClock, Clock, GitBranch, GripVertical, History, Mail, MessageCircle, Pencil, Plus, Sparkles, Tag, Trash2, UserCheck, Users, Workflow, Zap } from 'lucide-react';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STAGES, LEAD_STAGE_LABELS, timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { useTeam } from '@/components/broker/bits';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton, Switch } from '@/components/ui/misc';
import { Dialog, Sheet } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

const TRIGGERS = {
  LEAD_CREATED: { label: 'नई lead आते ही', icon: Zap },
  STAGE_CHANGED: { label: 'Stage बदलने पर', icon: GitBranch },
  NO_ACTIVITY: { label: 'X घंटे तक कोई activity नहीं', icon: Clock },
  VISIT_SCHEDULED: { label: 'Site visit schedule होने पर', icon: CalendarClock },
  VISIT_REMINDER: { label: 'Visit से पहले reminder', icon: Bell },
} as const;

const ACTIONS = {
  SEND_WHATSAPP_TEXT: { label: 'WhatsApp message', icon: MessageCircle, color: '#16a34a' },
  SEND_WHATSAPP_TEMPLATE: { label: 'WhatsApp template', icon: MessageCircle, color: '#059669' },
  SEND_EMAIL: { label: 'Email भेजें', icon: Mail, color: '#0284c7' },
  ASSIGN_ROUND_ROBIN: { label: 'Round-robin assign', icon: Users, color: '#7c3aed' },
  ASSIGN_TO: { label: 'Member को assign', icon: UserCheck, color: '#6d28d9' },
  CREATE_FOLLOW_UP: { label: 'Follow-up बनाएँ', icon: CalendarClock, color: '#ea580c' },
  ADD_TAG: { label: 'Tag लगाएँ', icon: Tag, color: '#0891b2' },
  SET_STAGE: { label: 'Stage बदलें', icon: GitBranch, color: '#4f46e5' },
  NOTIFY_TEAM: { label: 'Team को notify', icon: Bell, color: '#e11d48' },
} as const;
type ActionType = keyof typeof ACTIONS;

const VARS = ['{{lead.name}}', '{{lead.phone}}', '{{agent.name}}', '{{org.name}}', '{{org.phone}}', '{{source}}', '{{listing.title}}', '{{listing.link}}', '{{visit.time}}', '{{visit.address}}'];

function delayLabel(m: number) {
  if (!m) return 'तुरंत';
  if (m % 1440 === 0) return `${m / 1440} दिन बाद`;
  if (m % 60 === 0) return `${m / 60} घंटे बाद`;
  return `${m} मिनट बाद`;
}

export default function AutomationsPage() {
  const rules = useQuery({ queryKey: ['automations'], queryFn: () => api<any[]>('/automations') });
  const presets = useQuery({ queryKey: ['automation-presets'], queryFn: () => api<any[]>('/automations/presets') });
  const [edit, setEdit] = useState<any>(null);
  const [runsFor, setRunsFor] = useState<any>(null);
  const inv = [['automations']];
  const toggle = useApiMutation((r: any) => patch(`/automations/${r.id}`, { isActive: !r.isActive }), { invalidate: inv });
  const remove = useApiMutation((id: string) => del(`/automations/${id}`), { success: 'Automation हटाई', invalidate: inv });
  const addPreset = useApiMutation((p: any) => post('/automations', { name: p.name, trigger: p.trigger, conditions: p.conditions, actions: p.actions, respectBusinessHours: p.respectBusinessHours, isActive: true }), { success: 'Automation चालू 🚀', invalidate: inv });
  const existing = new Set((rules.data ?? []).map((r) => r.name));

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Lead आते ही welcome, assignment, drip follow-ups — आपकी team सोए तब भी काम चलता रहे"
        actions={<Button size="sm" onClick={() => setEdit({ name: '', trigger: 'LEAD_CREATED', conditions: { sources: [], stages: [] }, actions: [], respectBusinessHours: true, isActive: true })}><Plus className="size-4" /> नई automation</Button>}
      />

      {presets.data && presets.data.some((p) => !existing.has(p.name)) && (
        <div className="mb-8">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-saffron-500" /> One-click recipes</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {presets.data.filter((p) => !existing.has(p.name)).map((p, i) => {
              const T = TRIGGERS[p.trigger as keyof typeof TRIGGERS];
              return (
                <motion.div key={p.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card group relative overflow-hidden p-4">
                  <div className="absolute -top-10 -right-10 size-28 rounded-full bg-gradient-to-br from-brand-500/15 to-saffron-500/15 blur-2xl transition group-hover:scale-150" />
                  <p className="relative font-semibold">{p.name}</p>
                  <p className="relative mt-1 flex items-center gap-1.5 text-xs text-muted"><T.icon className="size-3.5" /> {T.label}</p>
                  <div className="relative mt-3 flex flex-wrap gap-1.5">
                    {p.actions.map((a: any, j: number) => {
                      const A = ACTIONS[a.type as ActionType];
                      return <span key={j} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${A.color}14`, color: A.color }}><A.icon className="size-3" /> {A.label}{a.delayMinutes ? ` · ${delayLabel(a.delayMinutes)}` : ''}</span>;
                    })}
                  </div>
                  <div className="relative mt-4 flex gap-2">
                    <Button size="xs" onClick={() => addPreset.mutate(p)} loading={addPreset.isPending && addPreset.variables?.key === p.key}>Use</Button>
                    <Button size="xs" variant="ghost" onClick={() => setEdit({ ...p, isActive: true })}>Customize</Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {rules.isError ? (
        <ApiErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : !rules.data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !rules.data.length ? (
        <Empty icon={<Workflow className="size-7" />} title="अभी कोई automation नहीं" text="ऊपर के recipes से शुरू करें — सबसे ज़्यादा फ़ायदा 'तुरंत WhatsApp welcome' और 'round-robin' से होता है।" />
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold">आपकी automations</p>
          {rules.data.map((r) => {
            const T = TRIGGERS[r.trigger as keyof typeof TRIGGERS];
            return (
              <motion.div layout key={r.id} className={cn('card flex flex-col gap-4 p-4 sm:flex-row sm:items-center', !r.isActive && 'opacity-60')}>
                <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', r.isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : 'bg-surface-2 text-muted')}>
                  <T.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{T.label}</span>
                    {(r.actions as any[]).map((a, j) => {
                      const A = ACTIONS[a.type as ActionType];
                      return <span key={j} className="inline-flex items-center gap-1"><span className="text-subtle">→</span><span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: `${A?.color}14`, color: A?.color }}>{A?.label ?? a.type}</span></span>;
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-subtle">{r.runCount ?? 0} runs{r.lastRunAt ? ` · last ${timeAgo(r.lastRunAt)}` : ''}{r.respectBusinessHours ? ' · business hours में' : ''}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="icon-sm" variant="ghost" onClick={() => setRunsFor(r)} aria-label="Run history" title="Run history"><History className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setEdit(r)} aria-label="Edit"><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => confirm('ये automation delete करें?') && remove.mutate(r.id)} aria-label="Delete"><Trash2 className="size-4" /></Button>
                  <Switch checked={r.isActive} onCheckedChange={() => toggle.mutate(r)} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <Builder rule={edit} onClose={() => setEdit(null)} />
      <Runs rule={runsFor} onClose={() => setRunsFor(null)} />
    </>
  );
}

function Builder({ rule, onClose }: { rule: any; onClose: () => void }) {
  const team = useTeam();
  const tpls = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<any[]>('/whatsapp/templates'), enabled: !!rule });
  const [r, setR] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  if (rule && r?.__src !== rule) {
    setR({ ...rule, conditions: { sources: [], stages: [], ...(rule.conditions ?? {}) }, __src: rule });
    setActions((rule.actions ?? []).map((a: any) => ({ ...a, _k: Math.random().toString(36).slice(2) })));
  }
  const save = useApiMutation(
    () => {
      const body = { name: r.name, trigger: r.trigger, conditions: r.conditions, respectBusinessHours: r.respectBusinessHours, isActive: r.isActive ?? true, actions: actions.map(({ _k, ...a }) => (void _k, a)) };
      return rule.id ? patch(`/automations/${rule.id}`, body) : post('/automations', body);
    },
    { success: 'Automation saved', invalidate: [['automations']], onSuccess: onClose },
  );
  if (!rule || !r) return null;
  const set = (p: any) => setR((x: any) => ({ ...x, ...p }));
  const setCond = (p: any) => setR((x: any) => ({ ...x, conditions: { ...x.conditions, ...p } }));
  const toggleIn = (k: 'sources' | 'stages', v: string) => setCond({ [k]: r.conditions[k].includes(v) ? r.conditions[k].filter((x: string) => x !== v) : [...r.conditions[k], v] });
  const setA = (k: string, p: any) => setActions((as) => as.map((a) => (a._k === k ? { ...a, ...p, params: { ...a.params, ...(p.params ?? {}) } } : a)));
  const addA = (type: ActionType) => setActions((as) => [...as, { _k: Math.random().toString(36).slice(2), type, delayMinutes: 0, params: type === 'CREATE_FOLLOW_UP' ? { inMinutes: 30, type: 'CALL' } : {} }]);

  return (
    <Sheet open={!!rule} onOpenChange={(v) => !v && onClose()} className="max-w-2xl">
      <div className="flex h-full flex-col">
        <div className="border-b border-line p-5">
          <p className="font-display text-lg font-bold">{rule.id ? 'Automation edit करें' : 'नई automation'}</p>
          <Input className="mt-3" value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="Automation का नाम" />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto bg-surface-2/40 p-5">
          {/* trigger */}
          <div className="card p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-brand-600 uppercase"><Zap className="size-3.5" /> When (trigger)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(TRIGGERS).map(([k, t]) => (
                <button key={k} onClick={() => set({ trigger: k })} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition', r.trigger === k ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-line hover:bg-surface-2')}>
                  <t.icon className="size-4" /> {t.label}
                </button>
              ))}
            </div>
            {r.trigger === 'STAGE_CHANGED' && (
              <Field label="किस stage पर पहुँचने पर" className="mt-3">
                <Select value={r.conditions.toStage ?? ''} onChange={(e) => setCond({ toStage: e.target.value || null })}>
                  <option value="">कोई भी stage</option>
                  {LEAD_STAGES.map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>)}
                </Select>
              </Field>
            )}
            {r.trigger === 'NO_ACTIVITY' && (
              <Field label="कितने घंटे" className="mt-3"><Input type="number" min={1} value={r.conditions.noActivityHours ?? 48} onChange={(e) => setCond({ noActivityHours: Number(e.target.value) })} /></Field>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted">Filters (optional) — {r.conditions.sources.length || 'all'} sources · {r.conditions.stages.length || 'all'} stages</summary>
              <p className="mt-3 mb-1.5 text-xs font-semibold">Sources</p>
              <div className="flex flex-wrap gap-1.5">{LEAD_SOURCES.map((s) => <Chip key={s} active={r.conditions.sources.includes(s)} onClick={() => toggleIn('sources', s)}>{LEAD_SOURCE_LABELS[s]}</Chip>)}</div>
              <p className="mt-3 mb-1.5 text-xs font-semibold">Current stage</p>
              <div className="flex flex-wrap gap-1.5">{LEAD_STAGES.map((s) => <Chip key={s} active={r.conditions.stages.includes(s)} onClick={() => toggleIn('stages', s)}>{LEAD_STAGE_LABELS[s]}</Chip>)}</div>
            </details>
          </div>

          <Reorder.Group axis="y" values={actions} onReorder={setActions} className="space-y-2">
            <AnimatePresence initial={false}>
              {actions.map((a, i) => {
                const A = ACTIONS[a.type as ActionType];
                const p = a.params ?? {};
                return (
                  <Reorder.Item key={a._k} value={a} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <div className="flex justify-center py-1 text-subtle"><ArrowDown className="size-4" /></div>
                    <div className="card p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <GripVertical className="size-4 cursor-grab text-subtle" />
                        <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: A.color }}><A.icon className="size-4" /></span>
                        <p className="flex-1 text-sm font-bold">{i + 1}. {A.label}</p>
                        <Select className="h-8 w-32 rounded-lg text-xs" value={String(a.delayMinutes)} onChange={(e) => setA(a._k, { delayMinutes: Number(e.target.value) })}>
                          {[0, 5, 15, 30, 60, 180, 360, 1440, 2880, 4320, 10080].map((m) => <option key={m} value={m}>{delayLabel(m)}</option>)}
                        </Select>
                        <button onClick={() => setActions((as) => as.filter((x) => x._k !== a._k))} className="rounded-lg p-1.5 text-subtle hover:text-rose-600" aria-label="Remove"><Trash2 className="size-4" /></button>
                      </div>
                      {a.type === 'SEND_WHATSAPP_TEXT' && (
                        <>
                          <Textarea value={p.text ?? ''} onChange={(e) => setA(a._k, { params: { text: e.target.value } })} placeholder="नमस्ते {{lead.name}} …" />
                          <p className="mt-1.5 text-[11px] text-amber-600">Note: पहला message 24-घंटे window के अंदर (lead के message के बाद) ही free-form जाता है — नहीं तो template action इस्तेमाल करें।</p>
                        </>
                      )}
                      {a.type === 'SEND_WHATSAPP_TEMPLATE' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Select value={p.templateName ?? ''} onChange={(e) => { const t = tpls.data?.find((x) => x.name === e.target.value); setA(a._k, { params: { templateName: e.target.value, language: t?.language ?? 'en' } }); }}>
                            <option value="">Template चुनें</option>
                            {tpls.data?.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.language})</option>)}
                          </Select>
                          <Input value={(p.params ?? []).join(' | ')} onChange={(e) => setA(a._k, { params: { params: e.target.value.split('|').map((x) => x.trim()).filter(Boolean) } })} placeholder="Variables: {{lead.name}} | {{agent.name}}" />
                        </div>
                      )}
                      {a.type === 'SEND_EMAIL' && (
                        <div className="space-y-2">
                          <Input value={p.subject ?? ''} onChange={(e) => setA(a._k, { params: { subject: e.target.value } })} placeholder="Subject" />
                          <Textarea value={p.body ?? ''} onChange={(e) => setA(a._k, { params: { body: e.target.value } })} placeholder="Email body" />
                        </div>
                      )}
                      {a.type === 'ASSIGN_ROUND_ROBIN' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.reassign} onChange={(e) => setA(a._k, { params: { reassign: e.target.checked } })} /> पहले से assigned हो तो भी reassign करें</label>}
                      {a.type === 'ASSIGN_TO' && (
                        <Select value={p.userId ?? ''} onChange={(e) => setA(a._k, { params: { userId: e.target.value } })}>
                          <option value="">Member चुनें</option>
                          {team.data?.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </Select>
                      )}
                      {a.type === 'CREATE_FOLLOW_UP' && (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Select value={p.type ?? 'CALL'} onChange={(e) => setA(a._k, { params: { type: e.target.value } })}>
                            {['CALL', 'WHATSAPP', 'MEETING', 'EMAIL'].map((t) => <option key={t} value={t}>{t}</option>)}
                          </Select>
                          <Input type="number" value={p.inMinutes ?? 0} onChange={(e) => setA(a._k, { params: { inMinutes: Number(e.target.value) } })} placeholder="Due in minutes" />
                          <Input value={p.note ?? ''} onChange={(e) => setA(a._k, { params: { note: e.target.value } })} placeholder="Note" />
                        </div>
                      )}
                      {a.type === 'ADD_TAG' && <Input value={p.tag ?? ''} onChange={(e) => setA(a._k, { params: { tag: e.target.value } })} placeholder="जैसे: portal, hot, nri" />}
                      {a.type === 'SET_STAGE' && (
                        <Select value={p.stage ?? ''} onChange={(e) => setA(a._k, { params: { stage: e.target.value } })}>
                          <option value="">Stage चुनें</option>
                          {LEAD_STAGES.map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>)}
                        </Select>
                      )}
                      {a.type === 'NOTIFY_TEAM' && <Input value={p.message ?? ''} onChange={(e) => setA(a._k, { params: { message: e.target.value } })} placeholder="⏰ {{lead.name}} को call करें" />}
                    </div>
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>

          <div className="flex justify-center py-1 text-subtle"><ArrowDown className="size-4" /></div>
          <div className="card border-dashed p-4">
            <p className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Then (action जोड़ें)</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACTIONS).map(([k, A]) => (
                <button key={k} onClick={() => addA(k as ActionType)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow">
                  <A.icon className="size-3.5" style={{ color: A.color }} /> {A.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-subtle">Variables: {VARS.join(' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-line p-4">
          <label className="flex flex-1 items-center gap-2 text-sm"><Switch checked={!!r.respectBusinessHours} onCheckedChange={(v) => set({ respectBusinessHours: v })} /> सिर्फ़ business hours में भेजें</label>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!r.name || !actions.length} onClick={() => save.mutate(undefined)}>Save</Button>
        </div>
      </div>
    </Sheet>
  );
}

function Runs({ rule, onClose }: { rule: any; onClose: () => void }) {
  const q = useQuery({ queryKey: ['automation-runs', rule?.id], queryFn: () => api<any[]>(`/automations/${rule.id}/runs`), enabled: !!rule });
  return (
    <Dialog open={!!rule} onOpenChange={(v) => !v && onClose()} title="Run history" description={rule?.name} size="lg">
      {!q.data ? (
        <Skeleton className="h-40" />
      ) : !q.data.length ? (
        <p className="py-8 text-center text-sm text-muted">अभी तक नहीं चली</p>
      ) : (
        <div className="divide-y divide-line">
          {q.data.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Badge tone={x.status === 'SUCCESS' ? 'success' : x.status === 'FAILED' ? 'danger' : 'neutral'}>{x.status}</Badge>
              <span className="font-medium">{x.lead?.name ?? '—'}</span>
              <span className="flex-1 truncate text-xs text-muted">{x.log?.action} {x.log?.message ?? x.log?.reason ?? x.log?.error ?? ''}</span>
              <span className="text-xs text-subtle">{formatDateTime(x.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
