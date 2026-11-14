import { useConfig } from '@/lib/config';
import { delegatedModulePolicies, moduleAllowed } from '@brokeriq/shared';
import { NativeScreenLayout } from '@/launch/module-gate';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Building2, Inbox, LayoutDashboard, MessagesSquare, ShieldCheck, Workflow } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { TabBar } from '@/components/tab-bar';
import { useAgentLocationReporter } from '@/lib/location-tracker';

export default function BrokerTabs() {
  const { user } = useAuth();
  useAgentLocationReporter();
  const config = useConfig();

  if (!user || !['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role)) return <Redirect href="/login" />;
  const delegated = user.role === 'SUB_BROKER_ADMIN';
  const policies = delegated ? delegatedModulePolicies(config.modules, user.delegatedPermissions ?? []) : undefined;
  const show = (key: string) => !delegated || moduleAllowed(policies, key, 'BROKER_ADMIN');
  return (
    <Tabs screenLayout={NativeScreenLayout} screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="dashboard" options={{ title: 'Today', tabBarIcon: ({ color }) => <LayoutDashboard size={21} color={color} /> }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', href: show('inventory') ? undefined : null, tabBarIcon: ({ color }) => <Building2 size={21} color={color} /> }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads', href: show('leads') ? undefined : null, tabBarIcon: ({ color }) => <Inbox size={21} color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', href: show('inbox') ? undefined : null, tabBarIcon: ({ color }) => <MessagesSquare size={21} color={color} /> }} />
      <Tabs.Screen
        name="kyc"
        options={{
          title: 'KYC', href: show('kyc') ? undefined : null,
          tabBarIcon: ({ color }) => <ShieldCheck size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="automations"
        options={{
          href: user.role === 'BROKER_ADMIN' || (delegated && show('automation')) ? undefined : null,
          title: 'Automation',
          tabBarIcon: ({ color }) => <Workflow size={21} color={color} />,
        }}
      />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
