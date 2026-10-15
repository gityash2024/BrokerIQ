import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { localDrafts, getLocalDraft, queueDraft, decodeDraft, syncDrafts } from '@/launch/drafts';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Button, Txt, ErrorView } from '@/ui';
import { errorMessage } from '@/lib/api';
export default function Drafts() {
  const [error, setError] = useState('');
  const list = useQuery({ queryKey: ['local-drafts'], queryFn: localDrafts, refetchInterval: 3000 });
  async function retry(id: string) {
    try {
      await queueDraft(id);
      await syncDrafts();
      await list.refetch();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function edit(id: string) {
    try {
      const row = await getLocalDraft(id);
      if (!row) return;
      const body = decodeDraft(row);
      if (row.kind === 'PROPERTY_CREATE' || row.kind === 'PROPERTY_EDIT')
        router.push({ pathname: '/inventory-edit', params: { ...(body.id ? { id: body.id } : {}), draft: id } });
      else if (row.kind === 'REQUIREMENT_CREATE') router.push({ pathname: '/requirement-edit', params: { draft: id } } as any);
      else if (row.kind === 'IMPORT_REVIEW') router.push({ pathname: '/import-review/[id]', params: { id: body.batchId } } as any);
      else setError('Original capture is preserved. Retry sync after correcting configuration.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <BrokerScreen title="Saved drafts" subtitle="Pending and failed operations stay on this device." back>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        {error && <Txt color="danger">{error}</Txt>}
        <Button
          title="Sync now"
          variant="secondary"
          onPress={async () => {
            try {
              await syncDrafts();
              await list.refetch();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        />
      </View>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        ListEmptyComponent={list.error ? <ErrorView error={list.error} /> : <Txt color="muted">No saved drafts</Txt>}
        renderItem={({ item }) => (
          <NativeCard>
            <Txt v="bodyStrong">{item.kind.replace(/_/g, ' ')}</Txt>
            <Txt color={item.state === 'SYNCED' ? 'success' : item.state === 'FAILED' ? 'danger' : 'muted'}>{item.state}</Txt>
            <Txt v="caption" color="muted">
              {new Date(item.updated_at).toLocaleString()}
            </Txt>
            {item.error && (
              <Txt v="small" color="danger">
                {item.error}
              </Txt>
            )}
            {item.state === 'SYNCED' && item.server_id && (
              <Button
                title={item.kind === 'CAPTURE' ? 'Review capture' : 'Open saved record'}
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push(
                    item.kind === 'CAPTURE'
                      ? `/import-review/${item.server_id}`
                      : item.kind === 'IMPORT_REVIEW'
                        ? '/inbox'
                        : item.kind.startsWith('PROPERTY')
                          ? `/inventory/${item.server_id}`
                          : ('/requirements' as any),
                  )
                }
              />
            )}
            {item.state === 'FAILED' && <Button title="Retry" size="sm" onPress={() => retry(item.id)} />}
            {['DRAFT', 'FAILED'].includes(item.state) && <Button title="Continue editing" variant="ghost" size="sm" onPress={() => edit(item.id)} />}
          </NativeCard>
        )}
      />
    </BrokerScreen>
  );
}
