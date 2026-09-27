'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, BadgeCheck, Check, ExternalLink, ImageOff, ListChecks, MapPin, Star, X } from 'lucide-react';
import { PROPERTY_TYPE_LABELS, formatPriceShort, timeAgo, type PropertyType } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { cn, img, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

const FLAG_LABELS: Record<string, string> = {
  PHONE_IN_TEXT: 'Description में phone number',
  LINK_IN_TEXT: 'Description में link',
  NO_PHOTOS: 'कोई photo नहीं',
  PRICE_OUTLIER: 'Price locality average से बहुत अलग',
  FROM_SCANNER: 'AI scanner से import',
};
const REASONS = ['Photos साफ़ नहीं / missing', 'Price गलत लग रहा है', 'Description में contact details', 'Duplicate listing', 'गलत locality / details', 'Property उपलब्ध नहीं'];

export default function ModerationPage() {
  const [status, setStatus] = useState<'PENDING_REVIEW' | 'REJECTED'>('PENDING_REVIEW');
  const [flagged, setFlagged] = useState(false);
  const q = useQuery({ queryKey: ['moderation', status, flagged], queryFn: () => api<any>(`/admin/moderation/listings${qs({ status, flagged: flagged ? 'true' : '' })}`) });
  const [reject, setReject] = useState<any>(null);
  const [reason, setReason] = useState('');
  const inv = [['moderation'], ['admin-dashboard']];
  const act = useApiMutation((b: { id: string; action: 'approve' | 'reject'; reason?: string }) => post(`/admin/moderation/listings/${b.id}`, b), {
    success: (r: any) => (r.status === 'ACTIVE' ? 'Approved — listing live 🎉' : 'Rejected — owner को बता दिया गया'),
    invalidate: inv,
    onSuccess: () => (setReject(null), setReason('')),
  });
  const flags = useApiMutation((b: any) => patch(`/admin/listings/${b.id}/flags`, b), { success: 'Updated', invalidate: inv });
  const items = q.data?.items ?? [];
  return (
    <>
      <PageHeader title="Moderation queue" subtitle={q.data ? `${q.data.total} listings — हर approve/reject पर owner को notification + email जाता है` : ' '} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={status} onChange={setStatus} options={[{ value: 'PENDING_REVIEW', label: 'Pending' }, { value: 'REJECTED', label: 'Rejected' }]} />
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> सिर्फ़ auto-flagged</label>
      </div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      ) : !items.length ? (
        <Empty icon={<ListChecks className="size-7" />} title="Queue खाली है 🎉" text="नई listings आते ही यहाँ दिखेंगी।" />
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {items.map((l: any) => (
              <motion.div key={l.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }} className="card overflow-hidden">
                <div className="grid gap-0 lg:grid-cols-[380px_1fr]">
                  <div className="grid grid-cols-3 content-start gap-1 bg-surface-2 p-1">
                    {l.media.length ? (
                      l.media.slice(0, 6).map((m: any, i: number) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.id} src={img(m.url, 300)} alt="" className={cn('h-full w-full rounded-lg object-cover', i === 0 ? (l.media.length === 1 ? 'col-span-3 row-span-2 aspect-[4/3]' : 'col-span-2 row-span-2 aspect-square') : 'aspect-square')} />
                      ))
                    ) : (
                      <div className="col-span-3 grid aspect-video place-items-center text-sm text-muted"><span className="flex items-center gap-2"><ImageOff className="size-5" /> No photos</span></div>
                    )}
                  </div>
                  <div className="flex flex-col p-5">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-bold">{l.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" /> {l.societyName ? `${l.societyName}, ` : ''}{l.locality.name} · {PROPERTY_TYPE_LABELS[l.propertyType as PropertyType]} · {l.purpose}</p>
                      </div>
                      <p className="font-display text-xl font-extrabold text-brand-600">{formatPriceShort(l.price)}{l.purpose === 'RENT' && <span className="text-sm text-muted">/mo</span>}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {l.moderationFlags.map((f: string) => <Badge key={f} tone={f === 'FROM_SCANNER' ? 'info' : 'warning'}><AlertTriangle className="size-3" /> {FLAG_LABELS[f] ?? f}</Badge>)}
                      {l._count.reports > 0 && <Badge tone="danger">{l._count.reports} reports</Badge>}
                      {l.bedrooms != null && <Badge>{l.bedrooms} BHK</Badge>}
                      {(l.superArea ?? l.carpetArea) && <Badge>{l.superArea ?? l.carpetArea} sqft</Badge>}
                    </div>
                    {l.description && <p className="mt-3 line-clamp-3 text-sm text-muted">{l.description}</p>}
                    <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs">
                      <span className="font-semibold">{l.organization ? `🏢 ${l.organization.name}` : '👤 Owner'}</span>
                      {l.organization?.verification === 'VERIFIED' && <BadgeCheck className="ml-1 inline size-3.5 text-emerald-600" />}
                      <span className="text-muted"> · {l.postedBy.name} · {l.postedBy.email}{l.postedBy.phone ? ` · ${l.postedBy.phone}` : ''} · joined {timeAgo(l.postedBy.createdAt)}</span>
                    </div>
                    {l.rejectionReason && <p className="mt-2 text-sm text-rose-600">Rejected: {l.rejectionReason}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                      <Button size="sm" variant="ghost" href={`/property/${l.slug}`} external><ExternalLink className="size-4" /> Preview</Button>
                      <Button size="sm" variant="ghost" onClick={() => flags.mutate({ id: l.id, isFeatured: !l.isFeatured, featuredDays: 30 })}><Star className={cn('size-4', l.isFeatured && 'fill-saffron-500 text-saffron-500')} /> {l.isFeatured ? 'Featured' : 'Feature'}</Button>
                      <div className="ml-auto flex gap-2">
                        {status === 'PENDING_REVIEW' && <Button size="sm" variant="secondary" onClick={() => setReject(l)}><X className="size-4" /> Reject</Button>}
                        <Button size="sm" variant="success" loading={act.isPending && act.variables?.id === l.id} onClick={() => act.mutate({ id: l.id, action: 'approve' })}><Check className="size-4" /> Approve</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <Dialog
        open={!!reject}
        onOpenChange={(v) => !v && setReject(null)}
        title="Listing reject करें"
        description="Reason owner को दिखेगा ताकि वो सुधार करके दोबारा भेज सके।"
        footer={<Button variant="danger" disabled={!reason.trim()} loading={act.isPending} onClick={() => act.mutate({ id: reject.id, action: 'reject', reason })}>Reject</Button>}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', reason === r ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15' : 'border-line text-muted')}>{r}</button>)}
        </div>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
      </Dialog>
      <p className="mt-6 text-xs text-subtle">Tip: <Link href="/admin/settings/app#listing" className="text-brand-600">App config</Link> में “Admin approval ज़रूरी” बंद करने पर verified listings सीधे live हो जाती हैं।</p>
    </>
  );
}
