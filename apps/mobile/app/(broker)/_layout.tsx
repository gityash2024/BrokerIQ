import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Building2, Inbox, LayoutDashboard, MessagesSquare, Workflow } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { TabBar } from '@/components/tab-bar';
export default function BrokerTabs() {
  const { user } = useAuth();
  if (user?.role !== 'BROKER_ADMIN') return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="dashboard" options={{ title: 'Today', tabBarIcon: ({ color }) => <LayoutDashboard size={21} color={color} /> }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({ color }) => <Building2 size={21} color={color} /> }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads', tabBarIcon: ({ color }) => <Inbox size={21} color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: ({ color }) => <MessagesSquare size={21} color={color} /> }} />
      <Tabs.Screen name="automations" options={{ title: 'Automation', tabBarIcon: ({ color }) => <Workflow size={21} color={color} /> }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
