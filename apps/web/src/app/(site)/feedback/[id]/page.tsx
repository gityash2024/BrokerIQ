'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS, timeAgo } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { img } from '@/lib/utils';
import { PageShell } from '@/components/site/page-shell';
import { VoteButton } from '@/components/feedback/roadmap-board';
import { ApiErrorState } from '@/components/ui/api-error';
import { Avatar, Badge, PageLoader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';

export default function FeedbackDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['feedback', id], queryFn: () => api<any>(`/feedback/${id}`) });
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const f = q.data;
  const send = async () => {
    setSending(true);
    try {
      await api(`/feedback/${id}/comments`, { method: 'POST', body: { body } });
      setBody('');
      q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };
  return (
    <PageShell>
      <div className="container-x max-w-3xl py-12">
        {q.isLoading ? (
          <PageLoader />
        ) : q.error ? (
          <ApiErrorState error={q.error} />
        ) : (
          <>
            <div className="flex gap-5">
              <VoteButton item={f} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge style={{ background: `${FEEDBACK_STATUS_COLORS[f.status]}22`, color: FEEDBACK_STATUS_COLORS[f.status] }}>{FEEDBACK_STATUS_LABELS[f.status]}</Badge>
                  <span className="text-xs text-subtle">
                    {FEEDBACK_TYPE_LABELS[f.type]} · {timeAgo(f.createdAt)}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-3xl font-extrabold">{f.title}</h1>
              </div>
            </div>
            <p className="mt-6 leading-7 whitespace-pre-line text-muted">{f.description}</p>
            {f.screenshots?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {f.screenshots.map((s: string) => (
                  <a key={s} href={s} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(s, 300)} alt="" className="h-28 rounded-xl border border-line object-cover" />
                  </a>
                ))}
              </div>
            )}
            {f.adminReply && (
              <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
                <p className="text-sm font-bold text-brand-700 dark:text-brand-300">BrokerIQ team</p>
                <p className="mt-1 text-sm">{f.adminReply}</p>
              </div>
            )}
            <h2 className="mt-10 font-display text-lg font-bold">Discussion ({f.comments.length})</h2>
            <div className="mt-4 space-y-3">
              {f.comments.map((c: any) => (
                <div key={c.id} className="card flex gap-3 p-4">
                  <Avatar name={c.authorName} size={34} />
                  <div>
                    <p className="text-sm font-semibold">
                      {c.authorName} {c.isAdmin && <Badge tone="brand">Team</Badge>} <span className="text-xs font-normal text-subtle">{timeAgo(c.createdAt)}</span>
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {user ? (
              <div className="mt-4 space-y-2">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="अपनी राय लिखें…" />
                <Button onClick={send} loading={sending} disabled={!body.trim()}>
                  Comment
                </Button>
              </div>
            ) : (
              <Button href={`/login?next=/feedback/${id}`} variant="secondary" className="mt-4">
                Comment करने के लिए login करें
              </Button>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
