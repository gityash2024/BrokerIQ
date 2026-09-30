import { useState } from 'react';
import { Dimensions, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import { LEAD_STAGES, LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, formatPriceShort, timeAgo, type LeadStage } from '@brokeriq/shared';
import { api, patch } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { SourceBadge, TempBadge } from '@/components/crm';
import { Chip, ErrorView, Header, Loader, PressableScale, Row, Screen, Sheet, Txt } from '@/ui';

const W = Dimensions.get('window').width;

export default function Pipeline() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['kanban'], queryFn: () => api<any[]>('/leads/kanban') });
  const [move, setMove] = useState<any>(null);
  const doMove = async (lead: any, to: LeadStage) => {
    setMove(null);
    if (to === 'LOST' || to === 'WON') return router.push(`/lead/${lead.id}`);
    try {
      await patch(`/leads/${lead.id}/stage`, { stage: to });
      toast.success(`${lead.name} → ${LEAD_STAGE_LABELS[to]}`);
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
    } catch (e) {
      showError(e);
    }
  };
  if (q.isLoading) return <Loader />;
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Pipeline" subtitle="Card पर long-press करके stage बदलें" />
      {q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          horizontal
          pagingEnabled
          snapToInterval={W * 0.82 + 12}
          decelerationRate="fast"
          data={q.data ?? []}
          keyExtractor={(x) => x.stage}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 24 }}
          renderItem={({ item: col }) => {
            const color = LEAD_STAGE_COLORS[col.stage as LeadStage];
            return (
              <View style={{ width: W * 0.82, backgroundColor: c.surface2, borderRadius: 22, padding: 10 }}>
                <Row style={{ padding: 6, justifyContent: 'space-between' }}>
                  <Row gap={6}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                    <Txt v="h3">{col.label}</Txt>
                  </Row>
                  <Txt v="bodyStrong" color="muted">
                    {col.count}
                  </Txt>
                </Row>
                <FlatList
                  data={col.items}
                  keyExtractor={(x) => x.id}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                  renderItem={({ item: l, index }) => (
                    <Animated.View entering={FadeInDown.delay(index * 30)} layout={LinearTransition.springify()}>
                      <PressableScale
                        onPress={() => router.push(`/lead/${l.id}`)}
                        onLongPress={() => setMove(l)}
                        delayLongPress={250}
                        style={{ padding: 12, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, gap: 6 }}
                      >
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                            {l.name || l.phone}
                          </Txt>
                          <TempBadge t={l.temperature} />
                        </Row>
                        <Txt v="caption" color="muted" numberOfLines={1}>
                          {[
                            l.requirement?.bedrooms?.length ? `${l.requirement.bedrooms.join('/')} BHK` : null,
                            l.requirement?.maxBudget ? `≤ ${formatPriceShort(l.requirement.maxBudget)}` : null,
                            l.listing?.title,
                          ]
                            .filter(Boolean)
                            .join(' · ') || l.phone}
                        </Txt>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <SourceBadge source={l.source} />
                          <Txt v="caption" color="subtle">
                            {timeAgo(l.lastActivityAt ?? l.createdAt)}
                          </Txt>
                        </Row>
                      </PressableScale>
                    </Animated.View>
                  )}
                  ListEmptyComponent={
                    <Txt v="small" color="subtle" style={{ padding: 16, textAlign: 'center' }}>
                      खाली
                    </Txt>
                  }
                />
              </View>
            );
          }}
        />
      )}
      <Sheet open={!!move} onClose={() => setMove(null)} title={move ? `${move.name} → stage` : ''}>
        <Row wrap>
          {LEAD_STAGES.filter((s) => s !== move?.stage).map((s) => (
            <Chip
              key={s}
              label={LEAD_STAGE_LABELS[s as LeadStage]}
              color={LEAD_STAGE_COLORS[s as LeadStage]}
              active
              onPress={() => doMove(move, s as LeadStage)}
              icon={<ArrowRight size={13} color={LEAD_STAGE_COLORS[s as LeadStage]} />}
            />
          ))}
        </Row>
      </Sheet>
    </Screen>
  );
}
