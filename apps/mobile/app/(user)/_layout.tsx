import { useConfig } from '@/lib/config';
import { moduleAllowed } from '@brokeriq/shared';
import { NativeScreenLayout } from '@/launch/module-gate';
import { useAuth } from '@/lib/auth';
import { Tabs } from 'expo-router/js-tabs';
import { useQuery } from '@tanstack/react-query';
import { Heart, Home, MessageCircle, Search, UserRound } from 'lucide-react-native';
import { api } from '@/lib/api';
import { TabBar } from '@/components/tab-bar';
import type { ChatThreadSummary, NotificationsResponse } from '@brokeriq/shared';

export default function UserTabs() {
  const { user } = useAuth();
  const config = useConfig();
  const permitted = !!user && config.loaded && moduleAllowed(config.modules, 'consumer', user.role);
  const threads = useQuery({
    queryKey: ['chat-threads'],
    queryFn: () => api<ChatThreadSummary[]>('/chat/threads'),
    enabled: permitted,
    refetchInterval: 60_000,
  });
  const notif = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationsResponse>('/me/notifications'),
    enabled: permitted,
    refetchInterval: 60_000,
  });
  const unread = (threads.data ?? []).filter((t) => t.lastInboundAt && t.lastMessageAt && t.lastMessageAt !== t.lastInboundAt).length;
  return (
    <Tabs
      screenLayout={NativeScreenLayout}
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <TabBar {...p} badges={{ messages: unread || undefined, profile: notif.data?.unreadCount || undefined }} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color }) => <Search size={22} color={color} /> }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: ({ color }) => <Heart size={22} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Chats', tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserRound size={22} color={color} /> }} />
    </Tabs>
  );
}
