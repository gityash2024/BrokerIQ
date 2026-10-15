import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Button, Txt, ErrorView, Segmented } from '@/ui';
export default function Inbox() {
  const [mode, setMode] = useState('CAPTURES');
  const captures = useInfiniteQuery({
    queryKey: ['imports'],
    queryFn: ({ pageParam }) => api<any>(`/imports?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
    refetchInterval: 10000,
  });
  const chats = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: () => api<any[]>('/whatsapp/conversations?channel=WHATSAPP'),
    enabled: mode === 'WHATSAPP',
  });
  const status = useQuery({ queryKey: ['wa-status'], queryFn: () => api<any>('/whatsapp/status'), enabled: mode === 'WHATSAPP' });
  return (
    <BrokerScreen title="Inbox" subtitle="Capture, review and conversations.">
      <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
        <Button title="Capture message / image" onPress={() => router.push('/capture')} />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'CAPTURES', label: 'Captures' },
            { value: 'WHATSAPP', label: 'WhatsApp' },
          ]}
        />
        {mode === 'WHATSAPP' && (
          <Txt v="caption" color="muted">
            {status.data?.connected ? 'Credentials configured' : 'WhatsApp not configured'}
          </Txt>
        )}
      </View>
      {mode === 'CAPTURES' ? (
        <FlatList
          data={captures.data?.pages.flatMap((p) => p.items) ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshing={captures.isRefetching}
          onRefresh={() => captures.refetch()}
          onEndReached={() => captures.hasNextPage && !captures.isFetchingNextPage && captures.fetchNextPage()}
          ListEmptyComponent={captures.error ? <ErrorView error={captures.error} /> : <Txt color="muted">Share or paste a WhatsApp message to start.</Txt>}
          renderItem={({ item }) => (
            <NativeCard onPress={() => router.push(`/import-review/${item.id}` as any)}>
              <Txt v="bodyStrong">{item.fileName || item.groupName || 'Message capture'}</Txt>
              <Txt v="small" color="muted">
                {item.sourceType} · {item.status}
              </Txt>
              <Txt v="caption">
                {item._count.entries} entries · {new Date(item.createdAt).toLocaleDateString()}
              </Txt>
              {item.lastError && (
                <Txt color="danger" v="small">
                  {item.lastError}
                </Txt>
              )}
            </NativeCard>
          )}
        />
      ) : (
        <FlatList
          data={chats.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshing={chats.isRefetching}
          onRefresh={() => chats.refetch()}
          ListEmptyComponent={
            chats.error ? <ErrorView error={chats.error} /> : <Txt color="muted">No conversations yet. Configure WhatsApp in Automation & Housing.</Txt>
          }
          renderItem={({ item }) => (
            <NativeCard onPress={() => router.push(`/wa/${item.id}`)}>
              <Txt v="bodyStrong">{item.contactName || item.contactPhone}</Txt>
              <Txt v="small" color="muted" numberOfLines={2}>
                {item.lastPreview || 'No message preview'}
              </Txt>
              <Txt v="caption">{item.unreadCount || 0} unread</Txt>
            </NativeCard>
          )}
        />
      )}
    </BrokerScreen>
  );
}
