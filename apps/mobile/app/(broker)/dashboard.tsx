import { NativeDashboard } from '@/launch/dashboard';
import { ScrollView, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, ClipboardList, Inbox, CalendarCheck, ArrowRight, ShieldCheck, ShieldAlert, Clock } from 'lucide-react-native';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Txt, Button } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';

export default function Today() {
  const { user } = useAuth();
  const { c, isDark } = useTheme();
  const q = useQuery({ queryKey: ['broker-today'], queryFn: () => api<any>('/broker/today'), refetchInterval: 60000 });
  const isAgent = user?.role === 'BROKER_AGENT';
  const kyc = useQuery({
    queryKey: ['agent-kyc-mine-mobile'],
    queryFn: () => api<any>('/broker/team/agent-kyc/mine'),
    enabled: isAgent,
    refetchInterval: 60000,
  });
  const d = q.data;
  const kycStatus = kyc.data?.status;

  return (
    <BrokerScreen title="Today" subtitle={user?.organization?.name ?? 'BrokerIQ'}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 18, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.brand} />}
      >
        {isAgent && kycStatus !== 'VERIFIED' && (
          <NativeCard
            onPress={() => router.push('/agent-kyc')}
            style={{
              backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.3)',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: kycStatus === 'PENDING' ? '#3B82F6' : kycStatus === 'REJECTED' ? '#EF4444' : '#F59E0B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {kycStatus === 'PENDING' ? (
                  <Clock size={20} color="#fff" />
                ) : (
                  <ShieldAlert size={20} color="#fff" />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt v="title" style={{ fontWeight: '700' }}>
                    Agent KYC Verification
                  </Txt>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      backgroundColor:
                        kycStatus === 'PENDING'
                          ? 'rgba(59,130,246,0.15)'
                          : kycStatus === 'REJECTED'
                            ? 'rgba(239,68,68,0.15)'
                            : 'rgba(245,158,11,0.15)',
                    }}
                  >
                    <Txt
                      v="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color:
                          kycStatus === 'PENDING'
                            ? '#3B82F6'
                            : kycStatus === 'REJECTED'
                              ? '#EF4444'
                              : '#D97706',
                      }}
                    >
                      {kycStatus === 'PENDING' ? 'Under Review' : kycStatus === 'REJECTED' ? 'Rejected' : 'Action Req'}
                    </Txt>
                  </View>
                </View>
                <Txt v="caption" color="muted">
                  {kycStatus === 'PENDING'
                    ? 'Aadhaar, PAN and Face Liveliness check submitted and under review.'
                    : kycStatus === 'REJECTED'
                      ? `Rejected: ${kyc.data?.reviewNote || 'Please update documents'}. Tap to re-submit.`
                      : 'Submit Aadhaar, PAN and 3-step Face Liveliness to get verified.'}
                </Txt>
              </View>
              <ArrowRight size={18} color={c.brand} />
            </View>
          </NativeCard>
        )}

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
        {!isAgent && d?.inventory?.unknown > 0 && (
          <NativeCard onPress={() => router.push('/(broker)/inventory')}>
            <Txt v="title">Confirm property availability</Txt>
            <Txt color="muted">{`${d.inventory.unknown} properties have unknown availability.`}</Txt>
          </NativeCard>
        )}
      </ScrollView>
    </BrokerScreen>
  );
}
