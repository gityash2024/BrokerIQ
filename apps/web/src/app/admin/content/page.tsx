'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Eye, EyeOff, Megaphone, Star, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

/** Moderation of user-written content: broker reviews and flatmate profiles. */
export default function ContentModerationPage() {
  const [tab, setTab] = useState<'reviews' | 'flatmates' | 'campaigns'>('reviews');
  return (
    <>
      <PageHeader title="Content moderation" subtitle="गलत, अपमानजनक या fake content छिपाएँ या हटाएँ; spam वाले broker campaigns तुरंत रोकें" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'reviews', label: 'Broker reviews' },
          { value: 'flatmates', label: 'Flatmate profiles' },
          { value: 'campaigns', label: 'Broker campaigns' },
        ]}
      />
      <div className="mt-5">{tab === 'reviews' ? <Reviews /> : tab === 'flatmates' ? <Flatmates /> : <Campaigns />}</div>
    </>
  );
}

function Reviews() {
  const [status, setStatus] = useState<'' | 'PUBLISHED' | 'HIDDEN'>('');
  const q = useQuery({ queryKey: ['admin-reviews', status], queryFn: () => api<any[]>(`/admin/reviews${status ? `?status=${status}` : ''}`) });
  const set = useApiMutation((b: { id: string; status: string }) => patch(`/admin/reviews/${b.id}`, { status: b.status }), {
    success: 'Updated',
    invalidate: [['admin-reviews']],
  });
  const remove = useApiMutation((id: string) => del(`/admin/reviews/${id}`), { success: 'Review हटाया', invalidate: [['admin-reviews']] });
  return (
    <>
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: '', label: 'All' },
          { value: 'PUBLISHED', label: 'Published' },
          { value: 'HIDDEN', label: 'Hidden' },
        ]}
      />
      <div className="mt-4">
        {q.isError ? (
          <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <Skeleton className="h-48" />
        ) : !q.data.length ? (
          <Empty icon={<Star className="size-6" />} title="कोई review नहीं" />
        ) : (
          <div className="space-y-3">
            {q.data.map((r) => (
              <div key={r.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-amber-600">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </span>
                    <Link href={`/brokers/${r.organization.slug}`} target="_blank" className="font-semibold hover:text-brand-600" data-no-i18n>
                      {r.organization.name}
                    </Link>
                    {r.status === 'HIDDEN' && <Badge tone="warning">Hidden</Badge>}
                  </div>
                  {r.comment && (
                    <p className="mt-1" data-no-i18n>
                      {r.comment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    <span data-no-i18n>{r.user?.name}</span> · {r.user?.email} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'PUBLISHED' ? (
                    <Button size="sm" variant="secondary" onClick={() => set.mutate({ id: r.id, status: 'HIDDEN' })}>
                      <EyeOff className="size-4" /> Hide
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => set.mutate({ id: r.id, status: 'PUBLISHED' })}>
                      <Eye className="size-4" /> Publish
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => confirm('Review हमेशा के लिए हटाएँ?') && remove.mutate(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Flatmates() {
  const q = useQuery({ queryKey: ['admin-flatmates'], queryFn: () => api<any[]>('/admin/flatmates') });
  const set = useApiMutation((b: { id: string; isActive: boolean }) => patch(`/admin/flatmates/${b.id}`, { isActive: b.isActive }), {
    success: 'Updated',
    invalidate: [['admin-flatmates']],
  });
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton className="h-48" />;
  if (!q.data.length) return <Empty icon={<Users className="size-6" />} title="कोई flatmate profile नहीं" />;
  return (
    <div className="space-y-3">
      {q.data.map((p) => (
        <div key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold" data-no-i18n>
              {p.user?.name ?? '—'}{' '}
              <span className="text-xs font-normal text-muted">
                {p.user?.email} · {p.user?.phone}
              </span>
            </p>
            <p className="text-xs text-muted">
              {p.lookingFor} · {p.gender} · {p.occupation ?? '—'}
              {p.budgetMax ? ` · ₹${p.budgetMax.toLocaleString('en-IN')}` : ''}
            </p>
            {p.about && (
              <p className="mt-1 line-clamp-2" data-no-i18n>
                {p.about}
              </p>
            )}
          </div>
          <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Visible' : 'Hidden'}</Badge>
          <Button size="sm" variant="secondary" onClick={() => set.mutate({ id: p.id, isActive: !p.isActive })}>
            {p.isActive ? (
              <>
                <EyeOff className="size-4" /> Hide
              </>
            ) : (
              <>
                <Eye className="size-4" /> Show
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Kill switch: BrokerIQ team can see every broker broadcast and stop a spammy one mid-way. */
function Campaigns() {
  const [status, setStatus] = useState<'' | 'RUNNING' | 'DONE' | 'CANCELLED'>('RUNNING');
  const q = useQuery({
    queryKey: ['admin-campaigns', status],
    queryFn: () => api<any[]>(`/admin/campaigns${status ? `?status=${status}` : ''}`),
    refetchInterval: 10_000,
  });
  const stop = useApiMutation((id: string) => post(`/admin/campaigns/${id}/cancel`), { success: 'Campaign रोक दिया', invalidate: [['admin-campaigns']] });
  return (
    <>
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: 'RUNNING', label: 'Running' },
          { value: 'DONE', label: 'Done' },
          { value: 'CANCELLED', label: 'Stopped' },
          { value: '', label: 'All' },
        ]}
      />
      <div className="mt-4">
        {q.isError ? (
          <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <Skeleton className="h-48" />
        ) : !q.data.length ? (
          <Empty icon={<Megaphone className="size-6" />} title="कोई campaign नहीं" />
        ) : (
          <div className="space-y-3">
            {q.data.map((c) => (
              <div key={c.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold" data-no-i18n>
                    {c.name}
                  </p>
                  <p className="text-xs text-muted">
                    <Link href={`/brokers/${c.organization.slug}`} target="_blank" className="hover:text-brand-600" data-no-i18n>
                      {c.organization.name}
                    </Link>{' '}
                    · {c.channel} · {formatDate(c.createdAt)} · {c.sent}/{c.total} भेजे{c.failed ? ` · ${c.failed} failed` : ''}
                  </p>
                </div>
                <Badge tone={c.status === 'RUNNING' ? 'warning' : c.status === 'DONE' ? 'success' : 'neutral'}>{c.status}</Badge>
                {c.status === 'RUNNING' && (
                  <Button size="sm" variant="danger" onClick={() => confirm('यह campaign अभी रोकें?') && stop.mutate(c.id)}>
                    <Ban className="size-4" /> रोकें
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
