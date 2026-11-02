import { useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { followUpDateBoundary, followUpTomorrowAtTen } from '@brokeriq/shared';
import { DateTimeField } from '@/components/date-time-field';
import { ChoiceField } from '@/launch/form';
import { useAuth } from '@/lib/auth';
import Animated, { FadeInDown, FadeOutRight } from 'react-native-reanimated';
import { AlarmClock, Check, Clock, Phone } from 'lucide-react-native';
import { LeadContactActions } from '@/components/lead-contact-actions';
import { api, patch, qs } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { reconcileLocalReminders } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { StageBadge, useAssignees } from '@/components/crm';
import { Button, Card, Chip, Empty, ErrorView, Header, IconBtn, Input, Row, Screen, Segmented, Sheet, Skeleton, Txt } from '@/ui';

export default function FollowUps() {
  const { c } = useTheme();
  const [view, setView] = useState<'today' | 'overdue' | 'upcoming' | 'done' | 'all'>('today');
  const { isBrokerAdmin } = useAuth();
  const team = useAssignees();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [agent, setAgent] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const calendar = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fromDate = from ? followUpDateBoundary(calendar(from)) : undefined;
  const toDate = to ? followUpDateBoundary(calendar(to), true) : undefined;
  const invalidDates = !!(fromDate && toDate && fromDate > toDate);
  const common = { search, assignedToId: agent, from: fromDate, to: toDate };
  const params = {
    ...common,
    paginated: true,
    pageSize: 30,
    view: view === 'done' ? 'all' : view,
    status: view === 'done' ? 'DONE' : view === 'all' ? status : undefined,
    sortBy: view === 'done' ? 'completedAt' : 'dueAt',
    sortOrder: view === 'done' ? 'desc' : 'asc',
  };
  const q = useInfiniteQuery({
    queryKey: ['follow-ups', view, search, agent, status, fromDate, toDate],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<{ items: any[]; total: number; page: number; totalPages: number }>(`/follow-ups${qs({ ...params, page: pageParam })}`),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !invalidDates,
  });
  const counts = useQuery({
    queryKey: ['follow-ups', 'counts', search, agent, fromDate, toDate],
    queryFn: () => api<{ today: number; overdue: number }>(`/follow-ups/summary${qs(common)}`),
    enabled: !invalidDates,
    refetchInterval: 60000,
  });
  const rows = [...new Map((q.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values()];
  const upd = useApiMutation(({ id, ...b }: any) => patch(`/follow-ups/${id}`, b), {
    invalidate: [['follow-ups'], ['broker-dashboard']],
    onSuccess: () => {
      void reconcileLocalReminders().catch(() => undefined);
    },
  });
  const snooze = (id: string, ms: number) => upd.mutate({ id, dueAt: new Date(Date.now() + ms).toISOString() });
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Follow-ups" subtitle="Reminder push से भी आता है" right={<Chip label="Filters" onPress={() => setFiltersOpen(true)} />} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: 'आज तक', count: counts.data?.today },
            { value: 'overdue', label: 'Overdue', count: counts.data?.overdue },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
      </View>
      {invalidDates ? (
        <Txt color="danger">End date start date के बाद चुनें।</Txt>
      ) : q.isError && !q.data ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => {
            void q.refetch();
            void counts.refetch();
          }}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <Txt v="caption" color="muted">
              {q.data?.pages[0]?.total ?? 0} matching follow-ups · {rows.length} loaded
            </Txt>
          }
          ListFooterComponent={
            q.isFetchNextPageError ? <Button title="Retry loading more" onPress={() => q.fetchNextPage()} /> : q.isFetchingNextPage ? <Skeleton h={50} /> : null
          }
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
                      {new Date(f.dueAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      · {f.type}
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
                      <LeadContactActions lead={f.lead} />
                      <Chip label="+1h" onPress={() => snooze(f.id, 3600_000)} icon={<AlarmClock size={13} color={c.muted} />} />
                      <Chip label="कल 10 बजे" onPress={() => upd.mutate({ id: f.id, dueAt: followUpTomorrowAtTen().toISOString() })} />
                      <Chip label="✓ Done" color={c.success} active onPress={() => upd.mutate({ id: f.id, status: 'DONE' })} />
                    </Row>
                  )}
                </Card>
              </Animated.View>
            );
          }}
        />
      )}
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Follow-up filters">
        <View style={{ gap: 12 }}>
          <Txt v="caption">Search lead / note</Txt>
          <Input value={search} onChangeText={setSearch} placeholder="Name, phone, email or note" />
          {isBrokerAdmin && (
            <ChoiceField
              label="Assignee"
              value={agent}
              onChange={setAgent}
              emptyLabel="पूरी team"
              choices={(team.data?.members ?? []).map((member) => member.id)}
              labels={Object.fromEntries((team.data?.members ?? []).map((member) => [member.id, member.name]))}
            />
          )}
          {view === 'all' && (
            <ChoiceField label="Status" value={status} onChange={setStatus} emptyLabel="All statuses" choices={['PENDING', 'DONE', 'MISSED', 'CANCELLED']} />
          )}
          <Txt v="caption">Due from (IST)</Txt>
          <DateTimeField dateOnly value={from} onChange={setFrom} />
          <Txt v="caption">Due to (IST)</Txt>
          <DateTimeField dateOnly value={to} onChange={setTo} />
          {invalidDates && <Txt color="danger">End date start date के बाद चुनें।</Txt>}
          <Button
            title="Clear filters"
            variant="secondary"
            onPress={() => {
              setSearch('');
              setAgent(null);
              setStatus(null);
              setFrom(null);
              setTo(null);
            }}
          />
          <Button title="Done" disabled={invalidDates} onPress={() => setFiltersOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
