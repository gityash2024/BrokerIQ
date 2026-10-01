import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bell, CheckCheck } from 'lucide-react-native';
import { timeAgo, type NotificationsResponse } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { openLink } from '@/lib/links';
import { Empty, ErrorView, Header, IconBtn, PressableScale, Screen, Skeleton, Txt } from '@/ui';

export default function Notifications() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationsResponse>('/me/notifications') });
  useRealtime('notification', () => q.refetch());
  const readAll = async () => {
    await post('/me/notifications/read', {}).catch(() => undefined);
    q.refetch();
  };
  return (
    <Screen scroll={false} padded={false}>
      <Header
        title="Notifications"
        right={
          <IconBtn onPress={readAll}>
            <CheckCheck size={20} color={c.brand} />
          </IconBtn>
        }
      />
      {q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(n) => n.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            q.isLoading ? (
              <View style={{ padding: 16, gap: 10 }}>
                <Skeleton h={60} />
                <Skeleton h={60} />
              </View>
            ) : (
              <Empty icon={<Bell size={28} color={c.brand} />} title="कोई notification नहीं" />
            )
          }
          renderItem={({ item: n, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
              <PressableScale
                onPress={() => {
                  if (!n.readAt)
                    post('/me/notifications/read', { ids: [n.id] })
                      .then(() => q.refetch())
                      .catch(() => undefined);
                  openLink(n.link);
                }}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderColor: c.line,
                  backgroundColor: n.readAt ? 'transparent' : c.brandSoft,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: n.readAt ? 'transparent' : c.brand }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bodyStrong">{n.title}</Txt>
                  {!!n.body && (
                    <Txt v="small" color="muted" numberOfLines={3}>
                      {n.body}
                    </Txt>
                  )}
                  <Txt v="caption" color="subtle">
                    {timeAgo(n.createdAt)}
                  </Txt>
                </View>
              </PressableScale>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}
