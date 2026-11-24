import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react-native';
import { agentAssignmentColumns, canViewAgentAssignmentDashboard, moduleAllowed, type AgentAssignmentDashboard } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { Button, ErrorView, Input, Loader, Txt } from '@/ui';
import { NativeCard } from './screen';

export function useAgentAssignmentReport(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agent-assignments', user?.organization?.id, user?.id, user?.role],
    queryFn: () => api<AgentAssignmentDashboard>('/broker/dashboard/agent-assignments'),
    enabled,
    refetchInterval: 60000,
  });
}

export function AgentAssignments() {
  const { user } = useAuth();
  const { modules } = useConfig();
  const { c } = useTheme();
  const allowed = canViewAgentAssignmentDashboard(user) && moduleAllowed(modules, 'team', 'BROKER_ADMIN');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const query = useAgentAssignmentReport(allowed && open);
  if (!allowed) return null;
  const columns = agentAssignmentColumns.filter(({ key }) => query.data?.columns.includes(key));
  const rows = query.data?.agents.filter(({ name }) => name.toLowerCase().includes(search.trim().toLowerCase())) ?? [];

  return (
    <NativeCard>
      <Button
        title={open ? 'Hide agent assignments' : 'Agent assignments'}
        variant="secondary"
        icon={<ClipboardList size={18} color={c.brand} />}
        onPress={() => setOpen(!open)}
      />
      {open &&
        (query.isPending ? (
          <Loader />
        ) : query.error ? (
          <ErrorView error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            <Txt v="caption" color="muted">
              Current assignees across all statuses.
            </Txt>
            {!query.data.agents.length ? (
              <Txt color="muted">
                {query.data.scope === 'MANAGED_AGENTS'
                  ? 'Your Broker Admin hasn’t selected any active agents for this report.'
                  : 'No active agents in this firm.'}
              </Txt>
            ) : (
              <>
                <Input
                  accessibilityLabel="Search assigned agents"
                  placeholder="Search agents"
                  value={search}
                  onChangeText={(value) => {
                    setSearch(value);
                    setLimit(12);
                  }}
                />
                {!rows.length && <Txt color="muted">No agents match your search.</Txt>}
                {rows.slice(0, limit).map(({ id, name, counts }) => (
                  <View key={id} style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line, gap: 4 }}>
                    <Button title={name} accessibilityLabel={`Open assignments for ${name}`} size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.push({ pathname: '/agent-assignments/[id]', params: { id } })} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
                      {columns.map(({ key, label }) => (
                        <Txt key={key} v="caption" color="muted">
                          {label} {counts[key]}
                        </Txt>
                      ))}
                    </View>
                  </View>
                ))}
                {rows.length > limit && <Button title="Show more agents" variant="secondary" size="sm" onPress={() => setLimit(limit + 12)} />}
              </>
            )}
          </>
        ))}
    </NativeCard>
  );
}
