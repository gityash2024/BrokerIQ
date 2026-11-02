'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { readInboxDraft, saveInboxDraft } from '@/lib/inbox-drafts';
import { useInboxDraft } from '@/lib/use-inbox-draft';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { ApiErrorState } from '@/components/ui/api-error';
import { PageLoader } from '@/components/ui/misc';
import { toast } from 'sonner';

/** Shares the authorized message trail, while retaining SMS-specific queue/delivery semantics. */
export function SmsThread({ id, onRead, channel = 'SMS' }: { id: string; onRead: () => void; channel?: 'SMS' | 'EMAIL' }) {
  const { user } = useAuth();
  const email = channel === 'EMAIL';
  const [subject, setSubject] = useState('Property enquiry');
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [syncCursor, setSyncCursor] = useState<string | null>(null);
  const qc = useQueryClient();
  const history = useInfiniteQuery({
    queryKey: ['provider-thread', channel, id, user?.id],
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
  const draft = useInboxDraft(id);
  const { text, setText, ready, legacy, owner } = draft;
  const sendLock = useRef(false);
  const [sending, setSending] = useState(false);
  const attempt = useRef<{ text: string; requestId: string; subject?: string; replyToId?: string } | null>(null);
  useRealtime<any>('wa:message', (data) => {
    if (data.conversationId === id) qc.invalidateQueries({ queryKey: ['provider-thread', channel, id] });
  });
  const send = async () => {
    if (!ready || !text.trim() || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    const body = text.trim(),
      attemptKey = `provider-attempt:${id}`;
    try {
      await draft.flush();
      if (!attempt.current) {
        const raw = await readInboxDraft(attemptKey, owner);
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored?.text === body && (!email || (stored?.subject === subject && stored?.replyToId === replyToId)) && typeof stored?.requestId === 'string')
            attempt.current = stored;
        }
      }
      if (attempt.current?.text !== body || (email && (attempt.current?.subject !== subject || attempt.current?.replyToId !== replyToId)))
        attempt.current = { text: body, requestId: crypto.randomUUID(), ...(email ? { subject, ...(replyToId ? { replyToId } : {}) } : {}) };
      await saveInboxDraft(attemptKey, JSON.stringify(attempt.current), owner);
      await api(email ? '/messaging/email/send' : '/messaging/sms/send', { body: { conversationId: id, ...attempt.current }, ownerContext: owner });
      await saveInboxDraft(attemptKey, '', owner);
      attempt.current = null;
      await draft.clear();
      setReplyToId(undefined);
      await thread.refetch();
      onRead();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };
  if (thread.isLoading) return <PageLoader />;
  if (thread.isError) return <ApiErrorState error={thread.error} onRetry={() => thread.refetch()} />;
  if (thread.data?.conversation?.channel !== channel) return <p className="p-5">इस बातचीत के सही channel पर जाएँ।</p>;
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-bg/50 p-4">
        {email && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  const result = await api<any>(`/messaging/email/${id}/sync`, { body: { ...(syncCursor ? { cursor: syncCursor } : {}) } });
                  setSyncCursor(result.nextCursor);
                  await thread.refetch();
                  onRead();
                  toast.success(`${result.imported} emails जोड़े गए`);
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setSyncing(false);
                }
              }}
            >
              {syncCursor ? 'अगली client emails sync करें' : 'Client emails sync करें'}
            </Button>
          </div>
        )}
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
            {email && message.meta?.subject && <p className="mb-1 font-semibold">{message.meta.subject}</p>}
            <p className="whitespace-pre-wrap text-sm">{message.body}</p>
            {email && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setReplyToId(message.id);
                  setSubject(/^Re:/i.test(message.meta?.subject || '') ? message.meta.subject : `Re: ${message.meta?.subject || 'Property enquiry'}`);
                }}
              >
                Reply
              </Button>
            )}
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
        {!thread.data?.items?.length && <p className="py-10 text-center text-muted">अभी कोई संदेश नहीं है।</p>}
      </div>
      <form
        className="space-y-2 border-t border-line p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <p className="text-xs text-muted">
          {email
            ? 'Email firm के connected Gmail से जाएगा। Sent status provider acceptance है; read/delivery tracking का दावा नहीं है।'
            : 'SMS Android business SIM से जाएगा। Free quota और SIM charges लागू हैं। Queue में पहुँचना delivery का प्रमाण नहीं है।'}
        </p>
        {email && (
          <Input aria-label="Email subject" placeholder="Subject" value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} />
        )}
        {legacy && (
          <p className="text-xs text-muted">An older message draft is preserved. Its firm and role need review; this composer creates a separate draft.</p>
        )}
        <Textarea
          value={text}
          maxLength={email ? 20_000 : 1600}
          disabled={sending || !ready}
          onChange={(event) => setText(event.target.value)}
          placeholder={email ? 'Email लिखें…' : 'SMS लिखें…'}
        />
        <Button type="submit" loading={sending} disabled={!ready || !text.trim() || sending}>
          {email ? 'Email भेजें' : 'SMS भेजें'}
        </Button>
      </form>
    </>
  );
}
