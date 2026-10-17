import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Inbox as InboxIcon, FileText } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { WorkspaceTag } from '@/launch/workspace';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Button, Txt, ErrorView, Segmented } from '@/ui';
export default function Inbox() {
  const { c } = useTheme();
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
          ListEmptyComponent={captures.error ? <ErrorView error={captures.error} onRetry={() => captures.refetch()} /> : captures.isPending ? <ActivityIndicator color={c.brand} style={{ padding: 30 }} /> : <NativeCard><InboxIcon size={26} color={c.brand} /><Txt v="title">Your capture workspace</Txt><Txt color="muted">Share or paste a WhatsApp message to start.</Txt></NativeCard>}
          renderItem={({ item }) => (
            <NativeCard onPress={() => router.push(`/import-review/${item.id}` as any)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ padding: 10, backgroundColor: c.brandSoft, borderRadius: 12 }}><FileText size={18} color={c.brand} /></View><Txt v="title" style={{ flex: 1 }}>{item.fileName || item.groupName || 'Message capture'}</Txt></View>
              <Txt v="small" color="muted">
                {item.sourceType?.replace(/_/g, ' ')}
              </Txt>
              <Txt v="caption">
                {item._count?.entries ?? 0} entries · {new Date(item.createdAt).toLocaleDateString()}
              </Txt>
              <WorkspaceTag tone={item.status === 'FAILED' ? 'warning' : 'muted'} label={item.status?.replace(/_/g, ' ') ?? 'Not recorded'} />
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
            chats.error ? <ErrorView error={chats.error} onRetry={() => chats.refetch()} /> : chats.isPending ? <ActivityIndicator color={c.brand} style={{ padding: 30 }} /> : <NativeCard><InboxIcon size={26} color={c.brand} /><Txt v="title">No conversations yet</Txt><Txt color="muted">No conversations yet. Configure WhatsApp in Automation & Housing.</Txt></NativeCard>
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
