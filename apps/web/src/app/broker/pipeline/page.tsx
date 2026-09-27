'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { KanbanSquare, MessageCircle, Phone, Search } from 'lucide-react';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STAGE_COLORS, formatPriceShort, timeAgo, whatsappLink, type LeadStage } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, useDebounced } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { cn, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { SourceBadge, TempBadge, useTeam } from '@/components/broker/bits';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';

interface Column {
  stage: LeadStage;
  label: string;
  count: number;
  items: any[];
}

export default function PipelinePage() {
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const team = useTeam();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [agent, setAgent] = useState('');
  const dq = useDebounced(search);
  const key = ['kanban', dq, source, agent];
  const q = useQuery({ queryKey: key, queryFn: () => api<Column[]>(`/leads/kanban${qs({ q: dq, source, assignedToId: agent })}`), placeholderData: (p) => p });
  useRealtime('notification', (n: any) => n?.kind === 'NEW_LEAD' && q.refetch());
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lost, setLost] = useState<{ id: string; from: LeadStage } | null>(null);
  const [reason, setReason] = useState('');

  const move = async (id: string, to: LeadStage, lostReason?: string) => {
    const cols = qc.getQueryData<Column[]>(key);
    if (!cols) return;
    const from = cols.find((c) => c.items.some((i) => i.id === id));
    if (!from || from.stage === to) return;
    if (to === 'LOST' && !lostReason) {
      setLost({ id, from: from.stage });
      return;
    }
    const lead = from.items.find((i) => i.id === id)!;
    qc.setQueryData<Column[]>(key, (old) =>
      old?.map((c) => (c.stage === from.stage ? { ...c, count: c.count - 1, items: c.items.filter((i) => i.id !== id) } : c.stage === to ? { ...c, count: c.count + 1, items: [{ ...lead, stage: to }, ...c.items] } : c)),
    );
    try {
      await patch(`/leads/${id}/stage`, { stage: to, lostReason });
      toast.success(`${lead.name ?? 'Lead'} → ${cols.find((c) => c.stage === to)?.label}`);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
    } catch (e) {
      toast.error(errorMessage(e));
      qc.setQueryData(key, cols);
    }
  };

  const total = q.data?.reduce((s, c) => s + (c.stage === 'WON' || c.stage === 'LOST' ? 0 : c.count), 0) ?? 0;
  const value = q.data?.filter((c) => !['WON', 'LOST'].includes(c.stage)).reduce((s, c) => s + c.items.reduce((a, l) => a + (Number(l.requirement?.maxBudget ?? l.requirement?.minBudget) || 0), 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={q.data ? `${total} active leads · budget pipeline ${value ? formatPriceShort(value) : '—'} · cards को drag करके stage बदलें` : ' '}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-full sm:w-72">
          <Input icon={<Search className="size-4" />} placeholder="नाम या phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10" />
        </div>
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="h-10 w-44">
          <option value="">सभी sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>
          ))}
        </Select>
        {admin && (
          <Select value={agent} onChange={(e) => setAgent(e.target.value)} className="h-10 w-44">
            <option value="">पूरी team</option>
            {(team.data?.members ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        )}
      </div>

      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-4">
            {(q.data ?? Array.from({ length: 7 }, (_, i) => ({ stage: String(i) as LeadStage, label: '', count: 0, items: [] }))).map((col) => {
              const c = LEAD_STAGE_COLORS[col.stage] ?? '#94a3b8';
              return (
                <div
                  key={col.stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(col.stage);
                  }}
                  onDragLeave={() => setOver((o) => (o === col.stage ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    if (dragId) move(dragId, col.stage);
                    setDragId(null);
                  }}
                  className={cn('flex w-[290px] flex-col rounded-2xl border bg-surface-2/60 transition', over === col.stage ? 'border-brand-400 bg-brand-50/60 dark:bg-brand-500/10' : 'border-line')}
                >
                  <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                    <span className="size-2.5 rounded-full" style={{ background: c }} />
                    <div className="font-display text-sm font-bold">{col.label || <Skeleton className="h-4 w-20" />}</div>
                    <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-muted">{col.count}</span>
                  </div>
                  <div className="mx-3 mb-2 h-1 rounded-full" style={{ background: `${c}33` }}>
                    <div className="h-full rounded-full" style={{ background: c, width: `${Math.min(100, (col.count / Math.max(1, total)) * 100)}%` }} />
                  </div>
                  <div className="flex max-h-[calc(100dvh-260px)] min-h-40 flex-col gap-2 overflow-y-auto p-2.5">
                    {!q.data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                    <AnimatePresence initial={false}>
                      {col.items.map((l) => (
                        <motion.div
                          key={l.id}
                          layout
                          layoutId={`kb-${l.id}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: dragId === l.id ? 0.4 : 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDragId(l.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDragId(null)}
                            className="group cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link href={`/broker/leads/${l.id}`} className="min-w-0 font-semibold hover:text-brand-600">
                                <span className="line-clamp-1">{l.name || l.phone}</span>
                              </Link>
                              <TempBadge t={l.temperature} />
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                              {[l.requirement?.bedrooms?.length ? `${l.requirement.bedrooms.join('/')} BHK` : null, l.requirement?.maxBudget ? `≤ ${formatPriceShort(Number(l.requirement.maxBudget))}` : null, l.listing?.title].filter(Boolean).join(' · ') || l.phone}
                            </p>
                            <div className="mt-2.5 flex items-center gap-1.5">
                              <SourceBadge source={l.source} />
                              <span className="ml-auto text-[11px] text-subtle">{timeAgo(l.lastActivityAt ?? l.createdAt)}</span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-1 border-t border-line pt-2.5">
                              {l.assignedTo ? <Avatar name={l.assignedTo.name} src={l.assignedTo.avatarUrl} size={22} /> : <span className="text-[11px] text-amber-600">Unassigned</span>}
                              <div className="ml-auto flex gap-1 opacity-70 transition group-hover:opacity-100">
                                <a href={`tel:${l.phone}`} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-brand-600" aria-label="Call">
                                  <Phone className="size-3.5" />
                                </a>
                                <a href={whatsappLink(l.phone, `Hi ${l.name ?? ''}`)} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-emerald-600" aria-label="WhatsApp">
                                  <MessageCircle className="size-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {q.data && !col.items.length && (
                      <div className="grid flex-1 place-items-center rounded-xl border-2 border-dashed border-line p-6 text-center text-xs text-subtle">
                        <KanbanSquare className="mx-auto mb-1 size-5" /> यहाँ drop करें
                      </div>
                    )}
                    {col.count > col.items.length && (
                      <Link href={`/broker/leads?stage=${col.stage}`} className="py-1 text-center text-xs font-semibold text-brand-600">
                        +{col.count - col.items.length} और देखें
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        open={!!lost}
        onOpenChange={(v) => !v && setLost(null)}
        title="Lead lost क्यों हुई?"
        description="Reason से analytics में पता चलता है कि leads कहाँ छूट रही हैं।"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLost(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                if (lost) move(lost.id, 'LOST', reason.trim());
                setLost(null);
                setReason('');
              }}
            >
              Mark lost
            </Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {['Budget mismatch', 'Bought elsewhere', 'Not responding', 'Plan postponed', 'Location mismatch', 'Fake / wrong number'].map((r) => (
            <button key={r} onClick={() => setReason(r)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', reason === r ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15' : 'border-line text-muted')}>
              {r}
            </button>
          ))}
        </div>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="या अपना reason लिखें…" />
      </Dialog>
    </>
  );
}
