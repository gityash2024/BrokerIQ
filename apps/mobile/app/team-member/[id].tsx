import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { type BrokerTeamResponse, timeAgo } from '@brokeriq/shared';
import { api, patch, del } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { Avatar, Badge, Button, Card, ErrorView, Header, Input, Row, Screen, Skeleton, Txt } from '@/ui';

type Member = BrokerTeamResponse['members'][number] & { updatedAt: string; organization?: { name: string } };
export default function TeamMemberPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['team', 'member', id],
    queryFn: () => api<{ member: Member }>(`/broker/team/${encodeURIComponent(id)}`),
    enabled: !!id && user?.role === 'BROKER_ADMIN',
  });
  return (
    <Screen keyboard contentStyle={{ padding: 16, gap: 14 }}>
      <Header title="सदस्य विवरण" subtitle="Team & Agents / Member" />
      {q.isError ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <MemberEditor key={`${user?.id}:${id}`} member={q.data.member} refresh={() => q.refetch()} />
      ) : (
        <Skeleton h={160} />
      )}
    </Screen>
  );
}
function MemberEditor({ member, refresh }: { member: Member; refresh: () => Promise<unknown> }) {
  const router = useRouter();
  const { user } = useAuth();
  const [baseline, setBaseline] = useState(member.updatedAt);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone || '');
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ['monthlyDeals', 'monthlyLeads', 'monthlyRevenue', 'commissionPct'].map((key) => [
        key,
        member.targets?.[key as keyof NonNullable<Member['targets']>]?.toString() ?? '',
      ]),
    ),
  );
  const update = useApiMutation(
    (body: Record<string, unknown>) => patch<{ updatedAt: string }>(`/broker/team/${member.id}`, { ...body, expectedUpdatedAt: baseline }),
    {
      invalidate: [['team']],
      success: 'सदस्य अपडेट हो गया',
      onSuccess: (result) => {
        setBaseline(result.updatedAt);
        refresh();
      },
    },
  );
  const remove = useApiMutation(() => del(`/broker/team/${member.id}`), {
    invalidate: [['team']],
    success: 'सदस्य टीम से हटाया गया',
    onSuccess: () => router.replace('/team'),
  });
  const self = member.id === user?.id;
  const location = member.lastLocation;
  const invalid = Object.entries(targets).some(
    ([key, value]) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || (key === 'commissionPct' && Number(value) > 100)),
  );
  const busy = update.isPending || remove.isPending;
  return (
    <>
      <Button title="टीम सूची" variant="ghost" onPress={() => router.replace('/team')} />
      <Card style={{ padding: 16, gap: 12 }}>
        <Row gap={12}>
          <Avatar name={member.name} uri={member.avatarUrl} size={48} />
          <View style={{ flex: 1 }}>
            <Txt v="h2">{member.name}</Txt>
            <Txt color="muted">{member.email}</Txt>
            <Txt color="muted">{member.organization?.name}</Txt>
          </View>
        </Row>
        <Row gap={8}>
          <Badge label={member.role} />
          <Badge label={member.status} />
          <Badge label={`KYC: ${member.kycStatus}`} />
        </Row>
      </Card>
      {member.updatedAt !== baseline && (
        <Card style={{ padding: 14, gap: 8 }}>
          <Txt color="danger">इस सदस्य में दूसरे बदलाव आए हैं। अपना draft देखकर नए बदलाव लें; पुराना edit save नहीं होगा।</Txt>
          <Button
            title="नए बदलाव लें"
            variant="secondary"
            onPress={() => {
              setBaseline(member.updatedAt);
              setName(member.name);
              setPhone(member.phone || '');
              setTargets(
                Object.fromEntries(
                  ['monthlyDeals', 'monthlyLeads', 'monthlyRevenue', 'commissionPct'].map((key) => [
                    key,
                    member.targets?.[key as keyof NonNullable<Member['targets']>]?.toString() ?? '',
                  ]),
                ),
              );
            }}
          />
        </Card>
      )}
      <Card style={{ padding: 16, gap: 10 }}>
        <Txt v="bodyStrong">पिछली दर्ज लोकेशन</Txt>
        {location ? (
          <>
            <Txt>{timeAgo(location.capturedAt)}</Txt>
            <Txt color="muted">{(location as any).address || 'Address उपलब्ध नहीं है'}</Txt>
            <Txt>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · Accuracy:{' '}
              {location.accuracy == null ? 'अज्ञात' : `±${Math.round(location.accuracy)}m`}
            </Txt>
            <Button
              title="Maps में देखें"
              variant="secondary"
              onPress={() => Linking.openURL(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`)}
            />
          </>
        ) : (
          <Txt color="muted">अभी कोई location record नहीं है। Tracking केवल अनुमति वाली active shift में होती है।</Txt>
        )}
      </Card>
      <Card style={{ padding: 16, gap: 12 }}>
        <Txt v="bodyStrong">प्रोफाइल</Txt>
        <Input label="नाम" value={name} onChangeText={setName} />
        <Input label="फोन" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Card>
      <Card style={{ padding: 16, gap: 12 }}>
        <Txt v="bodyStrong">मासिक लक्ष्य</Txt>
        <Txt color="muted">
          Won: {member.fulfillment?.dealsWonMonth ?? 0} · इस महीने मिली Leads: {(member.fulfillment as any)?.leadsReceivedMonth ?? 0}
        </Txt>
        {Object.entries({
          monthlyDeals: 'Deals target',
          monthlyLeads: 'Leads target',
          monthlyRevenue: 'Revenue target (₹)',
          commissionPct: 'Commission %',
        }).map(([key, label]) => (
          <Input
            key={key}
            label={label}
            value={targets[key]}
            onChangeText={(value) => setTargets((old) => ({ ...old, [key]: value }))}
            placeholder="Not set"
            keyboardType="decimal-pad"
          />
        ))}
        <Txt color="muted">खाली target को zero नहीं माना जाएगा।</Txt>
      </Card>
      <Button
        title="बदलाव सेव करें"
        loading={update.isPending}
        disabled={busy || invalid || name.trim().length < 2 || baseline !== member.updatedAt}
        onPress={() =>
          update.mutate({
            name: name.trim(),
            phone: phone.trim() || null,
            targets: Object.fromEntries(
              Object.entries(targets)
                .filter(([, value]) => value !== '')
                .map(([key, value]) => [key, Number(value)]),
            ),
          })
        }
      />
      <Card style={{ padding: 16, gap: 10 }}>
        <Txt v="bodyStrong">KYC और समय</Txt>
        <Button title="KYC module खोलें" variant="secondary" onPress={() => router.push(`/(broker)/kyc?member=${member.id}` as any)} />
        <Button title="Time logging खोलें" variant="secondary" onPress={() => router.push(`/time-logging?memberId=${member.id}` as any)} />
      </Card>
      {!self && (
        <Card style={{ padding: 16, gap: 10 }}>
          <Txt v="bodyStrong">Team actions</Txt>
          <Button
            title={member.role === 'BROKER_ADMIN' ? 'Agent बनाएँ' : 'Admin बनाएँ'}
            variant="secondary"
            disabled={busy || baseline !== member.updatedAt}
            onPress={() =>
              Alert.alert('भूमिका बदलें?', `${member.name} की access permissions और sessions बदलेंगे।`, [
                { text: 'रद्द', style: 'cancel' },
                { text: 'बदलें', onPress: () => update.mutate({ role: member.role === 'BROKER_ADMIN' ? 'BROKER_AGENT' : 'BROKER_ADMIN' }) },
              ])
            }
          />
          <Button
            title={member.status === 'ACTIVE' ? 'Suspend करें' : 'Reactivate करें'}
            variant="secondary"
            disabled={busy || baseline !== member.updatedAt}
            onPress={() => update.mutate({ status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
          />
          <Button
            title="Team से हटाएँ"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              Alert.alert('सदस्य हटाएँ?', `${member.name} की firm access समाप्त होगी। पहले जरूरी काम reassign करें।`, [
                { text: 'रद्द', style: 'cancel' },
                { text: 'हटाएँ', style: 'destructive', onPress: () => remove.mutate(undefined) },
              ])
            }
          />
        </Card>
      )}
    </>
  );
}
