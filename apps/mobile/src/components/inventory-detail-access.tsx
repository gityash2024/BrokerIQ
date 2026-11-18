import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type LedgerItem } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { Button, ErrorView, Row, Txt } from '@/ui';
import { NativeCard } from '@/launch/screen';

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
    <NativeCard style={{ gap: 10 }}>
      <Txt v="h3">Property detail access</Txt>
      {locked ? (
        <>
          <Txt color="muted">Request access to view the house number, contacts, photos and exact navigation.</Txt>
          <Button
            title={item.detailAccess === 'PENDING' ? 'Access request pending' : 'Request full property details'}
            disabled={item.detailAccess === 'PENDING'}
            loading={request.isPending}
            onPress={() => request.mutate(undefined)}
          />
        </>
      ) : requests.error ? (
        <ErrorView error={requests.error} onRetry={() => requests.refetch()} />
      ) : requests.data?.length === 0 ? (
        <Txt color="muted">No Agent access requests for this property.</Txt>
      ) : (
        requests.data?.map((row) => (
          <View key={row.agentId} style={{ gap: 8 }}>
            <Txt>
              {row.agent.name} · {row.status.toLowerCase()}
            </Txt>
            <Row wrap>
              {row.status === 'PENDING' && (
                <>
                  <Button title="Approve details" size="sm" loading={review.isPending} onPress={() => review.mutate({ row, action: 'approve' })} />
                  <Button title="Decline" variant="secondary" size="sm" disabled={review.isPending} onPress={() => review.mutate({ row, action: 'reject' })} />
                </>
              )}
              {row.status === 'APPROVED' && (
                <Button
                  title="Revoke access"
                  variant="secondary"
                  size="sm"
                  disabled={review.isPending}
                  onPress={() => review.mutate({ row, action: 'revoke' })}
                />
              )}
            </Row>
          </View>
        ))
      )}
    </NativeCard>
  );
}
