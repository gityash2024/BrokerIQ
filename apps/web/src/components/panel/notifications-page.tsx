'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from './shell';
import { Button } from '../ui/button';
import { Empty } from '../ui/misc';

export function NotificationsPage() {
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<any>('/me/notifications') });
  const markAll = async () => {
    await api('/me/notifications/read', { method: 'POST', body: {} });
    q.refetch();
  };
  return (
    <>
      <PageHeader title="Notifications" actions={q.data?.unreadCount ? <Button variant="secondary" size="sm" onClick={markAll}>Mark all read</Button> : null} />
      {!q.data?.items.length ? (
        <Empty icon={<Bell className="size-6" />} title="सब शांत है" text="नई leads, messages और updates यहाँ दिखेंगे।" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {q.data.items.map((n: any) => (
            <Link key={n.id} href={n.link ?? '#'} className={cn('flex gap-3 p-4 hover:bg-surface-2', !n.readAt && 'bg-brand-50/50 dark:bg-brand-500/5')}>
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-600')} />
              <div>
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-0.5 text-xs text-subtle">{timeAgo(n.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
