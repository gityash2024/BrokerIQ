import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { moduleAllowed } from '@brokeriq/shared';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { BrokerScreen } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { TimeLoggingCard } from '@/components/time-logging-card';
import { DateTimeField } from '@/components/date-time-field';
import { Card, Txt, ErrorView } from '@/ui';

export default function TimeLogging() {
  const { user } = useAuth();
  const { modules } = useConfig();
  const [member, setMember] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const canReadTeam = user?.role === 'BROKER_ADMIN' && moduleAllowed(modules, 'team', user.role);
  const team = useQuery({ queryKey: ['team-time-picker', user?.id], queryFn: () => api<any>('/broker/team'), enabled: canReadTeam });
  const agentId = canReadTeam && member ? member : user?.id;
  const day = date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
  const query = useQuery({
    queryKey: ['time-timeline', user?.id, agentId, day],
    queryFn: () => api<any>(`/time-logging/timeline${qs({ agentId, date: day })}`),
    enabled: !!agentId && !!day,
  });
  const members: any[] = team.data?.members ?? [];
  return (
    <BrokerScreen title="Time Logging" subtitle="Shift activity and recorded location history · IST" back>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <TimeLoggingCard />
        {canReadTeam && (
          <ChoiceField
            label="Team member"
            value={member}
            choices={members.map((item) => item.id)}
            labels={Object.fromEntries(members.map((item) => [item.id, item.name]))}
            emptyLabel="My activity"
            onChange={setMember}
          />
        )}
        {team.error && canReadTeam && <ErrorView error={team.error} onRetry={() => team.refetch()} />}
        <DateTimeField value={date} onChange={setDate} dateOnly />
        <Txt v="small" color="muted">
          Recorded history shows original capture times. A past checkpoint does not indicate a live location.
        </Txt>
        {query.error ? (
          <ErrorView error={query.error} onRetry={() => query.refetch()} />
        ) : query.isPending ? (
          <Txt>Loading history…</Txt>
        ) : (
          <>
            <Card style={{ padding: 16, gap: 5 }}>
              <Txt v="h3">{query.data?.agent?.name}</Txt>
              <Txt>
                {query.data?.summary?.activeMinutes ?? 0} active minutes · {query.data?.summary?.pausedMinutes ?? 0} paused minutes
              </Txt>
            </Card>
            {(query.data?.events ?? []).map((event: any) => (
              <Card key={event.id} style={{ padding: 16, gap: 6 }}>
                <Txt v="title">{event.label}</Txt>
                <Txt v="small">{new Date(event.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</Txt>
                {event.address && <Txt>{event.address}</Txt>}
                {event.coordinates && (
                  <View>
                    <Txt v="caption" color="muted">
                      {event.coordinates.latitude}, {event.coordinates.longitude} · accuracy {event.coordinates.accuracy ?? 'Unknown'} m
                    </Txt>
                  </View>
                )}
                {event.reason && <Txt color="muted">{event.reason}</Txt>}
              </Card>
            ))}
            {!query.data?.events?.length && <Txt color="muted">No activity recorded for this date.</Txt>}
          </>
        )}
      </ScrollView>
    </BrokerScreen>
  );
}
