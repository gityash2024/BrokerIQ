import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { agentAssignmentColumns, readableValue, type AgentAssignmentKind, type AgentAssignmentRecords } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Chip, ErrorView, Loader, Sheet, Txt } from '@/ui';
import { NativeCard } from './screen';

export function AgentAssignmentDetails({
  agent,
  columns,
  onClose,
}: {
  agent: { id: string; name: string };
  columns: AgentAssignmentKind[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [selectedKind, setKind] = useState(columns[0]);
  const [page, setPage] = useState(1);
  const kind = columns.includes(selectedKind) ? selectedKind : columns[0];
  const query = useQuery({
    queryKey: ['agent-assignment-records', user?.organization?.id, user?.id, agent.id, kind, page],
    queryFn: () => api<AgentAssignmentRecords>(`/broker/dashboard/agent-assignments/${encodeURIComponent(agent.id)}?kind=${kind}&page=${page}`),
    enabled: !!kind,
  });
  function open(recordId: string) {
    onClose();
    if (kind === 'properties') router.push({ pathname: '/inventory/[id]', params: { id: recordId } });
    else if (kind === 'requirements') router.push({ pathname: '/requirement-edit', params: { id: recordId } });
    else router.push({ pathname: '/lead/[id]', params: { id: recordId, tab: kind === 'leads' ? 'timeline' : 'tasks' } });
  }

  return (
    <Sheet open full onClose={onClose} title={`${agent.name} · Assignments`} footer={<Button title="Close" variant="secondary" onPress={onClose} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {agentAssignmentColumns
          .filter(({ key }) => columns.includes(key))
          .map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              active={key === kind}
              onPress={() => {
                setKind(key);
                setPage(1);
              }}
            />
          ))}
      </View>
      {query.error ? (
        <ErrorView error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <Loader />
      ) : (
        <>
          {!query.data.items.length && <Txt color="muted">No assigned records on this page.</Txt>}
          {query.data.items.map(({ id, recordId, title, status, summary, at }) => (
            <NativeCard key={id}>
              <Txt v="bodyStrong">{title}</Txt>
              <Txt v="caption" color="muted">
                {readableValue(status)}
                {at ? ` · ${new Date(at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}
              </Txt>
              {summary && <Txt v="caption">{summary}</Txt>}
              <Button title="Open record" accessibilityLabel={`Open ${title}`} variant="secondary" size="sm" onPress={() => open(recordId)} />
            </NativeCard>
          ))}
          {(page > 1 || query.data.hasMore) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Button title="Previous" size="sm" variant="secondary" disabled={page === 1} onPress={() => setPage(page - 1)} />
              <Txt v="caption">{`Page ${page}`}</Txt>
              <Button title="Next" size="sm" variant="secondary" disabled={!query.data.hasMore} onPress={() => setPage(page + 1)} />
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}
