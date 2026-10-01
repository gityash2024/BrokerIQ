import { Tabs } from 'expo-router/js-tabs';
import { useQuery } from '@tanstack/react-query';
import { Heart, Home, MessageCircle, Search, UserRound } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TabBar } from '@/components/tab-bar';
import { usePrivacySync } from '@/lib/privacy';
import type { ChatThreadSummary, NotificationsResponse } from '@brokeriq/shared';

export default function UserTabs() {
  usePrivacySync();
  const { user } = useAuth();
  const threads = useQuery({ queryKey: ['chat-threads'], queryFn: () => api<ChatThreadSummary[]>('/chat/threads'), enabled: !!user, refetchInterval: 60_000 });
  const notif = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationsResponse>('/me/notifications'),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const unread = (threads.data ?? []).filter((t) => t.lastInboundAt && t.lastMessageAt && t.lastMessageAt !== t.lastInboundAt).length;
  return (
    <Tabs
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
