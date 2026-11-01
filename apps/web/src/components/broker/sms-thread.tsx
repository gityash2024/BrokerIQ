'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { inboxDraftKey } from '@/lib/inbox-composer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { ApiErrorState } from '@/components/ui/api-error';
import { PageLoader } from '@/components/ui/misc';
import { toast } from 'sonner';

/** Shares the authorized message trail, while retaining SMS-specific queue/delivery semantics. */
export function SmsThread({ id, onRead }: { id: string; onRead: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const history = useInfiniteQuery({
    queryKey: ['sms-thread', id, user?.id],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<any>(`/whatsapp/conversations/${id}/messages${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (page) => page.nextCursor || undefined,
    refetchInterval: 10_000,
  });
  const thread = {
    ...history,
    data: useMemo(
      () => (history.data ? { ...history.data.pages[0], items: [...history.data.pages].reverse().flatMap((page) => page.items) } : undefined),
      [history.data],
    ),
  };
  const [text, setText] = useState(() => (user ? sessionStorage.getItem(inboxDraftKey(user.id, id)) || '' : ''));
  const [sending, setSending] = useState(false);
  const attempt = useRef<{ text: string; requestId: string } | null>(null);
  useRealtime<any>('wa:message', (data) => {
    if (data.conversationId === id) qc.invalidateQueries({ queryKey: ['sms-thread', id] });
  });
  useEffect(() => {
    if (user) {
      const key = inboxDraftKey(user.id, id);
      if (text) sessionStorage.setItem(key, text);
      else sessionStorage.removeItem(key);
    }
  }, [text, id, user?.id]);
  const send = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    const attemptKey = user ? inboxDraftKey(user.id, `sms-attempt:${id}`) : '';
    if (!attempt.current && attemptKey) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(attemptKey) || 'null');
        if (stored?.text === body && typeof stored?.requestId === 'string') attempt.current = stored;
      } catch {
        /* Ignore corrupt local drafts. */
      }
    }
    if (attempt.current?.text !== body) attempt.current = { text: body, requestId: crypto.randomUUID() };
    if (attemptKey) sessionStorage.setItem(attemptKey, JSON.stringify(attempt.current));
    setSending(true);
    try {
      await api('/messaging/sms/send', { body: { conversationId: id, ...attempt.current } });
      attempt.current = null;
      if (attemptKey) sessionStorage.removeItem(attemptKey);
      setText('');
      await thread.refetch();
      onRead();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };
  if (thread.isLoading) return <PageLoader />;
  if (thread.isError) return <ApiErrorState error={thread.error} onRetry={() => thread.refetch()} />;
  if (thread.data?.conversation?.channel !== 'SMS') return <p className="p-5">इस बातचीत के सही channel पर जाएँ।</p>;
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-bg/50 p-4">
        {history.hasNextPage && (
          <Button size="sm" variant="secondary" loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
            पुराने संदेश लोड करें
          </Button>
        )}
        {(thread.data?.items || []).map((message: any) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-xl border border-line p-3 ${message.direction === 'OUTBOUND' ? 'ml-auto bg-brand/10' : 'bg-surface'}`}
          >
            <p className="whitespace-pre-wrap text-sm">{message.body}</p>
            <p className="mt-2 text-xs text-muted">
              {new Date(message.createdAt).toLocaleString()} ·{' '}
              {message.status === 'QUEUED'
                ? message.meta?.dispatch === 'UNCERTAIN' || message.meta?.dispatch === 'ATTEMPTED'
                  ? 'स्थिति जाँचें · दोबारा न भेजें'
                  : 'Queue में'
                : message.status}
            </p>
            {message.error && <p className="mt-1 text-xs text-rose-600">{message.error}</p>}
          </div>
        ))}
        {!thread.data?.items?.length && <p className="py-10 text-center text-muted">अभी कोई SMS नहीं है।</p>}
      </div>
      <form
        className="space-y-2 border-t border-line p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <p className="text-xs text-muted">
          SMS Android business SIM से जाएगा। Free quota और SIM charges लागू हैं। Queue में पहुँचना delivery का प्रमाण नहीं है।
        </p>
        <Textarea value={text} maxLength={1600} disabled={sending} onChange={(event) => setText(event.target.value)} placeholder="SMS लिखें…" />
        <Button type="submit" loading={sending} disabled={!text.trim() || sending}>
          SMS भेजें
        </Button>
      </form>
    </>
  );
}
