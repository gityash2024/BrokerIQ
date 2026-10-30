import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUpRight, Blocks, Clock3 } from 'lucide-react-native';
import { catalogModules } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { Input, Txt, Button, Row } from '@/ui';
export default function ProductTools() {
  const { user } = useAuth(),
    { modules } = useConfig(),
    { c } = useTheme();
  const [search, setSearch] = useState('');
  const role = user?.role ?? 'PUBLIC';
  const items = catalogModules(modules, role).filter((m) => `${m.name} ${m.description}`.toLowerCase().includes(search.toLowerCase()));
  const routes: Record<string, string> =
    role === 'BROKER_ADMIN'
      ? {
          consumer: '/home',
          today: '/dashboard',
          inventory: '/inventory',
          directory: '/area-directory',
          leads: '/leads',
          inbox: '/inbox',
          automation: '/automations',
          team: '/team',
          tenant_requirements: '/requirements',
          slot_booking: '/visits',
        }
      : role === 'BROKER_AGENT'
        ? {
            consumer: '/home',
            today: '/dashboard',
            leads: '/leads',
            inbox: '/inbox',
            tenant_requirements: '/requirements',
            slot_booking: '/visits',
          }
        : { consumer: '/home', tenant_requirements: '/customer-requirements', slot_booking: '/my-visits' };
  return (
    <BrokerScreen title="Product features" subtitle="Available tools and the complete upcoming roadmap." back>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 14, paddingBottom: 40 }}>
        <WorkspaceHero
          label="YOUR BROKERIQ WORKSPACE"
          title="Everything, in its place."
          description="Available tools open your workspace. Upcoming modules are visible, disabled and preserve your access settings."
        />
        <Input accessibilityLabel="Search product features" placeholder="Find a feature…" value={search} onChangeText={setSearch} />
        {role === 'BROKER_ADMIN' && items.some((item) => ['inventory', 'inbox'].includes(item.key) && item.state === 'ACTIVE') && (
          <NativeCard>
            <Row>
              <Blocks size={20} color={c.brand} />
              <Txt v="h3">Capture & fill</Txt>
            </Row>
            {items.some((item) => item.key === 'inventory' && item.state === 'ACTIVE') && (
              <Button title="Scanner · Register pages" onPress={() => router.push('/scanner')} />
            )}
            {items.some((item) => item.key === 'inbox' && item.state === 'ACTIVE') && (
              <Button title="WhatsApp export / paste" variant="secondary" onPress={() => router.push('/capture')} />
            )}
            {items.some((item) => item.key === 'inventory' && item.state === 'ACTIVE') && (
              <Button title="Public rental draft scanner" variant="ghost" onPress={() => router.push('/listing-scanner')} />
            )}
          </NativeCard>
        )}
        {(['ACTIVE', 'COMING_SOON'] as const).map((state) => (
          <View key={state} style={{ gap: 12 }}>
            <Txt v="h3">{state === 'ACTIVE' ? 'Available features' : 'Coming soon'}</Txt>
            {items
              .filter((item) => item.state === state)
              .map((item) => (
                <NativeCard key={item.key} onPress={state === 'ACTIVE' && routes[item.key] ? () => router.push(routes[item.key] as any) : undefined}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 7 }}>
                      <Txt v="title">{item.name}</Txt>
                      <Txt v="caption" color="muted">
                        {item.description}
                      </Txt>
                    </View>
                    {state === 'ACTIVE' ? <ArrowUpRight size={18} color={c.brand} /> : <Clock3 size={18} color={c.muted} />}
                  </Row>
                  {state === 'COMING_SOON' && (
                    <View accessibilityState={{ disabled: true }}>
                      <WorkspaceTag tone="muted" label="Coming soon · Disabled" />
                    </View>
                  )}
                </NativeCard>
              ))}
          </View>
        ))}
        {items.length === 0 && <Txt color="muted">No matching features.</Txt>}
      </ScrollView>
    </BrokerScreen>
  );
}
