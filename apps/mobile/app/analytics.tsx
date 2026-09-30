import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { BadgeIndianRupee, Clock, Inbox, Trophy } from 'lucide-react-native';
import {
  LEAD_SOURCE_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  formatINR,
  type LeadSource,
  type LeadStage,
} from '@brokeriq/shared';
import { api, qs } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Card, ErrorView, Header, Loader, Row, Screen, SectionTitle, Segmented, Stat, Txt } from '@/ui';

const mins = (m: number | null) => (m == null ? '—' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} घंटे` : `${Math.round(m / 1440)} दिन`);

function Bar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="small">{label}</Txt>
        <Txt v="small" color="muted">
          {right ?? value}
        </Txt>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2 }}>
        <Animated.View entering={FadeInRight} style={{ height: 8, borderRadius: 4, width: `${(value / Math.max(1, max)) * 100}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function Analytics() {
  const { c } = useTheme();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const q = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => api<any>(`/broker/analytics${qs({ from: new Date(Date.now() - Number(days) * 86400_000).toISOString() })}`),
  });
  const d = q.data;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Analytics" />
      <Segmented
        value={days}
        onChange={setDays}
        options={[
          { value: '7', label: '7 दिन' },
          { value: '30', label: '30 दिन' },
          { value: '90', label: '90 दिन' },
        ]}
      />
      {q.isLoading ? (
        <Loader />
      ) : q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <View style={{ gap: 10, marginTop: 14 }}>
          <Row gap={10}>
            <Stat label="Leads" value={d.totals.leads} icon={<Inbox size={18} color={c.brand} />} />
            <Stat label={`Won · ${d.totals.conversionRate}%`} value={d.totals.won} icon={<Trophy size={18} color={c.success} />} tint={c.success} />
          </Row>
          <Row gap={10}>
            <Stat label="First response (median)" value={mins(d.totals.medianFirstResponseMin)} icon={<Clock size={18} color={c.warning} />} tint={c.warning} />
            <Stat
              label={`${d.deals.count} deals commission`}
              value={formatINR(d.deals.commission)}
              icon={<BadgeIndianRupee size={18} color={c.info} />}
              tint={c.info}
            />
          </Row>
          <SectionTitle title="Sources" subtitle="Leads (won)" />
          <Card style={{ padding: 14, gap: 12 }}>
            {d.bySource.map((s: any) => (
              <Bar
                key={s.source}
                label={LEAD_SOURCE_LABELS[s.source as LeadSource] ?? s.source}
                value={s.total}
                max={d.bySource[0]?.total ?? 1}
                color={LEAD_SOURCE_COLORS[s.source as LeadSource] ?? '#64748B'}
                right={`${s.total} (${s.won} · ${s.conversion}%)`}
              />
            ))}
            {!d.bySource.length && (
              <Txt v="small" color="muted">
                कोई data नहीं
              </Txt>
            )}
          </Card>
          <SectionTitle title="Funnel" />
          <Card style={{ padding: 14, gap: 12 }}>
            {LEAD_STAGES.map((s) => {
              const n = d.byStage.find((x: any) => x.stage === s)?.count ?? 0;
              return (
                <Bar
                  key={s}
                  label={LEAD_STAGE_LABELS[s as LeadStage]}
                  value={n}
                  max={Math.max(1, ...d.byStage.map((x: any) => x.count))}
                  color={LEAD_STAGE_COLORS[s as LeadStage]}
                />
              );
            })}
          </Card>
          {!!d.agents.length && (
            <>
              <SectionTitle title="Agents" />
              <Card style={{ padding: 14, gap: 12 }}>
                {d.agents.map((a: any) => (
                  <Bar
                    key={a.id}
                    label={a.name}
                    value={a.won}
                    max={Math.max(1, ...d.agents.map((x: any) => x.won))}
                    color={c.success}
                    right={`${a.leads} leads · ${a.won} won · ${a.activities} acts`}
                  />
                ))}
              </Card>
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
