'use client';
import { LoadingArtwork } from '@/components/ui/request-loader';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reapplySelectionChanges, type AssignmentAgentSelection, type BrokerTeamResponse } from '@brokeriq/shared';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfigStatus } from '@/lib/config';
import { patch, useApiMutation } from '@/lib/hooks';
import { DelegatedPermissions } from './delegated-permissions';

type Member = BrokerTeamResponse['members'][number] & { updatedAt: string; organization?: { name: string } };

export function TeamPermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const allowed = !!user && (isSuper || user.role === 'BROKER_ADMIN') && id !== user.id;
  const base = isSuper ? '/admin/team' : '/broker/team';
  const back = `${base}/${encodeURIComponent(id)}`;
  const member = useQuery({
    queryKey: ['team', 'member', user?.id, id],
    queryFn: () => api<{ member: Member }>(`/broker/team/${encodeURIComponent(id)}`),
    enabled: allowed,
  });
  const record = member.data?.member;
  return (
    <div className="space-y-5">
      <PageHeader
        title={record?.role === 'SUB_BROKER_ADMIN' ? 'Edit Sub-Broker Admin permissions' : 'Make Sub-Broker Admin'}
        subtitle={record?.name}
        actions={
          <Button href={back} variant="secondary">
            Back to member
          </Button>
        }
      />
      {!allowed ? (
        <p role="alert">Administrator access required.</p>
      ) : member.error && !record ? (
        <ApiErrorState error={member.error} onRetry={() => member.refetch()} />
      ) : !record ? (
        <LoadingArtwork className="h-16" label="Loading team member…" />
      ) : record.role !== 'BROKER_AGENT' && (isSuper || record.role !== 'SUB_BROKER_ADMIN') ? (
        <p>This member’s permissions cannot be changed here.</p>
      ) : (
        <PermissionForm key={record.id} member={record} back={back} onReload={async () => (await member.refetch({ throwOnError: true })).data!.member} />
      )}
    </div>
  );
}

function PermissionForm({ member, back, onReload }: { member: Member; back: string; onReload: () => Promise<Member> }) {
  const router = useRouter();
  const { loaded } = useConfigStatus();
  const { user } = useAuth();
  const editAssignmentAgents = user?.role === 'BROKER_ADMIN';
  const [agentDraft, setAgentDraft] = useState<{ baseline: string[]; selected: string[] }>();
  const [agentSearch, setAgentSearch] = useState('');
  const assignmentAgents = useQuery({
    queryKey: ['team', 'assignment-dashboard', user?.id, member.id],
    queryFn: () => api<AssignmentAgentSelection>(`/broker/team/${encodeURIComponent(member.id)}/assignment-dashboard`),
    enabled: editAssignmentAgents,
  });
  const loadedAgents = assignmentAgents.data?.selectedAgentIds ?? [];
  const selectedAgents = agentDraft?.selected ?? loadedAgents;
  const selectAgents = (selected: string[]) => setAgentDraft({ baseline: agentDraft?.baseline ?? loadedAgents, selected });
  const matchedAgents = assignmentAgents.data?.agents.filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(agentSearch.trim().toLowerCase()));
  const [baseline, setBaseline] = useState(member);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [reloaded, setReloaded] = useState(false);
  const [grants, setGrants] = useState(member.delegatedPermissions ?? []);
  const save = useApiMutation(
    () =>
      patch(`/broker/team/${encodeURIComponent(member.id)}`, {
        expectedUpdatedAt: baseline.updatedAt,
        role: 'SUB_BROKER_ADMIN',
        delegatedPermissions: grants,
        ...(agentDraft ? { assignmentDashboardAgentIds: agentDraft.selected } : {}),
      }),
    {
      success: 'Sub-Broker Admin permissions saved',
      invalidate: [['team']],
      onSuccess: () => router.replace(back),
    },
  );
  const conflict = baseline.updatedAt !== member.updatedAt || (save.error instanceof ApiError && save.error.status === 409);
  async function reload() {
    setReloading(true);
    setReloadFailed(false);
    try {
      const [latest, assignments] = await Promise.all([onReload(), editAssignmentAgents ? assignmentAgents.refetch({ throwOnError: true }) : undefined]);
      setGrants((draft) => reapplySelectionChanges(baseline.delegatedPermissions ?? [], draft, latest.delegatedPermissions ?? []));
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
    <section className="card mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {editAssignmentAgents && (
        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Agents in assignment dashboard</legend>
          <p className="text-sm text-muted">
            Select the agents this Sub-Broker Admin can see in the assignment report. Enable Today and Team viewing, plus Leads or Inventory viewing for the
            corresponding counts.
          </p>
          {assignmentAgents.isPending ? (
            <p role="status">Loading agents…</p>
          ) : assignmentAgents.error ? (
            <ApiErrorState error={assignmentAgents.error} onRetry={() => assignmentAgents.refetch()} />
          ) : (
            <>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="sr-only">Find agents</span>
                <input
                  type="search"
                  placeholder="Find agents"
                  value={agentSearch}
                  onChange={(event) => setAgentSearch(event.target.value)}
                  className="min-h-11 w-full max-w-72 rounded-xl border border-line bg-surface px-3"
                />
                <span className="text-muted">{selectedAgents.length} selected</span>
              </label>
              <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                {matchedAgents?.map(({ id, name, email }) => (
                  <label key={id} className="flex min-h-11 items-center gap-2 rounded-lg bg-surface-2 px-3 py-1">
                    <input
                      type="checkbox"
                      checked={selectedAgents.includes(id)}
                      onChange={(event) => selectAgents(event.target.checked ? [...selectedAgents, id] : selectedAgents.filter((agentId) => agentId !== id))}
                    />
                    <span className="min-w-0 break-words text-sm">
                      {name}
                      <span className="block text-xs text-muted">{email}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!matchedAgents?.length && <p className="text-sm text-muted">No eligible agents match.</p>}
            </>
          )}
        </fieldset>
      )}
      <DelegatedPermissions value={grants} onChange={setGrants} />
      <Button loading={save.isPending} disabled={!loaded || conflict || reloading} onClick={() => save.mutate(undefined)}>
        Save permissions
      </Button>
      {conflict && (
        <div className="space-y-2">
          <p role="alert">{reloadFailed ? 'Could not reload permissions. Try again.' : 'This member changed while you were editing.'}</p>
          <Button variant="secondary" loading={reloading} onClick={() => void reload()}>
            Reload and review
          </Button>
        </div>
      )}
      {reloaded && !conflict && (
        <p role="status" className="text-sm text-muted">
          Your changes are ready to review and save.
        </p>
      )}
    </section>
  );
}
