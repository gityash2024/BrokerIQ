import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { localDrafts, getLocalDraft, queueDraft, decodeDraft, syncDrafts, preservedDraftCounts, claimGuestCaptures, holdFailedTask } from '@/launch/drafts';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Button, Txt, ErrorView } from '@/ui';
import { errorMessage } from '@/lib/api';
export default function Drafts() {
  const [error, setError] = useState('');
  const list = useInfiniteQuery({
    queryKey: ['local-drafts'],
    initialPageParam: undefined as { id: string; updated_at: number } | undefined,
    queryFn: ({ pageParam }) => localDrafts(pageParam),
    getNextPageParam: (page) => (page.length === 50 ? page.at(-1) : undefined),
    refetchInterval: 3000,
  });
  const preserved = useQuery({ queryKey: ['preserved-draft-counts'], queryFn: preservedDraftCounts, refetchInterval: 3000 });
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
      else if (row.kind === 'PUBLIC_PUBLISH') router.push({ pathname: '/publish-rental', params: { id: row.draft_key } } as any);
      else if (row.kind === 'REQUIREMENT_CREATE' || row.kind === 'REQUIREMENT_EDIT')
        router.push({ pathname: '/requirement-edit', params: { draft: id, ...(body.id ? { id: body.id } : {}) } } as any);
      else if (row.kind === 'IMPORT_REVIEW') router.push({ pathname: '/import-review/[id]', params: { id: body.batchId } } as any);
      else if (row.kind === 'CAPTURE_COMPOSE') router.push('/capture');
      else setError('Original capture is preserved. Retry sync after correcting configuration.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <BrokerScreen title="Saved drafts" subtitle="Pending and failed operations stay on this device." back>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        {error && <Txt color="danger">{error}</Txt>}
        {!!preserved.data?.legacy && (
          <Txt color="muted">
            {preserved.data.legacy} older drafts are preserved in encrypted storage. Their firm and role are unknown, so automatic sync is paused. Contact
            support for ownership review; do not uninstall or clear app data.
          </Txt>
        )}
        {!!preserved.data?.guest && (
          <Button
            title="Assign shared captures to this workspace"
            variant="secondary"
            onPress={async () => {
              try {
                await claimGuestCaptures();
                await syncDrafts();
                await Promise.all([list.refetch(), preserved.refetch()]);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          />
        )}
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
        data={list.data?.pages.flat() ?? []}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListFooterComponent={list.hasNextPage ? <Button title="Load more" onPress={() => list.fetchNextPage()} /> : null}
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
                      : item.kind === 'PUBLIC_PUBLISH'
                        ? `/property/${item.server_id}`
                        : item.kind === 'IMPORT_REVIEW'
                          ? '/inbox'
                          : item.kind === 'FOLLOW_UP_CREATE' || item.kind === 'SITE_VISIT_CREATE'
                            ? `/lead/${item.draft_key}`
                            : item.kind.startsWith('PROPERTY')
                              ? `/inventory/${item.server_id}`
                              : ('/requirements' as any),
                  )
                }
              />
            )}
            {(item.state === 'FAILED' || (item.state === 'DRAFT' && ['FOLLOW_UP_CREATE', 'SITE_VISIT_CREATE'].includes(item.kind))) && (
              <Button title="Retry" size="sm" onPress={() => retry(item.id)} />
            )}
            {item.state === 'FAILED' && ['FOLLOW_UP_CREATE', 'SITE_VISIT_CREATE'].includes(item.kind) && (
              <Button
                title="Set aside and keep draft"
                variant="secondary"
                size="sm"
                onPress={async () => {
                  try {
                    await holdFailedTask(item.id);
                    await list.refetch();
                  } catch (failure) {
                    setError(errorMessage(failure));
                  }
                }}
              />
            )}
            {['DRAFT', 'FAILED'].includes(item.state) && !['FOLLOW_UP_CREATE', 'SITE_VISIT_CREATE'].includes(item.kind) && (
              <Button title="Continue editing" variant="ghost" size="sm" onPress={() => edit(item.id)} />
            )}
          </NativeCard>
        )}
      />
    </BrokerScreen>
  );
}
