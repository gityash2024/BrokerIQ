import { useEffect } from 'react';
import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useQuery } from '@tanstack/react-query';
import { Building2, Inbox, LayoutDashboard, Menu, MessagesSquare } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { TabBar } from '@/components/tab-bar';
import { usePrivacySync } from '@/lib/privacy';

export default function BrokerTabs() {
  usePrivacySync();
  const { user, isBroker } = useAuth();
  const dash = useQuery({ queryKey: ['broker-dashboard'], queryFn: () => api<any>('/broker/dashboard'), enabled: isBroker, refetchInterval: 60_000 });
  useRealtime('notification', (n: any) => n?.kind === 'NEW_LEAD' && dash.refetch());
  useRealtime('wa:message', () => dash.refetch());
  useEffect(() => {
    if (user?.role === 'BROKER_ADMIN' && user.organization && !user.organization.onboarded) router.replace('/broker-onboarding');
  }, [user]);
  if (!isBroker) return <Redirect href="/(user)/home" />;
  const k = dash.data?.kpis;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} badges={{ leads: k?.newToday || undefined, inbox: k?.unreadMessages || undefined, more: k?.overdue || undefined }} />}>
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads', tabBarIcon: ({ color }) => <Inbox size={22} color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: ({ color }) => <MessagesSquare size={22} color={color} /> }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({ color }) => <Building2 size={22} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Menu size={22} color={color} /> }} />
    </Tabs>
  );
}
