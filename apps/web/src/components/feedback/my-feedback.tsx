'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareHeart, Plus } from 'lucide-react';
import { FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS, timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { PageHeader } from '../panel/shell';
import { Badge, Empty } from '../ui/misc';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { FeedbackForm } from './feedback-widget';

export function MyFeedback() {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['my-feedback'], queryFn: () => api<any[]>('/feedback/mine') });
  return (
    <>
      <PageHeader
        title="Feedback & feature requests"
        subtitle="आपके भेजे सुझाव और उनका status"
        actions={
          <>
            <Button variant="secondary" href="/feedback">Public roadmap</Button>
            <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New feedback</Button>
          </>
        }
      />
      {!q.data?.length ? (
        <Empty icon={<MessageSquareHeart className="size-6" />} title="अभी कोई feedback नहीं" text="Bug report करें या नया feature suggest करें — हम हर feedback पढ़ते हैं।" action={<Button onClick={() => setOpen(true)}>Feedback दें</Button>} />
      ) : (
        <div className="space-y-3">
          {q.data.map((f) => (
            <Link key={f.id} href={`/feedback/${f.id}`} className="card flex items-center gap-4 p-4 hover:border-brand-300">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge style={{ background: `${FEEDBACK_STATUS_COLORS[f.status]}22`, color: FEEDBACK_STATUS_COLORS[f.status] }}>{FEEDBACK_STATUS_LABELS[f.status]}</Badge>
                  <span className="text-xs text-subtle">{FEEDBACK_TYPE_LABELS[f.type]} · {timeAgo(f.createdAt)}</span>
                </div>
                <p className="mt-1 font-semibold">{f.title}</p>
                {f.adminReply && <p className="mt-1 text-sm text-brand-600">Team: {f.adminReply}</p>}
              </div>
              <span className="text-sm font-bold">▲ {f.voteCount}</span>
            </Link>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Feedback भेजें" size="lg">
        <FeedbackForm onDone={() => (setOpen(false), q.refetch())} />
      </Dialog>
    </>
  );
}
