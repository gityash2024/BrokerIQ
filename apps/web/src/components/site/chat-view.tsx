'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/field';
import { PageLoader } from '../ui/misc';

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
    } finally {
      setSending(false);
    }
  };
  if (q.isLoading) return <PageLoader />;
  const mine = (m: any) => (side === 'user' ? m.direction === 'INBOUND' : m.direction === 'OUTBOUND');
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {q.data?.items.map((m: any) => (
          <div key={m.id} className={cn('flex', mine(m) ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine(m) ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-surface-2')}>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={cn('mt-1 text-[10px]', mine(m) ? 'text-white/70' : 'text-subtle')}>{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message लिखें…" />
        <Button type="submit" size="icon" loading={sending} aria-label="Send">
          {!sending && <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
