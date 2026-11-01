import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react-native';
import { timeAgo, type AppNotification, type NotificationsResponse } from '@brokeriq/shared';
import { api, authStore, errorMessage, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { openLink } from '@/lib/links';
import { toast } from '@/lib/toast';
import { Button, Empty, ErrorView, Header, IconBtn, PressableScale, Screen, Skeleton, Txt } from '@/ui';

export default function Notifications() {
  const { c } = useTheme();
  const { user } = useAuth();
  const userId = user?.id;
  const { notification } = useLocalSearchParams<{ notification?: string }>();
  const config = useConfig();
  const client = useQueryClient();
  const opened = useRef('');
  const currentNotification = useRef(notification);
  currentNotification.current = notification;
  const [busy, setBusy] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['notifications', user?.id, 'list'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<NotificationsResponse>('/me/notifications' + (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : '')),
    getNextPageParam: (last) => last.nextCursor || undefined,
    enabled: !!user,
  });
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['notifications'] }), [client]);
  useRealtime('notification', refresh);
  const open = useCallback(
    async (id: string) => {
      if (!userId || busy || !config.loaded) return;
      setBusy(true);
      try {
        const note = await post<AppNotification>(`/me/notifications/${encodeURIComponent(id)}/open`, {});
        if (authStore.get()?.user.id !== userId) return;
        await refresh();
        if (authStore.get()?.user.id !== userId) return;
        if (currentNotification.current === id) router.setParams({ notification: undefined });
        openLink(note.link);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [userId, busy, config.loaded, refresh],
  );
  useEffect(() => {
    if (notification && userId && !busy && config.loaded && opened.current !== `${userId}:${notification}`) {
      opened.current = `${userId}:${notification}`;
      void open(notification);
    }
  }, [notification, userId, busy, config.loaded, open]);
  const readAll = async () => {
    setBusy(true);
    try {
      await post('/me/notifications/read', {});
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen scroll={false} padded={false}>
      <Header
        title="Notifications"
        right={
          <IconBtn accessibilityLabel="Mark all read" onPress={busy || !user ? undefined : readAll}>
            <CheckCheck size={20} color={c.brand} />
          </IconBtn>
        }
      />
      {!user ? (
        <Empty title="Notifications देखने के लिए sign in करें" action={<Button title="Sign in" onPress={() => router.push('/login')} />} />
      ) : q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={q.data?.pages.flatMap((p) => p.items) ?? []}
          keyExtractor={(n) => n.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            q.isLoading ? (
              <View style={{ padding: 16 }}>
                <Skeleton h={60} />
              </View>
            ) : (
              <Empty icon={<Bell size={28} color={c.brand} />} title="कोई notification नहीं" />
            )
          }
          ListFooterComponent={q.hasNextPage ? <Button title="Load more" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
          renderItem={({ item: n }) => (
            <PressableScale
              disabled={busy}
              onPress={() => open(n.id)}
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
          )}
        />
      )}
    </Screen>
  );
}
