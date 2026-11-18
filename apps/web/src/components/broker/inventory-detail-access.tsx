'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type LedgerItem } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';

type AccessRequest = { agentId: string; status: string; updatedAt: string; agent: { name: string } };

export function InventoryDetailAccess({ item }: { item: LedgerItem }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const canReview =
    user?.role === 'BROKER_ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view', 'approve_details'));
  const locked = user?.role === 'BROKER_AGENT' && !['OWN', 'APPROVED'].includes(item.detailAccess ?? 'OWN');
  const refresh = () =>
    Promise.all(
      ['inventory-access', 'ledger-item', 'ledger', 'inventory-folder-items', 'visit-inventory-picker'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  const requests = useQuery({
    queryKey: ['inventory-access', item.id, user?.id],
    queryFn: () => api<AccessRequest[]>(`/inventory/${item.id}/access`),
    enabled: canReview,
  });
  const request = useApiMutation(() => api(`/inventory/${item.id}/access/request`, { method: 'POST' }), {
    success: 'Property access requested',
    onSuccess: refresh,
  });
  const review = useApiMutation(
    ({ row, action }: { row: AccessRequest; action: 'approve' | 'reject' | 'revoke' }) =>
      api(`/inventory/${item.id}/access/${row.agentId}/review`, { method: 'POST', body: { action, expectedUpdatedAt: row.updatedAt } }),
    { success: 'Property access updated', onSuccess: refresh },
  );
  if (!canReview && !locked) return null;
  return (
    <section className="card mb-4 space-y-3 p-4" aria-label="Property detail access">
      <h2 className="font-semibold">Property detail access</h2>
      {locked ? (
        <>
          <p className="text-sm text-muted">Request access to view the house number, contact details, photos and exact navigation.</p>
          <Button disabled={item.detailAccess === 'PENDING'} loading={request.isPending} onClick={() => request.mutate(undefined)}>
            {item.detailAccess === 'PENDING' ? 'Access request pending' : 'Request full property details'}
          </Button>
        </>
      ) : requests.error ? (
        <ApiErrorState error={requests.error} onRetry={() => requests.refetch()} />
      ) : requests.data?.length === 0 ? (
        <p className="text-sm text-muted">No Agent access requests for this property.</p>
      ) : (
        requests.data?.map((row) => (
          <div key={row.agentId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
            <p className="flex-1 text-sm">
              {row.agent.name} · {row.status.toLowerCase()}
            </p>
            {row.status === 'PENDING' && (
              <>
                <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ row, action: 'approve' })}>
                  Approve details
                </Button>
                <Button size="sm" variant="secondary" disabled={review.isPending} onClick={() => review.mutate({ row, action: 'reject' })}>
                  Decline
                </Button>
              </>
            )}
            {row.status === 'APPROVED' && (
              <Button size="sm" variant="secondary" disabled={review.isPending} onClick={() => review.mutate({ row, action: 'revoke' })}>
                Revoke access
              </Button>
            )}
          </div>
        ))
      )}
    </section>
  );
}
