import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BadgeCheck, MessageCircle } from 'lucide-react-native';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { LoginPrompt } from '@/components/login-prompt';
import { Avatar, Button, Empty, ErrorView, PressableScale, Row, Screen, Skeleton, Txt } from '@/ui';

export default function Messages() {
  const { user } = useAuth();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['chat-threads'], queryFn: () => api<any[]>('/chat/threads'), enabled: !!user });
  useRealtime('chat:message', () => q.refetch());
  if (!user) return <LoginPrompt title="Brokers से सीधे chat करें" text="Login करें — property पर सवाल पूछें और real-time जवाब पाएँ।" />;
  return (
    <Screen scroll={false} padded={false}>
      <Txt v="h1" style={{ padding: 16 }}>
        Chats
      </Txt>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(x) => x.id}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton h={64} />
              <Skeleton h={64} />
            </View>
          ) : q.isError ? (
            <ErrorView error={q.error} />
          ) : (
            <Empty
              icon={<MessageCircle size={28} color={c.brand} />}
              title="अभी कोई chat नहीं"
              text="किसी property पर 'Chat' दबाकर broker से बात शुरू करें।"
              action={<Button title="Properties देखें" onPress={() => router.push('/(user)/search')} />}
            />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40)}>
            <PressableScale
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, name: item.organization?.name } })}
              style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line }}
            >
              <Avatar name={item.organization?.name} uri={item.organization?.logoUrl} size={50} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={4} style={{ flex: 1 }}>
                    <Txt v="bodyStrong" numberOfLines={1}>
                      {item.organization?.name}
                    </Txt>
                    {item.organization?.verification === 'VERIFIED' && <BadgeCheck size={14} color={c.success} />}
                  </Row>
                  <Txt v="caption" color="subtle">
                    {item.lastMessageAt ? timeAgo(item.lastMessageAt) : ''}
                  </Txt>
                </Row>
                <Txt v="small" color="muted" numberOfLines={1}>
                  {item.lastPreview ?? '—'}
                </Txt>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </Screen>
  );
}
