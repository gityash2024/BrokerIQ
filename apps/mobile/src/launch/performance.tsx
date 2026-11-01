import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { PerformanceData, PerformanceQuery } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api, qs } from '@/lib/api';
import { BrokerScreen } from './screen';
import { ChoiceField } from './form';
import { DateTimeField } from '@/components/date-time-field';
import { Txt, Card, Input, ErrorView } from '@/ui';

export function PerformanceScreen() {
  const { user } = useAuth();
  const [range, setRange] = useState<PerformanceQuery['range']>('MONTH');
  const [from, setFrom] = useState<Date | null>(null),
    [to, setTo] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const day = (date: Date | null) =>
    date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : undefined;
  const params = qs({ range, ...(range === 'CUSTOM' ? { from: day(from), to: day(to) } : {}) });
  const query = useQuery({
    queryKey: ['team-performance', user?.id, params],
    queryFn: () => api<PerformanceData>('/broker/performance' + params),
    enabled: range !== 'CUSTOM' || (!!from && !!to),
  });
  const rows = query.data?.items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <BrokerScreen title={user?.role === 'BROKER_AGENT' ? 'My performance' : 'Leaderboard'} subtitle="Actual records · selected period · IST" back>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <ChoiceField
          label="Reporting period"
          value={range}
          choices={['MONTH', 'QUARTER', 'YEAR', 'ALL', 'CUSTOM']}
          labels={{ MONTH: 'This calendar month', QUARTER: 'Last 90 days', YEAR: 'Last 365 days', ALL: 'All time', CUSTOM: 'Custom dates' }}
          onChange={(value) => value && setRange(value as PerformanceQuery['range'])}
        />
        {range === 'CUSTOM' && (
          <View style={{ gap: 12 }}>
            <Txt>From date</Txt>
            <DateTimeField dateOnly value={from} onChange={setFrom} />
            <Txt>To date</Txt>
            <DateTimeField dateOnly value={to} onChange={setTo} />
          </View>
        )}
        <Input accessibilityLabel="Search performance members" placeholder="Search members" value={search} onChangeText={setSearch} />
        {query.data && (
          <Txt v="caption" color="muted">
            {range === 'ALL' ? 'All time' : query.data.period.from + ' — ' + query.data.period.to} · {query.data.definition}
          </Txt>
        )}
        {query.error ? (
          <ErrorView error={query.error} onRetry={() => query.refetch()} />
        ) : query.isFetching ? (
          <Txt>Loading performance…</Txt>
        ) : (
          rows.map((item) => (
            <Card key={item.id} style={{ padding: 16, gap: 10 }}>
              <Txt v="h3">
                {item.rank != null ? '#' + item.rank + ' · ' : ''}
                {item.name}
              </Txt>
              <Txt v="small" color="muted">
                {item.organizationName}
              </Txt>
              <Txt>
                {item.wonLeads} Won leads · {item.receivedLeads} New leads · {item.activities} Activities
              </Txt>
              <Txt v="small" color="muted">
                Monthly goal · {query.data?.targetMonth}:{' '}
                {item.targets.monthlyDeals ? `${item.monthlyWonLeads}/${item.targets.monthlyDeals} · ${item.monthlyFulfillment}%` : 'No monthly target'}
              </Txt>
            </Card>
          ))
        )}
        {!query.isFetching && !query.error && !rows.length && <Txt color="muted">No matching performance records.</Txt>}
      </ScrollView>
    </BrokerScreen>
  );
}
