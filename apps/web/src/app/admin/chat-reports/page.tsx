'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Check, MessageSquareWarning, Unlock, X } from 'lucide-react';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const REASON: Record<string, string> = { SPAM: 'Spam', ABUSE: 'Abuse', FRAUD: 'Fraud', OTHER: 'Other' };

/** In-app chats reported by a user or a broker: read the recent messages, then dismiss, resolve, or close the chat. */
export default function ChatReportsPage() {
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const q = useQuery({ queryKey: ['chat-reports', status], queryFn: () => api<any[]>(`/admin/chat-reports?status=${status}`) });
  const inv = { invalidate: [['chat-reports'], ['admin-dashboard']] };
  const resolve = useApiMutation((b: any) => patch(`/admin/chat-reports/${b.id}`, b), { success: 'Done', ...inv });
  const block = useApiMutation((b: { id: string; blocked: boolean }) => patch(`/admin/chats/${b.id}/block`, b), { success: 'Updated', ...inv });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Reported chats" subtitle="User या broker ने जिन chats की शिकायत की — messages पढ़कर फ़ैसला करें" />
      <Segmented
        className="mb-5"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'OPEN', label: 'Open' },
          { value: 'RESOLVED', label: 'Resolved' },
          { value: 'DISMISSED', label: 'Dismissed' },
        ]}
      />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !q.data.length ? (
        <Empty icon={<MessageSquareWarning className="size-7" />} title="कोई report नहीं" />
      ) : (
        <div className="space-y-3">
          {q.data.map((r) => {
            const c = r.conversation;
            return (
              <div key={r.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{REASON[r.reason] ?? r.reason}</Badge>
                  <span className="text-sm">
                    Reported by <b data-no-i18n>{r.reporter?.name ?? 'Unknown'}</b> ({r.reporterSide === 'USER' ? 'user' : 'broker'})
                  </span>
                  {c && (
                    <span className="text-sm text-muted">
                      · <span data-no-i18n>{c.contactName ?? 'User'}</span> ↔{' '}
                      <Link href={`/brokers/${c.organization?.slug}`} target="_blank" className="hover:text-brand-600" data-no-i18n>
                        {c.organization?.name}
                      </Link>
                    </span>
                  )}
                  {c?.blockedAt && <Badge tone="warning">Chat बंद</Badge>}
                  <span className="ml-auto text-xs text-subtle">{formatDateTime(r.createdAt)}</span>
                </div>
                {r.details && (
                  <p className="text-sm text-muted" data-no-i18n>
                    “{r.details}”
                  </p>
                )}
                {r.resolution && <p className="text-xs text-subtle">Resolution: {r.resolution}</p>}
                {c && (
                  <>
                    <Button size="xs" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {open === r.id ? 'Messages छिपाएँ' : `Messages देखें (${c.messages.length})`}
                    </Button>
                    {open === r.id && (
                      <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-xl bg-surface-2 p-3 text-sm" data-no-i18n>
                        {c.messages.map((m: any) => (
                          <div key={m.id} className={cn('flex', m.direction === 'INBOUND' ? 'justify-start' : 'justify-end')}>
                            <div
                              className={cn(
                                'max-w-[80%] rounded-xl px-3 py-1.5',
                                m.direction === 'INBOUND' ? 'bg-surface' : 'bg-brand-100 dark:bg-brand-500/20',
                              )}
                            >
                              <p className="text-[10px] text-subtle">
                                {m.sender?.name ?? (m.direction === 'INBOUND' ? 'User' : 'Broker')} · {formatDateTime(m.createdAt)}
                              </p>
                              <p className="whitespace-pre-line">{m.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {status === 'OPEN' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: r.id, status: 'DISMISSED', resolution: 'No issue found' })}>
                        <X className="size-4" /> Dismiss
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: r.id, status: 'RESOLVED', resolution: 'Warned' })}>
                        <Check className="size-4" /> Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          confirm('यह chat दोनों तरफ़ से बंद करें?') &&
                          resolve.mutate({ id: r.id, status: 'RESOLVED', resolution: 'Chat closed', blockChat: true })
                        }
                      >
                        <Ban className="size-4" /> Chat बंद करें
                      </Button>
                    </>
                  )}
                  {c?.blockedAt && (
                    <Button size="sm" variant="secondary" onClick={() => block.mutate({ id: c.id, blocked: false })}>
                      <Unlock className="size-4" /> Chat फिर खोलें
                    </Button>
                  )}
                  {c?.organization && (
                    <Button size="sm" variant="ghost" href={`/admin/brokers?q=${encodeURIComponent(c.organization.name)}`}>
                      Firm देखें
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
