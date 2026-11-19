import { useState } from 'react';
import { View } from 'react-native';

import { ScrollView } from '@/components/keyboard-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { AssignmentAgentSelection, BrokerTeamResponse } from '@brokeriq/shared';
import { DelegatedPermissions } from '@/components/delegated-permissions';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { api, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { Button, Chip, ErrorView, Input, Loader, Txt } from '@/ui';

type Member = BrokerTeamResponse['members'][number] & { updatedAt: string };

export default function TeamPermissions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = !!id && user?.role === 'BROKER_ADMIN' && id !== user.id;
  const q = useQuery({
    queryKey: ['team', 'member', user?.id, id],
    queryFn: () => api<{ member: Member }>(`/broker/team/${encodeURIComponent(id)}`),
    enabled: allowed,
  });
  const member = q.data?.member;
  return (
    <BrokerScreen title="Sub-Broker Admin permissions" subtitle={member?.name} back>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 12 }}>
          {!allowed ? (
            <Txt>Broker Admin access required.</Txt>
          ) : q.error ? (
            <ErrorView error={q.error} onRetry={() => q.refetch()} />
          ) : !member ? (
            <Loader />
          ) : !['BROKER_AGENT', 'SUB_BROKER_ADMIN'].includes(member.role) ? (
            <Txt>This member’s permissions cannot be changed here.</Txt>
          ) : (
            <PermissionEditor key={member.id} member={member} />
          )}
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}

function PermissionEditor({ member }: { member: Member }) {
  const [revision] = useState(member.updatedAt);
  const { user } = useAuth();
  const [grants, setGrants] = useState(member.delegatedPermissions ?? []);
  const [draftAgentIds, setDraftAgentIds] = useState<string[]>();
  const [agentSearch, setAgentSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const assignmentAgents = useQuery({
    queryKey: ['team', 'assignment-dashboard', user?.id, member.id],
    queryFn: () => api<AssignmentAgentSelection>(`/broker/team/${encodeURIComponent(member.id)}/assignment-dashboard`),
  });
  const selectedAgents = draftAgentIds ?? assignmentAgents.data?.selectedAgentIds ?? [];
  const matchedAgents =
    assignmentAgents.data?.agents.filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(agentSearch.trim().toLowerCase())) ?? [];
  const save = useApiMutation(
    () =>
      patch(`/broker/team/${member.id}`, {
        expectedUpdatedAt: revision,
        role: 'SUB_BROKER_ADMIN',
        delegatedPermissions: grants,
        ...(draftAgentIds ? { assignmentDashboardAgentIds: draftAgentIds } : {}),
      }),
    {
      success: 'Sub-Broker Admin permissions saved',
      invalidate: [['team']],
      onSuccess: () => router.back(),
    },
  );
  return (
    <>
      <NativeCard>
        <Txt v="bodyStrong">Agents in assignment dashboard</Txt>
        <Txt v="caption" color="muted">
          Enable Today and Team viewing, plus Leads or Inventory viewing for the corresponding counts.
        </Txt>
        {assignmentAgents.isPending ? (
          <Loader />
        ) : assignmentAgents.error ? (
          <ErrorView error={assignmentAgents.error} onRetry={() => assignmentAgents.refetch()} />
        ) : (
          <>
            <Input
              accessibilityLabel="Find agents"
              placeholder="Find agents"
              value={agentSearch}
              onChangeText={(value) => {
                setAgentSearch(value);
                setLimit(12);
              }}
            />
            <Txt v="caption" color="muted">
              {selectedAgents.length} selected
            </Txt>
            {!matchedAgents.length && <Txt color="muted">No eligible agents match.</Txt>}
            {matchedAgents.slice(0, limit).map(({ id, name, email }) => (
              <View key={id} style={{ gap: 2 }}>
                <Chip
                  label={name}
                  active={selectedAgents.includes(id)}
                  onPress={() => setDraftAgentIds(selectedAgents.includes(id) ? selectedAgents.filter((agentId) => agentId !== id) : [...selectedAgents, id])}
                />
                <Txt v="caption" color="muted">
                  {email}
                </Txt>
              </View>
            ))}
            {matchedAgents.length > limit && <Button title="Show more agents" variant="secondary" size="sm" onPress={() => setLimit(limit + 12)} />}
          </>
        )}
      </NativeCard>
      <DelegatedPermissions value={grants} onChange={setGrants} />
      <Button title="Save permissions" loading={save.isPending} disabled={revision !== member.updatedAt} onPress={() => save.mutate(undefined)} />
      {revision !== member.updatedAt && <Txt color="danger">This member was updated. Reload to review the current permissions.</Txt>}
    </>
  );
}
