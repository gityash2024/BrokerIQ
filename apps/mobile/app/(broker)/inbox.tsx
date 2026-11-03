import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import type { InboxPage } from '@brokeriq/shared';
import { useRealtime } from '@/lib/realtime';
import { MessagesSquare, MessageCircle, Globe, Search, CheckCheck, Check, User, Clock, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Txt, Button, ErrorView, Segmented } from '@/ui';

type Channel = 'WHATSAPP' | 'CHAT' | 'SMS' | 'EMAIL';

export default function Inbox() {
  const { c, isDark } = useTheme();
  const qc = useQueryClient();
  const [channel, setChannel] = useState<Channel>('WHATSAPP');
  const [search, setSearch] = useState('');
  const term = useDebounced(search);

  // Fetch status of WhatsApp connection
  const status = useQuery({
    queryKey: ['wa-status'],
    queryFn: () => api<any>('/whatsapp/status'),
    staleTime: 60_000,
  });

  // Fetch conversations filtered by channel
  const convs = useInfiniteQuery({
    queryKey: ['conversations', 'pages', channel, term],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<InboxPage<any>>(`/whatsapp/conversations${qs({ channel, q: term, paginated: 'true', page: pageParam, pageSize: 50 })}`),
    getNextPageParam: (last, pages) => pages.length < last.totalPages ? pages.length + 1 : undefined,
    refetchInterval: 15_000,
  });

  // Real-time wakeup
  useRealtime('wa:message', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
  });
  useRealtime('chat:message', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
  });

  useRealtime('wa:read', () => { qc.invalidateQueries({ queryKey: ['conversations'] }); });
  useRealtime('chat:read', () => { qc.invalidateQueries({ queryKey: ['conversations'] }); });
  useRealtime('wa:conversation_deleted', () => { qc.invalidateQueries({ queryKey: ['conversations'] }); });
  const list = useMemo(() => {
    const seen = new Set<string>();
    return (convs.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id); return true;
    });
  }, [convs.data]);

  return (
    <BrokerScreen title="Inbox" subtitle="WhatsApp, Website Chat, SMS और Gmail.">
      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
        {/* Channel Selector: WhatsApp vs Website Chat */}
        <Segmented
          value={channel}
          onChange={(v) => setChannel(v as Channel)}
          options={[
            { value: 'WHATSAPP', label: 'WhatsApp' },
            { value: 'CHAT', label: 'Website Chat' },
            { value: 'SMS', label: 'SMS' },
            { value: 'EMAIL', label: 'Gmail' },
          ]}
        />

        {/* Search & Status Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              height: 40,
              borderRadius: 14,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surface,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Search size={16} color={c.muted} />
            <TextInput
              placeholder={`Search ${channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : channel === 'EMAIL' ? 'Gmail' : 'Website'} conversations...`}
              placeholderTextColor={c.subtle}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, color: c.fg, fontSize: 13, padding: 0 }}
            />
          </View>

          {channel === 'WHATSAPP' && status.data && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                height: 40,
                borderRadius: 14,
                backgroundColor: status.data.connected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                borderWidth: 1,
                borderColor: status.data.connected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: status.data.connected ? c.success : c.warning,
                }}
              />
              <Txt v="caption" style={{ fontSize: 11, fontWeight: '700', color: status.data.connected ? c.success : c.warning }}>
                {status.data.connected ? 'Connected' : 'Offline'}
              </Txt>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 30 }}
        refreshing={convs.isRefetching && !convs.isFetchingNextPage}
        onRefresh={() => convs.refetch()}
        onEndReached={() => convs.hasNextPage && !convs.isFetchingNextPage && !convs.isError && convs.fetchNextPage()}
        ListFooterComponent={<View style={{ gap: 10 }}>{convs.error && list.length > 0 && <ErrorView error={convs.error} onRetry={() => convs.refetch()} />}{convs.data && <Txt v="caption" color="muted">{list.length} / {convs.data.pages[0]?.total ?? 0} conversations</Txt>}{convs.hasNextPage && <Button title="Load more conversations" loading={convs.isFetchingNextPage} onPress={() => convs.fetchNextPage()} />}</View>}
        ListEmptyComponent={
          convs.error ? (
            <ErrorView error={convs.error} onRetry={() => convs.refetch()} />
          ) : convs.isPending ? (
            <ActivityIndicator color={c.brand} style={{ padding: 40 }} />
          ) : (
            <NativeCard style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              {channel === 'WHATSAPP' ? <MessageCircle size={38} color="#25D366" /> : <Globe size={38} color={c.brand} />}
              <Txt v="title">No {channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : channel === 'EMAIL' ? 'Gmail' : 'Website'} conversations</Txt>
              <Txt color="muted" style={{ textAlign: 'center', maxWidth: 280 }}>
                {channel === 'WHATSAPP'
                  ? 'Incoming WhatsApp chats and client enquiries will appear here automatically.'
                  : channel === 'SMS' ? 'Lead के SMS action से बातचीत खोलें। केवल configured business SIM का trail यहाँ दिखेगा।' : channel === 'EMAIL' ? 'Lead के Email action से बातचीत खोलें और Gmail sync करें।' : 'Visitors chatting on your public property portal will show up here.'}
              </Txt>
            </NativeCard>
          )
        }
        renderItem={({ item }) => {
          const hasUnread = (item.unreadCount || 0) > 0;
          const title = item.contactName || item.title || item.contactPhone || 'Visitor';
          const isWhatsApp = channel === 'WHATSAPP' || item.channel === 'WHATSAPP';

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(item.channel === 'CHAT' ? `/chat/${item.id}` : `/wa/${item.id}`)}
              style={{
                padding: 14,
                borderRadius: 18,
                backgroundColor: isDark ? (hasUnread ? '#171B30' : '#121524') : hasUnread ? '#EEF2FF' : c.surface,
                borderWidth: 1,
                borderColor: hasUnread ? c.brand : isDark ? 'rgba(255,255,255,0.06)' : c.line,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Avatar Icon */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: isWhatsApp ? 'rgba(37,211,102,0.15)' : 'rgba(99,102,241,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isWhatsApp ? <MessageCircle size={22} color="#25D366" /> : <Globe size={22} color={c.brand} />}
              </View>

              {/* Message Details */}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>
                    {title}
                  </Txt>
                  {item.updatedAt && (
                    <Txt v="caption" color="muted" style={{ fontSize: 11 }}>
                      {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Txt>
                  )}
                </View>

                <Txt v="small" color={hasUnread ? undefined : 'muted'} numberOfLines={1} style={{ fontWeight: hasUnread ? '600' : '400', fontSize: 13 }}>
                  {item.lastPreview || 'No messages yet'}
                </Txt>

                {item.contactPhone && item.contactName && (
                  <Txt v="caption" color="muted" style={{ fontSize: 11 }}>
                    📞 {item.contactPhone}
                  </Txt>
                )}
              </View>

              {/* Unread Pill */}
              {hasUnread && (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: c.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 6,
                  }}
                >
                  <Txt style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{item.unreadCount}</Txt>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </BrokerScreen>
  );
}
