'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Archive, BadgeCheck, CheckCircle2, Eye, Heart, MessageSquare, MoreVertical, Package, Pencil, Plus, RotateCcw, Rocket, Trash2 } from 'lucide-react';
import { LISTING_STATUS_LABELS, formatPriceShort, timeAgo } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { del, patch, useApiMutation } from '@/lib/hooks';
import { useConfig } from '@/lib/config';
import { payWithRazorpay } from '@/lib/razorpay';
import { cn, img } from '@/lib/utils';
import { Segmented } from '../ui/tabs';
import { Badge, Empty, Skeleton } from '../ui/misc';
import { Button } from '../ui/button';
import { Input } from '../ui/field';
import { Dialog } from '../ui/dialog';
import { PortalPackDialog } from '../broker/portal-pack';

const TONES: Record<string, any> = { ACTIVE: 'success', PENDING_REVIEW: 'warning', DRAFT: 'neutral', REJECTED: 'danger', SOLD: 'info', RENTED: 'info', EXPIRED: 'danger', ARCHIVED: 'neutral' };

export function MyListings({ base, newHref }: { base: string; newHref: string }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [boost, setBoost] = useState<any>(null);
  const [pack, setPack] = useState<string | null>(null);
  const isBroker = base.startsWith('/broker');
  const { app, flags } = useConfig();
  const q = useQuery({ queryKey: ['my-listings', status, search], queryFn: () => api<any>(`/listings/mine?pageSize=50${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`) });
  const setSt = useApiMutation((v: { id: string; status: string }) => patch(`/listings/${v.id}/status`, { status: v.status }), { invalidate: [['my-listings']], success: 'Updated' });
  const remove = useApiMutation((id: string) => del(`/listings/${id}`), { invalidate: [['my-listings']], success: 'Deleted' });
  const c = q.data?.statusCounts ?? {};

  const doBoost = async (weeks: number) => {
    try {
      const order = await api<any>('/billing/boost', { method: 'POST', body: { listingId: boost.id, weeks } });
      const ok = await payWithRazorpay(order);
      if (ok) {
        toast.success('🚀 Listing boost हो गई — अब search में सबसे ऊपर दिखेगी');
        setBoost(null);
        q.refetch();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'ACTIVE', label: 'Live', count: c.ACTIVE },
            { value: 'PENDING_REVIEW', label: 'In review', count: c.PENDING_REVIEW },
            { value: 'DRAFT', label: 'Drafts', count: c.DRAFT },
            { value: 'REJECTED', label: 'Rejected', count: c.REJECTED },
            { value: 'EXPIRED', label: 'Expired', count: c.EXPIRED },
          ]}
        />
        <Input className="h-10 w-56" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button href={newHref} className="ml-auto">
          <Plus className="size-4" /> New listing
        </Button>
      </div>
      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !q.data?.items.length ? (
        <Empty title="कोई listing नहीं" text="पहली property post करें — free है।" action={<Button href={newHref}>Post property</Button>} />
      ) : (
        <div className="space-y-3">
          {q.data.items.map((l: any) => (
            <div key={l.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <Link href={`/property/${l.slug}`} className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-36">
                {l.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img(l.coverUrl, 300)} alt="" className="h-full w-full object-cover" />
                )}
                {l.isFeatured && <Badge className="absolute top-1.5 left-1.5 bg-saffron-500 text-slate-950">Featured</Badge>}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONES[l.status]}>{LISTING_STATUS_LABELS[l.status as keyof typeof LISTING_STATUS_LABELS]}</Badge>
                  {l.isVerified && <BadgeCheck className="size-4 text-emerald-500" />}
                  <span className="text-xs text-subtle">#{l.refNo} · updated {timeAgo(l.updatedAt)}</span>
                </div>
                <Link href={`/property/${l.slug}`} className="mt-1 block truncate font-semibold hover:text-brand-600">{l.title}</Link>
                <p className="text-sm font-bold">{formatPriceShort(l.price)}{l.purpose === 'RENT' ? '/mo' : ''}</p>
                {l.rejectionReason && l.status === 'REJECTED' && <p className="mt-1 text-xs text-rose-600">कारण: {l.rejectionReason}</p>}
                <div className="mt-2 flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1"><Eye className="size-3.5" /> {l.views}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {l.enquiryCount}</span>
                  <span className="flex items-center gap-1"><Heart className="size-3.5" /> {l.shortlistCount ?? 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {l.status === 'ACTIVE' && flags.boosts !== false && !l.isFeatured && (
                  <Button size="sm" variant="accent" onClick={() => setBoost(l)}>
                    <Rocket className="size-4" /> Boost
                  </Button>
                )}
                <Button size="sm" variant="secondary" href={`${base}/${l.id}/edit`}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <DM.Root>
                  <DM.Trigger className="grid size-9 place-items-center rounded-xl border border-line hover:bg-surface-2" aria-label="More"><MoreVertical className="size-4" /></DM.Trigger>
                  <DM.Portal>
                    <DM.Content align="end" className="z-50 w-48 rounded-xl border border-line bg-surface p-1 shadow-xl">
                      {l.status === 'ACTIVE' && (
                        <MI onSelect={() => setSt.mutate({ id: l.id, status: l.purpose === 'RENT' ? 'RENTED' : 'SOLD' })} icon={<CheckCircle2 className="size-4" />}>Mark {l.purpose === 'RENT' ? 'rented' : 'sold'}</MI>
                      )}
                      {['ARCHIVED', 'EXPIRED', 'SOLD', 'RENTED'].includes(l.status) && <MI onSelect={() => setSt.mutate({ id: l.id, status: 'ACTIVE' })} icon={<RotateCcw className="size-4" />}>Re-activate</MI>}
                      {isBroker && <MI onSelect={() => setPack(l.id)} icon={<Package className="size-4" />}>Portal pack</MI>}
                      {l.status !== 'ARCHIVED' && <MI onSelect={() => setSt.mutate({ id: l.id, status: 'ARCHIVED' })} icon={<Archive className="size-4" />}>Archive</MI>}
                      <MI danger onSelect={() => confirm('Listing delete करें?') && remove.mutate(l.id)} icon={<Trash2 className="size-4" />}>Delete</MI>
                    </DM.Content>
                  </DM.Portal>
                </DM.Root>
              </div>
            </div>
          ))}
        </div>
      )}
      {isBroker && <PortalPackDialog listingId={pack} onClose={() => setPack(null)} />}
      <Dialog open={!!boost} onOpenChange={(v) => !v && setBoost(null)} title="🚀 Listing boost करें" description="Featured listings search में सबसे ऊपर और homepage पर दिखती हैं — 5-10x ज़्यादा views।">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 4].map((w) => (
            <button key={w} onClick={() => doBoost(w)} className={cn('rounded-2xl border-2 p-4 text-left transition hover:border-brand-500', w === 2 ? 'border-brand-600' : 'border-line')}>
              <p className="font-display text-lg font-bold">{w} week{w > 1 ? 's' : ''}</p>
              <p className="mt-1 text-2xl font-extrabold">₹{(app.monetization.boostPricePerWeek * w).toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted">+ GST</p>
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}

function MI({ children, icon, onSelect, danger }: { children: React.ReactNode; icon: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <DM.Item onSelect={onSelect} className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-2', danger && 'text-rose-600')}>
      {icon}
      {children}
    </DM.Item>
  );
}
