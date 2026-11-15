'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { BrokerTeamResponse } from '@brokeriq/shared';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
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
      ) : member.error ? (
        <ApiErrorState error={member.error} onRetry={() => member.refetch()} />
      ) : !record ? (
        <p role="status">Loading team member…</p>
      ) : record.role !== 'BROKER_AGENT' && (isSuper || record.role !== 'SUB_BROKER_ADMIN') ? (
        <p>This member’s permissions cannot be changed here.</p>
      ) : (
        <PermissionForm key={record.id} member={record} back={back} />
      )}
    </div>
  );
}

function PermissionForm({ member, back }: { member: Member; back: string }) {
  const router = useRouter();
  const { loaded } = useConfigStatus();
  const [revision] = useState(member.updatedAt);
  const [grants, setGrants] = useState(member.delegatedPermissions ?? []);
  const save = useApiMutation(
    () =>
      patch(`/broker/team/${encodeURIComponent(member.id)}`, {
        expectedUpdatedAt: revision,
        role: 'SUB_BROKER_ADMIN',
        delegatedPermissions: grants,
      }),
    {
      success: 'Sub-Broker Admin permissions saved',
      invalidate: [['team']],
      onSuccess: () => router.replace(back),
    },
  );
  return (
    <section className="card mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <DelegatedPermissions value={grants} onChange={setGrants} />
      <Button loading={save.isPending} disabled={!loaded || revision !== member.updatedAt} onClick={() => save.mutate(undefined)}>
        Save permissions
      </Button>
      {revision !== member.updatedAt && <p role="alert">This member was updated. Reload to review the current permissions.</p>}
    </section>
  );
}
