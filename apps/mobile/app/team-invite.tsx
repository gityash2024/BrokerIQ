import { useState } from 'react';
import { Share, View } from 'react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { router } from 'expo-router';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { DelegatedPermissions } from '@/components/delegated-permissions';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { Button, Chip, Input, Txt } from '@/ui';

export default function TeamInvite() {
  const { isBrokerAdmin } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const [permissions, setPermissions] = useState<string[]>([]);
  const invite = useApiMutation(
    () =>
      post<{ link: string; emailed: boolean }>('/broker/team/invite', {
        ...form,
        ...(form.role === 'SUB_BROKER_ADMIN' ? { delegatedPermissions: permissions } : {}),
      }),
    {
      invalidate: [['team']],
      success: (result) => (result.emailed ? 'Invite email भेजी गई' : 'Invite link बना'),
      onSuccess: async (result) => {
        await Share.share({ message: `${form.name}, हमारी BrokerIQ team join करें: ${result.link}` });
        router.replace('/team');
      },
    },
  );

  return (
    <BrokerScreen title="Invite Team Member" back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 14 }}>
          {!isBrokerAdmin ? (
            <Txt>Broker Admin access required.</Txt>
          ) : (
            <>
              <Input label="नाम" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
              <Input
                label="Email"
                value={form.email}
                onChangeText={(email) => setForm({ ...form, email })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(
                  [
                    ['BROKER_AGENT', 'Agent'],
                    ['BROKER_ADMIN', 'Admin'],
                    ['SUB_BROKER_ADMIN', 'Sub-Broker Admin'],
                  ] as const
                ).map(([role, label]) => (
                  <Chip key={role} label={label} active={form.role === role} onPress={() => setForm({ ...form, role })} />
                ))}
              </View>
              {form.role === 'SUB_BROKER_ADMIN' && <DelegatedPermissions value={permissions} onChange={setPermissions} />}
              <Button title="Send invite" loading={invite.isPending} disabled={!form.name || !form.email} onPress={() => invite.mutate(undefined)} />
            </>
          )}
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
