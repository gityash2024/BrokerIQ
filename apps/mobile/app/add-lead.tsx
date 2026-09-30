import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react-native';
import { LEAD_SOURCE_LABELS } from '@brokeriq/shared';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { useTeam } from '@/components/crm';
import { Button, Chip, Header, Input, Row, Screen, Txt } from '@/ui';

const SOURCES = ['WALK_IN', 'CALL', 'REFERRAL', 'WHATSAPP', 'HOUSING', 'ACRES99', 'MAGICBRICKS', 'NOBROKER', 'FACEBOOK', 'INSTAGRAM', 'MANUAL'] as const;

export default function AddLead() {
  const qc = useQueryClient();
  const { isBrokerAdmin } = useAuth();
  const team = useTeam();
  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'CALL',
    notes: '',
    assignedToId: '',
    bedrooms: [] as number[],
    maxBudget: '',
    purpose: 'RENT',
  });
  const save = useApiMutation(
    () =>
      post<any>('/leads', {
        name: f.name,
        phone: f.phone,
        email: f.email || '',
        source: f.source,
        notes: f.notes || null,
        assignedToId: f.assignedToId || null,
        requirement: { purpose: f.purpose, bedrooms: f.bedrooms, maxBudget: f.maxBudget ? Number(f.maxBudget) : null, propertyTypes: [], localityIds: [] },
      }),
    {
      success: (r: any) => (r.duplicate ? 'यह number पहले से था — lead update हो गई' : 'Lead जुड़ गई ✅'),
      onSuccess: (r: any) => {
        qc.invalidateQueries({ queryKey: ['leads'] });
        qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
        router.replace(`/lead/${r.lead?.id ?? r.id}`);
      },
    },
  );
  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="नई lead" />
      <Input label="नाम *" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} containerStyle={{ marginTop: 8 }} />
      <Input label="Mobile *" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" containerStyle={{ marginTop: 12 }} />
      <Input
        label="Email"
        value={f.email}
        onChangeText={(v) => setF({ ...f, email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        containerStyle={{ marginTop: 12 }}
      />
      <Txt v="label" color="subtle" style={{ marginTop: 16, marginBottom: 8 }}>
        Source
      </Txt>
      <Row wrap>
        {SOURCES.map((s) => (
          <Chip key={s} label={LEAD_SOURCE_LABELS[s]} active={f.source === s} onPress={() => setF({ ...f, source: s })} />
        ))}
      </Row>
      <Txt v="label" color="subtle" style={{ marginTop: 16, marginBottom: 8 }}>
        Requirement
      </Txt>
      <Row wrap>
        {[1, 2, 3, 4, 5].map((b) => (
          <Chip
            key={b}
            label={`${b} BHK`}
            active={f.bedrooms.includes(b)}
            onPress={() => setF({ ...f, bedrooms: f.bedrooms.includes(b) ? f.bedrooms.filter((x) => x !== b) : [...f.bedrooms, b] })}
          />
        ))}
      </Row>
      <Input
        label="Max rent budget (₹/month)"
        value={f.maxBudget}
        onChangeText={(v) => setF({ ...f, maxBudget: v.replace(/\D/g, '') })}
        keyboardType="numeric"
        containerStyle={{ marginTop: 12 }}
      />
      {isBrokerAdmin && (
        <>
          <Txt v="label" color="subtle" style={{ marginTop: 16, marginBottom: 8 }}>
            Assign to
          </Txt>
          <Row wrap>
            <Chip label="Auto / मुझे" active={!f.assignedToId} onPress={() => setF({ ...f, assignedToId: '' })} />
            {(team.data?.members ?? [])
              .filter((m: any) => m.status === 'ACTIVE')
              .map((m: any) => (
                <Chip key={m.id} label={m.name} active={f.assignedToId === m.id} onPress={() => setF({ ...f, assignedToId: m.id })} />
              ))}
          </Row>
        </>
      )}
      <Input label="Notes" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} multiline containerStyle={{ marginTop: 12 }} />
      <Button
        title="Lead save करें"
        icon={<UserPlus size={18} color="#fff" />}
        size="lg"
        style={{ marginTop: 20 }}
        loading={save.isPending}
        disabled={!f.name || f.phone.length < 10}
        onPress={() => save.mutate(undefined)}
      />
    </Screen>
  );
}
