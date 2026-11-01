'use client';
import Link from 'next/link';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { Bell } from 'lucide-react';
import { timeAgo, type NotificationsResponse } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from './shell';
import { Button } from '../ui/button';
import { Empty } from '../ui/misc';

export function NotificationsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['notifications', user?.id, 'list'],
    initialPageParam: '',
    enabled: !!user,
    queryFn: ({ pageParam }) => api<NotificationsResponse>('/me/notifications' + (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : '')),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  useRealtime('notification', () => client.invalidateQueries({ queryKey: ['notifications'] }));
  const markAll = async () => {
    setBusy(true);
    try {
      await api('/me/notifications/read', { method: 'POST', body: {} });
      await client.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          q.data?.pages[0]?.unreadCount ? (
            <Button variant="secondary" size="sm" onClick={markAll} disabled={busy}>
              Mark all read
            </Button>
          ) : null
        }
      />
      {q.isError ? (
        <p role="alert" className="p-4">
          {q.error.message} <button onClick={() => q.refetch()}>Retry</button>
        </p>
      ) : q.isLoading ? (
        <p className="p-4">Loading notifications…</p>
      ) : !items.length ? (
        <Empty icon={<Bell className="size-6" />} title="सब शांत है" text="नई leads, messages और updates यहाँ दिखेंगे।" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {items.map((n) => (
            <Link
              key={n.id}
              href={'/notification?notification=' + encodeURIComponent(n.id)}
              className={cn('flex gap-3 p-4 hover:bg-surface-2', !n.readAt && 'bg-brand-50/50 dark:bg-brand-500/5')}
            >
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
      {q.hasNextPage && (
        <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          Load more
        </Button>
      )}
    </>
  );
}
