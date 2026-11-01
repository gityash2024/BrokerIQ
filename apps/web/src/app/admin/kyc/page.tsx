'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, Building2, Check, User, X } from 'lucide-react';
import { KycMedia } from '@/components/broker/kyc-media';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function KycPage() {
  const [status, setStatus] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [archived, setArchived] = useState(false);
  const q = useQuery({
    queryKey: ['admin-kyc', status, archived],
    queryFn: () => api<any[]>(`/admin/kyc?status=${status}&history=${archived ? 'ARCHIVED' : 'CURRENT'}`),
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useApiMutation(
    (b: { id: string; status: 'VERIFIED' | 'REJECTED' }) => patch(`/admin/kyc/${b.id}`, { status: b.status, note: notes[b.id] || undefined }),
    { success: (r: any) => (r.status === 'VERIFIED' ? 'Verified ✅' : 'Rejected'), invalidate: [['admin-kyc'], ['admin-dashboard']] },
  );
  return (
    <>
      <PageHeader
        title="KYC & verification"
        subtitle="Personal और firm documents की अलग review; सभी active firm documents approve होने पर firm verified होती है"
      />
      <Segmented
        className="mb-5"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'PENDING', label: 'Pending' },
          { value: 'VERIFIED', label: 'Verified' },
          { value: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <label className="my-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
        पुरानी / बदली हुई submissions
      </label>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !q.data.length ? (
        <Empty icon={<BadgeCheck className="size-7" />} title="कोई document नहीं" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {q.data.map((d) => {
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="card overflow-hidden"
                >
                  <div className="relative min-h-48 bg-surface-2">
                    <KycMedia src={d.fileUrl} alt={`${d.user?.name ?? d.organization?.name ?? ''} ${d.docType}`} className="h-64 w-full object-contain" />
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{d.docType.replace(/_/g, ' ')}</Badge>
                      {d.docNumber && <span className="font-mono text-xs">{d.docNumber}</span>}
                      <span className="ml-auto text-xs text-subtle">{formatDateTime(d.createdAt)}</span>
                    </div>
                    <p className="mt-3 flex items-center gap-2 font-semibold">
                      {!d.userId && d.organization ? (
                        <>
                          <Building2 className="size-4" /> {d.organization.name}
                        </>
                      ) : (
                        <>
                          <User className="size-4" /> {d.user?.name}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {!d.userId && d.organization ? `RERA: ${d.organization.reraNumber ?? '—'} · Firm status: ${d.organization.verification}` : d.user?.email}
                    </p>
                    {d.reviewNote && <p className="mt-2 text-sm text-muted">Note: {d.reviewNote}</p>}
                    {status === 'PENDING' && !d.supersededAt && (
                      <div className="mt-4 flex gap-2">
                        <Input
                          className="h-9"
                          placeholder="अस्वीकृति का कारण जरूरी है"
                          value={notes[d.id] ?? ''}
                          onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!notes[d.id]?.trim() || review.isPending}
                          onClick={() => review.mutate({ id: d.id, status: 'REJECTED' })}
                        >
                          <X className="size-4" />
                        </Button>
                        <Button size="sm" variant="success" onClick={() => review.mutate({ id: d.id, status: 'VERIFIED' })}>
                          <Check className="size-4" /> Verify
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
