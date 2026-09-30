'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, Building2, Check, ExternalLink, FileText, User, X } from 'lucide-react';
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
  const q = useQuery({ queryKey: ['admin-kyc', status], queryFn: () => api<any[]>(`/admin/kyc?status=${status}`) });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useApiMutation(
    (b: { id: string; status: 'VERIFIED' | 'REJECTED' }) => patch(`/admin/kyc/${b.id}`, { status: b.status, note: notes[b.id] || undefined }),
    { success: (r: any) => (r.status === 'VERIFIED' ? 'Verified ✅' : 'Rejected'), invalidate: [['admin-kyc'], ['admin-dashboard']] },
  );
  return (
    <>
      <PageHeader title="KYC & verification" subtitle="Broker RERA / GST और owner property documents — verify करने पर Verified badge मिलता है" />
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
              const isPdf = /\.pdf($|\?)/i.test(d.fileUrl);
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="card overflow-hidden"
                >
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="group relative block h-48 bg-surface-2">
                    {isPdf ? (
                      <div className="grid h-full place-items-center text-muted">
                        <FileText className="size-10" />
                      </div>
                    ) : (
                      <img src={d.fileUrl} alt="" className="h-full w-full object-contain" />
                    )}
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-slate-900/70 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                      <ExternalLink className="size-3" /> Open
                    </span>
                  </a>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{d.docType.replace(/_/g, ' ')}</Badge>
                      {d.docNumber && <span className="font-mono text-xs">{d.docNumber}</span>}
                      <span className="ml-auto text-xs text-subtle">{formatDateTime(d.createdAt)}</span>
                    </div>
                    <p className="mt-3 flex items-center gap-2 font-semibold">
                      {d.organization ? (
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
                      {d.organization ? `RERA: ${d.organization.reraNumber ?? '—'} · Firm status: ${d.organization.verification}` : d.user?.email}
                    </p>
                    {d.reviewNote && <p className="mt-2 text-sm text-muted">Note: {d.reviewNote}</p>}
                    {status === 'PENDING' && (
                      <div className="mt-4 flex gap-2">
                        <Input
                          className="h-9"
                          placeholder="Note (optional, user को दिखेगा)"
                          value={notes[d.id] ?? ''}
                          onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                        />
                        <Button size="sm" variant="secondary" onClick={() => review.mutate({ id: d.id, status: 'REJECTED' })}>
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
