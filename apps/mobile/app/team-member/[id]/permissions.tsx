import { useState } from 'react';
import { View } from 'react-native';

import { ScrollView } from '@/components/keyboard-scroll-view';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { reapplySelectionChanges, roleModulePermissions, delegatedGrant, type AssignmentAgentSelection, type BrokerTeamResponse } from '@brokeriq/shared';
import { DelegatedPermissions } from '@/components/delegated-permissions';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { ApiError, api, patch } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { goBack } from '@/lib/navigation';
import { Button, Chip, ErrorView, Input, Loader, Txt } from '@/ui';

type Member = BrokerTeamResponse['members'][number] & { updatedAt: string };

export default function TeamPermissions() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const roleMode = mode === 'role';
  const { user } = useAuth();
  const allowed = !!id && user?.role === 'BROKER_ADMIN' && !user.rolePermissions && id !== user.id;
  const q = useQuery({
    queryKey: ['team', 'member', user?.id, id],
    queryFn: () => api<{ member: Member }>(`/broker/team/${encodeURIComponent(id)}`),
    enabled: allowed,
  });
  const member = q.data?.member;
  return (
    <BrokerScreen title={roleMode ? 'Edit module permissions' : 'Sub-Broker Admin permissions'} subtitle={member?.name} back>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 12 }}>
          {!allowed ? (
            <Txt>Broker Admin access required.</Txt>
          ) : q.error && !member ? (
            <ErrorView error={q.error} onRetry={() => q.refetch()} />
          ) : !member ? (
            <Loader />
          ) : !(roleMode ? ['BROKER_AGENT', 'BROKER_ADMIN'] : ['BROKER_AGENT', 'SUB_BROKER_ADMIN']).includes(member.role) ? (
            <Txt>This member’s permissions cannot be changed here.</Txt>
          ) : (
            <PermissionEditor key={member.id + ':' + roleMode} roleMode={roleMode} member={member} onReload={async () => (await q.refetch({ throwOnError: true })).data!.member} />
          )}
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}

function PermissionEditor({ member, onReload, roleMode }: { member: Member; roleMode: boolean; onReload: () => Promise<Member> }) {
  const [baseline, setBaseline] = useState(member);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [reloaded, setReloaded] = useState(false);
  const { user } = useAuth();
  const { modules, loaded } = useConfig();
  const defaults = (record: Member) => roleModulePermissions(modules, record.role)
    .flatMap(({ key, actions }) => actions.map((action) => delegatedGrant(key, action)))
    .filter((grant) => record.agentChatEnabled !== false || grant !== 'inbox:view');
  const current = (record: Member) => roleMode ? record.rolePermissions ?? defaults(record) : record.delegatedPermissions ?? [];
  const [draftGrants, setGrants] = useState<string[] | null>(null);
  const grants = draftGrants ?? current(member);
  const [agentDraft, setAgentDraft] = useState<{ baseline: string[]; selected: string[] }>();
  const [agentSearch, setAgentSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const assignmentAgents = useQuery({
    queryKey: ['team', 'assignment-dashboard', user?.id, member.id],
    queryFn: () => api<AssignmentAgentSelection>(`/broker/team/${encodeURIComponent(member.id)}/assignment-dashboard`),
    enabled: !roleMode,
  });
  const loadedAgents = assignmentAgents.data?.selectedAgentIds ?? [];
  const selectedAgents = agentDraft?.selected ?? loadedAgents;
  const selectAgents = (selected: string[]) => setAgentDraft({ baseline: agentDraft?.baseline ?? loadedAgents, selected });
  const matchedAgents =
    assignmentAgents.data?.agents.filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(agentSearch.trim().toLowerCase())) ?? [];
  const save = useApiMutation(
    () =>
      patch(`/broker/team/${member.id}`, {
        expectedUpdatedAt: baseline.updatedAt,
        role: 'SUB_BROKER_ADMIN',
        delegatedPermissions: grants,
        ...(agentDraft ? { assignmentDashboardAgentIds: agentDraft.selected } : {}),
      }),
    {
      success: roleMode ? 'Module permissions saved' : 'Sub-Broker Admin permissions saved',
      invalidate: [['team']],
      onSuccess: () => goBack({ pathname: '/team-member/[id]', params: { id: member.id } }),
    },
  );
  const conflict = baseline.updatedAt !== member.updatedAt || (save.error instanceof ApiError && save.error.status === 409);
  async function reload() {
    setReloading(true);
    setReloadFailed(false);
    try {
      const [latest, assignments] = await Promise.all([onReload(), roleMode ? undefined : assignmentAgents.refetch({ throwOnError: true })]);
      setGrants((draft) => reapplySelectionChanges(current(baseline), draft ?? current(baseline), current(latest)));
      if (assignments?.data) {
        const { selectedAgentIds, agents } = assignments.data;
        setAgentDraft(
          (draft) =>
            draft && {
              baseline: selectedAgentIds,
              selected: reapplySelectionChanges(draft.baseline, draft.selected, selectedAgentIds).filter((id) => agents.some((agent) => agent.id === id)),
            },
        );
      }
      setBaseline(latest);
      setReloaded(true);
      save.reset();
    } catch {
      setReloadFailed(true);
    } finally {
      setReloading(false);
    }
  }
  return (
    <>
      {!roleMode && <NativeCard>
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
                  onPress={() => selectAgents(selectedAgents.includes(id) ? selectedAgents.filter((agentId) => agentId !== id) : [...selectedAgents, id])}
                />
                <Txt v="caption" color="muted">
                  {email}
                </Txt>
              </View>
            ))}
            {matchedAgents.length > limit && <Button title="Show more agents" variant="secondary" size="sm" onPress={() => setLimit(limit + 12)} />}
          </>
        )}
      </NativeCard>}
      <DelegatedPermissions role={roleMode ? member.role : undefined} value={grants} onChange={setGrants} />
      <Button title="Save permissions" loading={save.isPending} disabled={!loaded || conflict || reloading} onPress={() => save.mutate(undefined)} />
      {conflict && (
        <>
          <Txt color="danger">{reloadFailed ? 'Could not reload permissions. Try again.' : 'This member changed while you were editing.'}</Txt>
          <Button title="Reload and review" variant="secondary" loading={reloading} onPress={() => void reload()} />
        </>
      )}
      {reloaded && !conflict && <Txt color="muted">Your changes are ready to review and save.</Txt>}
    </>
  );
}
