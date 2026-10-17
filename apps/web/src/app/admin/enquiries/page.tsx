'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
export default function Enquiries() {
  const q = useQuery({ queryKey: ['admin-enquiries'], queryFn: () => api<any>('/enquiries/admin/all') });
  return (
    <>
      <PageHeader title="Customer enquiries" subtitle="Enquiries sent through public rental listings" />
      {q.error ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="card divide-y divide-line">
          {(q.data?.items ?? q.data ?? []).map((r: any) => (
            <div key={r.id} className="flex flex-wrap justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">{r.listing?.title ?? r.name}</p>
                <p className="mt-1 text-xs text-muted">{r.message || r.status}</p>
              </div>
              <time className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('en-IN')}</time>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
