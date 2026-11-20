import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { hasDelegatedAccess, inventoryDateLabel, type OwnerSubmissionQueue } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button, ErrorView, Row, Txt } from '@/ui';
import { NativeCard } from './screen';

export function OwnerSubmissions() {
  const { user } = useAuth();
  const allowed = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view'));
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ['owner-submissions', user?.organization?.id, user?.id, page],
    queryFn: () => api<OwnerSubmissionQueue>('/inventory/owner-submissions?page=' + page),
    enabled: !!allowed,
    refetchInterval: 30_000,
  });
  if (!allowed) return null;
  const data = queue.data;
  return (
    <NativeCard style={{ gap: 8 }}>
      <Row wrap gap={8}>
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">Owner submissions</Txt>
          <Txt color="muted" v="caption">
            {data ? `${data.pendingCount} pending · ${data.ownerCount} owners` : 'Loading submissions…'}
          </Txt>
        </View>
        {data && <Button title={open ? 'Hide submissions' : 'Review submissions'} variant="secondary" size="sm" onPress={() => setOpen(!open)} />}
      </Row>
      {queue.error && <ErrorView error={queue.error} onRetry={() => queue.refetch()} />}
      {open && data && (
        <>
          {!data.items.length && <Txt color="muted">No submissions on this page.</Txt>}
          {data.items.map((item) => (
            <NativeCard key={item.id} onPress={() => router.push({ pathname: '/inventory/[id]', params: { id: item.id } })}>
              <Txt v="bodyStrong">{[item.houseNo && 'House ' + item.houseNo, item.sector].filter(Boolean).join(' · ') || 'Property'}</Txt>
              <Txt color="muted" v="caption">
                {item.ownerName}
                {item.availableFrom && ' · Available from ' + inventoryDateLabel(item.availableFrom)}
              </Txt>
            </NativeCard>
          ))}
          {(page > 1 || data.hasMore) && (
            <Row gap={8}>
              <Button title="Previous" size="sm" variant="secondary" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Button title="Next" size="sm" variant="secondary" disabled={!data.hasMore} onPress={() => setPage(page + 1)} />
            </Row>
          )}
        </>
      )}
    </NativeCard>
  );
}
