import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppState, Linking, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { moduleAllowed, SHIFT_LOCATION_INTERVAL_MS } from '@brokeriq/shared';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { BrokerScreen } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { TimeLoggingCard } from '@/components/time-logging-card';
import { DateTimeField } from '@/components/date-time-field';
import { Button, Card, Txt, ErrorView } from '@/ui';
import { showError } from '@/lib/hooks';

export default function TimeLogging() {
  const { user } = useAuth();
  const { app, modules } = useConfig();
  const params = useLocalSearchParams<{ memberId?: string }>();
  const [member, setMember] = useState<string | null>(params.memberId || null);
  const [date, setDate] = useState<Date | null>(new Date());
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canReadTeam = isSuperAdmin || (user?.role === 'BROKER_ADMIN' && moduleAllowed(modules, 'team', user.role));
  const team = useQuery({ queryKey: ['team-time-picker', user?.id], queryFn: () => api<any>('/broker/team'), enabled: canReadTeam, refetchInterval: SHIFT_LOCATION_INTERVAL_MS, refetchOnReconnect: 'always' });
  const agentId = canReadTeam && member ? member : isSuperAdmin ? null : user?.id;
  const day = date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
  const query = useQuery({
    queryKey: ['time-timeline', user?.id, agentId, day],
    queryFn: () => api<any>(`/time-logging/timeline${qs({ agentId, date: day })}`),
    enabled: !!agentId && !!day,
    refetchInterval: SHIFT_LOCATION_INTERVAL_MS,
    refetchOnReconnect: 'always',
  });
  useFocusEffect(useCallback(() => {
    if (agentId && day) void query.refetch();
    if (canReadTeam) void team.refetch();
  }, [agentId, day, canReadTeam, query.refetch, team.refetch]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && agentId && day) void query.refetch();
    });
    return () => subscription.remove();
  }, [agentId, day, query.refetch]);
  const members: any[] = team.data?.members ?? [];
  return (
    <BrokerScreen title="Time Logging" subtitle="Shift activity and recorded location history · IST" back>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {isSuperAdmin && <Card style={{ padding: 16, gap: 12 }}>
          <Txt v="title">{user.name} · Super Admin</Txt>
          <Txt color="muted">Choose a member across firms. Platform management remains in the web Admin Portal.</Txt>
          <Button title="Open Admin web portal" variant="secondary" onPress={() => Linking.openURL(`${app.siteUrl.replace(/\/$/, '')}/admin`).catch(showError)} />
        </Card>}
        {!isSuperAdmin && <TimeLoggingCard />}
        {canReadTeam && (
          <ChoiceField
            label="Team member"
            value={member}
            choices={members.map((item) => item.id)}
            labels={Object.fromEntries(members.map((item) => [item.id, isSuperAdmin && item.organization?.name ? `${item.name} · ${item.organization.name}` : item.name]))}
            emptyLabel={isSuperAdmin ? "Choose a member" : "My activity"}
            onChange={setMember}
          />
        )}
        {team.error && canReadTeam && <ErrorView error={team.error} onRetry={() => team.refetch()} />}
        <DateTimeField value={date} onChange={setDate} dateOnly />
        <Txt v="small" color="muted">
          Recorded history shows original capture times. A past checkpoint does not indicate a live location.
        </Txt>
        {!agentId ? (
          <Txt color="muted">Choose a member to inspect recorded activity.</Txt>
        ) : query.error ? (
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
