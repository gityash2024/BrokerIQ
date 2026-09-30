import { useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeOutRight } from 'react-native-reanimated';
import { AlarmClock, Check, Clock, MessageCircle, Phone } from 'lucide-react-native';
import { whatsappLink } from '@brokeriq/shared';
import { api, patch, qs } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { StageBadge } from '@/components/crm';
import { Card, Chip, Empty, ErrorView, Header, IconBtn, Row, Screen, Segmented, Skeleton, Txt } from '@/ui';

export default function FollowUps() {
  const { c } = useTheme();
  const [view, setView] = useState<'today' | 'overdue' | 'upcoming' | 'done'>('today');
  const params =
    view === 'today'
      ? { view: 'today' }
      : view === 'overdue'
        ? { view: 'overdue' }
        : view === 'done'
          ? { status: 'DONE', from: new Date(Date.now() - 14 * 86400_000).toISOString() }
          : { status: 'PENDING', from: new Date().toISOString() };
  const q = useQuery({ queryKey: ['follow-ups', view], queryFn: () => api<any[]>(`/follow-ups${qs(params)}`) });
  const upd = useApiMutation(({ id, ...b }: any) => patch(`/follow-ups/${id}`, b), { invalidate: [['follow-ups'], ['broker-dashboard']] });
  const snooze = (id: string, ms: number) => upd.mutate({ id, dueAt: new Date(Date.now() + ms).toISOString() });
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Follow-ups" subtitle="Reminder push से भी आता है" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: 'आज तक' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'done', label: 'Done' },
          ]}
        />
      </View>
      {q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={100} /> : <Empty icon={<Check size={28} color={c.success} />} title="सब clear है 🎉" />}
          renderItem={({ item: f, index }) => {
            const overdue = f.status === 'PENDING' && new Date(f.dueAt) < new Date();
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)} exiting={FadeOutRight}>
                <Card style={{ padding: 14, gap: 8, borderColor: overdue ? `${c.danger}55` : c.line }} onPress={() => router.push(`/lead/${f.lead.id}`)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong" style={{ flex: 1 }}>
                      {f.lead.name || f.lead.phone}
                    </Txt>
                    <StageBadge stage={f.lead.stage} />
                  </Row>
                  <Row gap={4}>
                    <Clock size={13} color={overdue ? c.danger : c.muted} />
                    <Txt v="caption" color={overdue ? 'danger' : 'muted'}>
                      {new Date(f.dueAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} ·{' '}
                      {f.type}
                    </Txt>
                  </Row>
                  {!!f.note && (
                    <Txt v="small" color="muted">
                      {f.note}
                    </Txt>
                  )}
                  {f.status === 'PENDING' && (
                    <Row wrap gap={6}>
                      <IconBtn onPress={() => Linking.openURL(`tel:${f.lead.phone}`)} style={{ backgroundColor: c.surface2 }}>
                        <Phone size={17} color={c.brand} />
                      </IconBtn>
                      <IconBtn onPress={() => Linking.openURL(whatsappLink(f.lead.phone, `Hi ${f.lead.name ?? ''}`))} style={{ backgroundColor: '#25D36622' }}>
                        <MessageCircle size={17} color="#16A34A" />
                      </IconBtn>
                      <Chip label="+1h" onPress={() => snooze(f.id, 3600_000)} icon={<AlarmClock size={13} color={c.muted} />} />
                      <Chip label="कल" onPress={() => snooze(f.id, 86400_000)} />
                      <Chip label="✓ Done" color={c.success} active onPress={() => upd.mutate({ id: f.id, status: 'DONE' })} />
                    </Row>
                  )}
                </Card>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}
