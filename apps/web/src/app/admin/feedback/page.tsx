'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ExternalLink, MessageSquare, MessageSquareHeart, Search, Star, ThumbsUp, Trash2 } from 'lucide-react';
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { del, patch, useApiMutation, useDebounced } from '@/lib/hooks';
import { cn, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton, Switch } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

export default function FeedbackAdmin() {
  const [f, setF] = useState({ q: '', status: '', type: '', sort: 'new', page: 1 });
  const dq = useDebounced(f.q);
  const q = useQuery({ queryKey: ['admin-feedback', { ...f, q: dq }], queryFn: () => api<any>(`/feedback/admin/list${qs({ ...f, q: dq })}`), placeholderData: (p) => p });
  const [sel, setSel] = useState<any>(null);
  const s = q.data?.stats;
  return (
    <>
      <PageHeader title="Feedback & roadmap" subtitle="Users और brokers के suggestions, bugs और feature requests — status बदलने पर सबको notification जाता है" actions={<Button size="sm" variant="secondary" href="/feedback" external>Public roadmap <ExternalLink className="size-3.5" /></Button>} />
      {s && (
        <div className="mb-5 flex flex-wrap gap-2">
          {FEEDBACK_STATUSES.map((st) => (
            <button key={st} onClick={() => setF({ ...f, status: f.status === st ? '' : st, page: 1 })} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition', f.status === st ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15' : 'border-line bg-surface hover:bg-surface-2')}>
              <span className="size-2 rounded-full" style={{ background: FEEDBACK_STATUS_COLORS[st] }} /> {FEEDBACK_STATUS_LABELS[st]} <span className="text-muted">{s.byStatus[st] ?? 0}</span>
            </button>
          ))}
          {s.avgRating && <span className="inline-flex items-center gap-1 rounded-xl bg-saffron-50 px-3 py-2 text-sm font-semibold text-saffron-700 dark:bg-saffron-500/10"><Star className="size-4 fill-saffron-500 text-saffron-500" /> {s.avgRating} ({s.ratings})</span>}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-full sm:w-72"><Input icon={<Search className="size-4" />} className="h-10" placeholder="Search…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} /></div>
        <Select className="h-10 w-44" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, page: 1 })}>
          <option value="">All types</option>
          {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>)}
        </Select>
        <Select className="h-10 w-36" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
          <option value="new">Newest</option>
          <option value="votes">Most voted</option>
        </Select>
      </div>
      {q.isError ? <ApiErrorState error={q.error} /> : !q.data ? <Skeleton className="h-96 rounded-2xl" /> : !q.data.items.length ? <Empty icon={<MessageSquareHeart className="size-7" />} title="कोई feedback नहीं" /> : (
        <>
          <div className="space-y-2">
            {q.data.items.map((it: any, i: number) => (
              <motion.button key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.02 }} onClick={() => setSel(it)} className="card flex w-full items-center gap-4 p-4 text-left transition hover:shadow-md">
                <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-surface-2 py-2"><ThumbsUp className="size-4 text-brand-600" /><span className="text-sm font-bold">{it.voteCount}</span></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{it.title}</p>
                    <Badge>{FEEDBACK_TYPE_LABELS[it.type]}</Badge>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${FEEDBACK_STATUS_COLORS[it.status]}1a`, color: FEEDBACK_STATUS_COLORS[it.status] }}>{FEEDBACK_STATUS_LABELS[it.status]}</span>
                    {!it.isPublic && <Badge tone="neutral">Private</Badge>}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{it.description}</p>
                  <p className="mt-1 text-xs text-subtle">{it.user ? `${it.user.name} · ${it.user.role}` : it.contactEmail ?? 'Guest'} · {it.platform} · {timeAgo(it.createdAt)} · <MessageSquare className="inline size-3" /> {it._count.comments}{it.rating ? ` · ${'★'.repeat(it.rating)}` : ''}</p>
                </div>
              </motion.button>
            ))}
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(p) => setF({ ...f, page: p })} />
        </>
      )}
      <FeedbackSheet item={sel} onClose={() => setSel(null)} />
    </>
  );
}

function FeedbackSheet({ item, onClose }: { item: any; onClose: () => void }) {
  const [v, setV] = useState<any>({});
  const [merge, setMerge] = useState('');
  useEffect(() => {
    if (item) setV({ status: item.status, isPublic: item.isPublic, adminReply: item.adminReply ?? '', type: item.type });
  }, [item]);
  const save = useApiMutation((b: any) => patch(`/feedback/${item.id}`, b), { success: 'Updated — submitter और voters को notify किया', invalidate: [['admin-feedback']], onSuccess: onClose });
  const remove = useApiMutation(() => del(`/feedback/${item.id}`), { success: 'Deleted', invalidate: [['admin-feedback']], onSuccess: onClose });
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} className="max-w-xl">
      {item && (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <p className="font-display text-xl font-bold">{item.title}</p>
            <p className="mt-1 text-xs text-subtle">{item.user?.email ?? item.contactEmail ?? 'Guest'} · {item.platform}{item.appVersion ? ` v${item.appVersion}` : ''}{item.pageUrl ? ` · ${item.pageUrl}` : ''}</p>
            <p className="mt-4 text-sm leading-6 whitespace-pre-line">{item.description}</p>
            {item.screenshots?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.screenshots.map((u: string) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="size-24 rounded-xl border border-line object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
                  {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
                  {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>)}
                </Select>
              </Field>
              <Field label="Public roadmap पर दिखाएँ"><div className="flex h-11 items-center"><Switch checked={!!v.isPublic} onCheckedChange={(x) => setV({ ...v, isPublic: x })} /></div></Field>
              <Field label="Team reply (public)" className="sm:col-span-2"><Textarea value={v.adminReply} onChange={(e) => setV({ ...v, adminReply: e.target.value })} placeholder="धन्यवाद! यह अगले update में आ रहा है…" /></Field>
              <Field label="Duplicate है? Merge into (feedback ID)" className="sm:col-span-2" hint="Votes target में move हो जाएँगे और ये private हो जाएगा">
                <div className="flex gap-2"><Input value={merge} onChange={(e) => setMerge(e.target.value)} placeholder="feedback id" /><Button variant="secondary" disabled={!merge} onClick={() => save.mutate({ mergedIntoId: merge })}>Merge</Button></div>
              </Field>
            </div>
            <Link href={`/feedback/${item.id}`} target="_blank" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Public page / comments <ExternalLink className="size-3.5" /></Link>
          </div>
          <div className="flex gap-2 border-t border-line p-4">
            <Button variant="ghost" onClick={() => confirm('Delete करें?') && remove.mutate(undefined)}><Trash2 className="size-4" /></Button>
            <Button className="ml-auto" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate({ status: v.status, type: v.type, isPublic: v.isPublic, adminReply: v.adminReply || null })}>Save & notify</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
