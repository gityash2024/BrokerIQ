'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { ChatThread } from '@/components/site/chat-view';
import { Avatar, Empty } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const active = sp.get('c');
  const q = useQuery({ queryKey: ['chat-threads'], queryFn: () => api<any[]>('/chat/threads'), refetchInterval: 30_000 });
  return (
    <>
      <PageHeader title="Messages" subtitle="Brokers के साथ आपकी बातचीत" />
      {!q.data?.length ? (
        <Empty icon={<MessagesSquare className="size-6" />} title="कोई conversation नहीं" text="Property page पर “Chat” दबाकर broker से बात शुरू करें।" action={<Button href="/buy">Properties देखें</Button>} />
      ) : (
        <div className="card grid h-[70vh] overflow-hidden md:grid-cols-[300px_1fr]">
          <div className={cn('overflow-y-auto border-r border-line', active && 'hidden md:block')}>
            {q.data.map((c) => (
              <button key={c.id} onClick={() => router.replace(`/account/messages?c=${c.id}`)} className={cn('flex w-full items-center gap-3 border-b border-line p-4 text-left hover:bg-surface-2', active === c.id && 'bg-brand-50 dark:bg-brand-500/10')}>
                <Avatar name={c.organization?.name} src={c.organization?.logoUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.organization?.name}</p>
                  <p className="truncate text-xs text-muted">{c.lastPreview}</p>
                </div>
                <span className="text-[10px] text-subtle">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
              </button>
            ))}
          </div>
          <div className={cn('min-h-0', !active && 'hidden md:block')}>
            {active ? <ChatThread id={active} side="user" /> : <div className="grid h-full place-items-center text-sm text-muted">Conversation चुनें</div>}
          </div>
        </div>
      )}
    </>
  );
}
export default function MessagesPage() {
  return <Suspense><Inner /></Suspense>;
}
