'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ChevronUp, MessageCircle, Plus } from 'lucide-react';
import { FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS, timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Segmented } from '../ui/tabs';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Badge, Empty, Skeleton } from '../ui/misc';
import { FeedbackForm } from './feedback-widget';

export function VoteButton({ item, size = 'md' }: { item: { id: string; voteCount: number; voted?: boolean }; size?: 'md' | 'lg' }) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [state, setState] = useState({ voted: !!item.voted, count: item.voteCount });
  const vote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return router.push('/login?next=/feedback');
    setState((s) => ({ voted: !s.voted, count: s.count + (s.voted ? -1 : 1) }));
    const r = await api<any>(`/feedback/${item.id}/vote`, { method: 'POST' }).catch(() => null);
    if (r) setState({ voted: r.voted, count: r.voteCount });
    qc.invalidateQueries({ queryKey: ['feedback-board'] });
  };
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={vote}
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-xl border-2 font-bold transition',
        size === 'lg' ? 'h-20 w-16' : 'h-16 w-14',
        state.voted ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-fg hover:border-brand-400',
      )}
    >
      <ChevronUp className="size-5" />
      <span>{state.count}</span>
    </motion.button>
  );
}

export function RoadmapBoard() {
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['feedback-board', status, sort],
    queryFn: () => api<any>(`/feedback/board?sort=${sort}${status ? `&status=${status}` : ''}`),
  });
  const counts = data?.statusCounts ?? {};
  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'PLANNED', label: 'Planned', count: counts.PLANNED },
            { value: 'IN_PROGRESS', label: 'In progress', count: counts.IN_PROGRESS },
            { value: 'DONE', label: 'Shipped', count: counts.DONE },
          ]}
        />
        <div className="flex gap-2">
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'new', label: 'New' },
            ]}
          />
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Suggest a feature
          </Button>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : !data?.items.length ? (
          <Empty title="अभी कोई public idea नहीं" text="पहला idea आप suggest करें!" action={<Button onClick={() => setOpen(true)}>Suggest</Button>} />
        ) : (
          data.items.map((f: any) => (
            <Link key={f.id} href={`/feedback/${f.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand-300">
              <VoteButton item={f} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge style={{ background: `${FEEDBACK_STATUS_COLORS[f.status]}22`, color: FEEDBACK_STATUS_COLORS[f.status] }}>
                    {FEEDBACK_STATUS_LABELS[f.status]}
                  </Badge>
                  <span className="text-xs text-subtle">{FEEDBACK_TYPE_LABELS[f.type]}</span>
                </div>
                <h3 className="mt-1 font-semibold">{f.title}</h3>
                <p className="line-clamp-1 text-sm text-muted">{f.description}</p>
              </div>
              <div className="hidden text-right text-xs text-subtle sm:block">
                <p className="flex items-center justify-end gap-1">
                  <MessageCircle className="size-3.5" /> {f._count.comments}
                </p>
                <p className="mt-1">{timeAgo(f.createdAt)}</p>
              </div>
            </Link>
          ))
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Feedback / feature request" size="lg">
        <FeedbackForm onDone={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}
