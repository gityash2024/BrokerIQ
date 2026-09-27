import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BadgeIndianRupee, Handshake, TrendingUp, Wallet } from 'lucide-react-native';
import { formatINR, formatPriceShort } from '@brokeriq/shared';
import { api, patch } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Badge, Card, Chip, Empty, ErrorView, Header, Row, Screen, Skeleton, Stat, Txt } from '@/ui';

const commission = (d: any) => d.commissionAmount ?? (d.commissionPct ? (d.dealValue * d.commissionPct) / 100 : 0);

export default function Deals() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['deals', 'all'], queryFn: () => api<any[]>('/deals') });
  const upd = useApiMutation(({ id, ...b }: any) => patch(`/deals/${id}`, b), { success: 'Updated', invalidate: [['deals']] });
  const d = q.data ?? [];
  const closed = d.filter((x) => x.status === 'CLOSED');
  const earned = closed.reduce((s, x) => s + commission(x), 0);
  const received = closed.reduce((s, x) => s + (x.commissionReceived ?? 0), 0);
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Deals & commission" />
      {q.isError ? <ErrorView error={q.error} /> : (
        <FlatList
          data={d}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 6 }}>
              <Row gap={10}>
                <Stat label="Closed value" value={formatPriceShort(closed.reduce((s, x) => s + x.dealValue, 0))} icon={<TrendingUp size={18} color={c.success} />} tint={c.success} />
                <Stat label="Commission earned" value={formatINR(earned)} icon={<BadgeIndianRupee size={18} color={c.brand} />} />
              </Row>
              <Stat label={`Pending collection · ${formatINR(received)} received`} value={formatINR(Math.max(0, earned - received))} icon={<Wallet size={18} color={c.warning} />} tint={c.warning} />
            </View>
          }
          ListEmptyComponent={q.isLoading ? <Skeleton h={100} /> : <Empty icon={<Handshake size={28} color={c.brand} />} title="अभी कोई deal नहीं" text="Lead को WON mark करते समय deal जुड़ती है।" />}
          renderItem={({ item: x, index }) => {
            const cm = commission(x);
            const pct = cm ? Math.min(100, ((x.commissionReceived ?? 0) / cm) * 100) : 0;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
                <Card style={{ padding: 14, gap: 6 }} onPress={() => router.push(`/lead/${x.lead.id}`)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{x.title}</Txt>
                    <Badge label={x.status} color={x.status === 'CLOSED' ? c.success : x.status === 'OPEN' ? c.brand : c.subtle} />
                  </Row>
                  <Txt v="small" color="muted">{x.lead.name} · {formatPriceShort(x.dealValue)}{x.agent ? ` · ${x.agent.name}` : ''}</Txt>
                  {!!cm && (
                    <>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Txt v="caption" color="muted">Commission {formatINR(cm)}</Txt>
                        <Txt v="caption" color={pct >= 100 ? 'success' : 'warning'}>{formatINR(x.commissionReceived ?? 0)} received</Txt>
                      </Row>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2 }}><View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: pct >= 100 ? c.success : c.accent }} /></View>
                      {pct < 100 && x.status === 'CLOSED' && <Row><Chip label="पूरा commission मिल गया ✓" onPress={() => upd.mutate({ id: x.id, commissionReceived: cm })} /></Row>}
                    </>
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
