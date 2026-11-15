import { useState } from 'react';

import { ScrollView } from '@/components/keyboard-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { BrokerTeamResponse } from '@brokeriq/shared';
import { DelegatedPermissions } from '@/components/delegated-permissions';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { api, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { Button, ErrorView, Loader, Txt } from '@/ui';

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
  const [grants, setGrants] = useState(member.delegatedPermissions ?? []);
  const save = useApiMutation(
    () =>
      patch(`/broker/team/${member.id}`, {
        expectedUpdatedAt: revision,
        role: 'SUB_BROKER_ADMIN',
        delegatedPermissions: grants,
      }),
    {
      success: 'Sub-Broker Admin permissions saved',
      invalidate: [['team']],
      onSuccess: () => router.back(),
    },
  );
  return (
    <>
      <DelegatedPermissions value={grants} onChange={setGrants} />
      <Button title="Save permissions" loading={save.isPending} disabled={revision !== member.updatedAt} onPress={() => save.mutate(undefined)} />
      {revision !== member.updatedAt && <Txt color="danger">This member was updated. Reload to review the current permissions.</Txt>}
    </>
  );
}
