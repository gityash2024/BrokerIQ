import { NativeDashboard } from '@/launch/dashboard';
import { ScrollView, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, ClipboardList, Inbox, CalendarCheck, ArrowRight } from 'lucide-react-native';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Txt, Button } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';
export default function Today() {
  const { user } = useAuth();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['broker-today'], queryFn: () => api<any>('/broker/today'), refetchInterval: 60000 });
  const d = q.data;
  return (
    <BrokerScreen title="Today" subtitle={user?.organization?.name ?? 'BrokerIQ'}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 18, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.brand} />}
      >
        <NativeDashboard role="broker" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Add property" onPress={() => router.push('/inventory-edit')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Capture message" variant="secondary" onPress={() => router.push('/capture')} />
          </View>
        </View>
        <Txt v="h3">Follow-ups</Txt>
        {d?.followUps?.map((item: any) => (
          <NativeCard key={item.id} onPress={() => router.push(`/lead/${item.lead.id}` as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt v="title">{item.lead.name}</Txt>
                <Txt v="caption" color="muted">
                  {item.note || item.type}
                </Txt>
              </View>
              <Txt v="caption" color={new Date(item.dueAt) < new Date() ? 'danger' : 'muted'}>
                {new Date(item.dueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              </Txt>
              <ArrowRight size={16} color={c.muted} />
            </View>
          </NativeCard>
        ))}
        {d?.followUps?.length === 0 && (
          <NativeCard>
            <Txt color="muted">No pending follow-ups today.</Txt>
          </NativeCard>
        )}
        <Txt v="h3">Site visits</Txt>
        {d?.visits?.map((item: any) => (
          <NativeCard key={item.id} onPress={() => router.push('/visits')}>
            <Txt v="title">{item.lead.name}</Txt>
            <Txt v="caption" color="muted">
              {new Date(item.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
            </Txt>
          </NativeCard>
        ))}
        {d?.visits?.length === 0 && (
          <NativeCard>
            <Txt color="muted">No visits scheduled today.</Txt>
          </NativeCard>
        )}
        {d?.inventory?.unknown > 0 && (
          <NativeCard onPress={() => router.push('/(broker)/inventory')}>
            <Txt v="title">Confirm property availability</Txt>
            <Txt color="muted">{`${d.inventory.unknown} properties have unknown availability.`}</Txt>
          </NativeCard>
        )}
      </ScrollView>
    </BrokerScreen>
  );
}
