'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Send } from 'lucide-react';
import { toast } from 'sonner';
import { CONTENT_REPORT_REASONS } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field, Input, Select, Textarea } from '../ui/field';
import { PageLoader } from '../ui/misc';

const REASON_LABEL: Record<(typeof CONTENT_REPORT_REASONS)[number], string> = {
  SPAM: 'Spam / बेमतलब messages',
  ABUSE: 'गाली-गलौज / बदतमीज़ी',
  FRAUD: 'Fraud / पैसे माँगना',
  OTHER: 'कुछ और',
};

/** Report a chat to the BrokerIQ team (either side). */
function ReportChat({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ reason: (typeof CONTENT_REPORT_REASONS)[number]; details: string }>({ reason: 'SPAM', details: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/chat/threads/${id}/report`, { method: 'POST', body: { reason: f.reason, details: f.details || undefined } });
      toast.success('Report भेज दी — team इसे देखेगी');
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        <Flag className="size-3.5" /> Report
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Chat report करें"
        description="BrokerIQ team यह chat देखकर कार्रवाई करेगी। आपकी पहचान दूसरी तरफ़ नहीं बताई जाती।"
        footer={
          <Button variant="danger" loading={busy} onClick={submit}>
            Report भेजें
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="कारण">
            <Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value as typeof f.reason })}>
              {CONTENT_REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="क्या हुआ? (optional)">
            <Textarea rows={3} maxLength={1000} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** In-app chat thread (user ↔ broker). `side` decides bubble alignment. */
export function ChatThread({ id, side }: { id: string; side: 'user' | 'broker' }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['chat', id], queryFn: () => api<any>(`/chat/threads/${id}`) });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useRealtime<any>('chat:message', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['chat', id] }));
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [q.data?.items.length]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(`/chat/threads/${id}`, { method: 'POST', body: { text } });
      setText('');
      q.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  if (q.isLoading) return <PageLoader />;
  const mine = (m: any) => (side === 'user' ? m.direction === 'INBOUND' : m.direction === 'OUTBOUND');
  const blocked = !!q.data?.conversation?.blockedAt;
  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end border-b border-line px-3 py-1">
        <ReportChat id={id} />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {q.data?.items.map((m: any) => (
          <div key={m.id} className={cn('flex', mine(m) ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                mine(m) ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-surface-2',
              )}
            >
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={cn('mt-1 text-[10px]', mine(m) ? 'text-white/70' : 'text-subtle')}>{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {blocked ? (
        <p className="border-t border-line p-3 text-center text-sm text-muted">यह chat BrokerIQ team ने बंद कर दी है।</p>
      ) : (
        <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message लिखें…" />
          <Button type="submit" size="icon" loading={sending} aria-label="Send">
            {!sending && <Send className="size-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}
