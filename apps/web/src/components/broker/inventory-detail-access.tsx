'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type LedgerItem } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';

type AccessRequest = { agentId: string; status: string; updatedAt: string; expiresAt?: string | null; agent: { name: string } };

export function InventoryDetailAccess({ item }: { item: LedgerItem }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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
  const agents = useQuery({
    queryKey: ['inventory-access-agents', item.id, user?.id],
    queryFn: () => api<{ id: string; name: string }[]>(`/inventory/${item.id}/access/agents`),
    enabled: canReview && selecting,
  });
  const grant = useApiMutation(() => api(`/inventory/${item.id}/access/grant`, { method: 'POST', body: { agentIds: selected } }), {
    success: 'Property access updated',
    onSuccess: async () => {
      setSelected([]);
      setSelecting(false);
      await refresh();
    },
  });
  const toggleAgent = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((agentId) => agentId !== id) : current.length < 30 ? [...current, id] : current));
  if (!canReview && !locked) {
    if (!item.detailAccessExpiresAt) return null;
    const until = new Date(item.detailAccessExpiresAt).toLocaleString('en-IN');
    return <p className="mb-3 text-sm text-muted">Full details available until {until}</p>;
  }
  return (
    <section className="card mb-3 space-y-2 p-4" aria-label="Property detail access">
      <h2 className="font-semibold">Property detail access</h2>
      {canReview && (
        <div className="space-y-2">
          <Button size="sm" variant={selecting ? 'secondary' : 'primary'} onClick={() => setSelecting(!selecting)}>
            {!selecting && <Users className="size-4" />}
            {selecting ? 'Close agent selection' : 'Give agents 12-hour access'}
          </Button>
          {selecting && (
            <div className="space-y-2">
              {agents.error && <ApiErrorState error={agents.error} onRetry={() => agents.refetch()} />}
              {agents.isLoading && <p className="text-sm text-muted">Loading agents…</p>}
              {agents.data?.length === 0 && <p className="text-sm text-muted">No eligible agents.</p>}
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {agents.data?.map((agent) => (
                  <label key={agent.id} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" checked={selected.includes(agent.id)} onChange={() => toggleAgent(agent.id)} />
                    {agent.name}
                  </label>
                ))}
              </div>
              <Button size="sm" disabled={!selected.length} loading={grant.isPending} onClick={() => grant.mutate(undefined)}>
                Grant 12-hour access
              </Button>
            </div>
          )}
        </div>
      )}
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
              {row.status === 'APPROVED' && row.expiresAt ? ' · until ' + new Date(row.expiresAt).toLocaleString('en-IN') : ''}
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
