'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { MessageSquareReply, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

function Stars({ n, size = 'size-4' }: { n: number; size?: string }) {
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(n) ? 'fill-saffron-500 text-saffron-500' : 'text-line')} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const q = useQuery({ queryKey: ['broker-reviews'], queryFn: () => api<any[]>('/broker/reviews') });
  const items = q.data ?? [];
  const avg = items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: items.filter((r) => r.rating === n).length }));
  return (
    <>
      <PageHeader title="Reviews" subtitle="Clients के reviews आपकी microsite और broker directory पर दिखते हैं — हर review का जवाब दें" />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !items.length ? (
        <Empty icon={<Star className="size-7" />} title="अभी कोई review नहीं" text="Deal close होने के बाद clients से अपनी microsite पर review माँगें — Settings से microsite link copy करें।" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="card h-fit p-6 text-center">
            <p className="font-display text-5xl font-extrabold">{avg.toFixed(1)}</p>
            <div className="mt-2 flex justify-center"><Stars n={avg} size="size-5" /></div>
            <p className="mt-1 text-sm text-muted">{items.length} reviews</p>
            <div className="mt-5 space-y-1.5">
              {dist.map((d) => (
                <div key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{d.n}</span>
                  <Star className="size-3 fill-saffron-500 text-saffron-500" />
                  <div className="h-2 flex-1 rounded-full bg-surface-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(d.c / items.length) * 100}%` }} className="h-full rounded-full bg-saffron-500" />
                  </div>
                  <span className="w-5 text-right text-muted">{d.c}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {items.map((r) => <ReviewItem key={r.id} r={r} />)}
          </div>
        </div>
      )}
    </>
  );
}

function ReviewItem({ r }: { r: any }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(r.reply ?? '');
  const save = useApiMutation(() => patch(`/broker/reviews/${r.id}`, { reply }), { success: 'Reply published', invalidate: [['broker-reviews']], onSuccess: () => setOpen(false) });
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Avatar name={r.user.name} src={r.user.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{r.user.name}</p>
            <Stars n={r.rating} />
            {r.status !== 'PUBLISHED' && <Badge tone="warning">{r.status}</Badge>}
            <span className="ml-auto text-xs text-subtle">{formatDate(r.createdAt)}</span>
          </div>
          {r.comment && <p className="mt-1.5 text-sm leading-6">{r.comment}</p>}
          {r.reply && !open && (
            <div className="mt-3 rounded-xl border-l-4 border-brand-500 bg-surface-2 px-4 py-2.5 text-sm">
              <p className="text-xs font-bold text-brand-600">आपका जवाब</p>
              <p className="mt-0.5">{r.reply}</p>
            </div>
          )}
          {open ? (
            <div className="mt-3 space-y-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="धन्यवाद! …" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!reply.trim()}>Publish</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="xs" variant="ghost" className="mt-2" onClick={() => setOpen(true)}><MessageSquareReply className="size-3.5" /> {r.reply ? 'Reply edit करें' : 'Reply करें'}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
