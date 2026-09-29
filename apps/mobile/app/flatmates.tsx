import { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react-native';
import { OFFICE_HUBS, formatINR, whatsappLink } from '@brokeriq/shared';
import { api, patch, post } from '@/lib/api';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Avatar, Badge, Button, Card, Chip, Empty, Header, Input, Loader, Row, Screen, Segmented, Txt } from '@/ui';

/** Flatmate / room-share matching; phone only after both accept. */
export default function Flatmates() {
  const me = useQuery({ queryKey: ['flatmate-me'], queryFn: () => api<any>('/flatmates/me') });
  const [tab, setTab] = useState<'matches' | 'requests' | 'profile'>('matches');
  useEffect(() => {
    if (me.isSuccess && !me.data) setTab('profile');
  }, [me.isSuccess, me.data]);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Flatmates" subtitle="Number दोनों की सहमति के बाद" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'matches', label: 'Matches' }, { value: 'requests', label: 'Requests' }, { value: 'profile', label: 'Profile' }]} />
      {tab === 'profile' ? <ProfileForm initial={me.data} onSaved={() => (me.refetch(), setTab('matches'))} /> : tab === 'matches' ? <Matches enabled={!!me.data} /> : <Requests />}
    </Screen>
  );
}

function ProfileForm({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const { c } = useTheme();
  const [f, setF] = useState<any>({ lookingFor: 'FLATMATE', gender: 'MALE', prefGender: 'ANY', budgetMax: '', officeHub: '', food: 'ANY', smoking: false, about: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial) setF({ ...initial, budgetMax: initial.budgetMax ? String(initial.budgetMax) : '', officeHub: initial.officeHub ?? '', about: initial.about ?? '' });
  }, [initial]);
  const save = async () => {
    setBusy(true);
    try {
      await post('/flatmates/me', { lookingFor: f.lookingFor, gender: f.gender, prefGender: f.prefGender, budgetMax: f.budgetMax ? Number(f.budgetMax) : null, localityIds: f.localityIds ?? [], officeHub: f.officeHub || null, food: f.food, smoking: !!f.smoking, drinking: !!f.drinking, pets: !!f.pets, about: f.about || null, isActive: true });
      toast.success('Profile saved');
      onSaved();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const chips = (key: string, opts: [string, string][]) => <Row wrap>{opts.map(([v, l]) => <Chip key={v} label={l} active={f[key] === v} onPress={() => setF({ ...f, [key]: v })} />)}</Row>;
  return (
    <Card style={{ padding: 14, gap: 10, marginTop: 12 }}>
      <Txt v="label" color="muted">मैं ढूँढ रहा/रही हूँ</Txt>
      {chips('lookingFor', [['FLATMATE', 'Flatmate'], ['ROOM', 'Room']])}
      <Txt v="label" color="muted">मैं</Txt>
      {chips('gender', [['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']])}
      <Txt v="label" color="muted">Flatmate चाहिए</Txt>
      {chips('prefGender', [['ANY', 'कोई भी'], ['MALE', 'Male'], ['FEMALE', 'Female']])}
      <Input label="अपना हिस्सा (₹/month)" value={f.budgetMax} onChangeText={(v) => setF({ ...f, budgetMax: v.replace(/\D/g, '') })} keyboardType="number-pad" />
      <Txt v="label" color="muted">Office</Txt>
      <Row wrap>{OFFICE_HUBS.map((h) => <Chip key={h.key} label={h.name} active={f.officeHub === h.key} onPress={() => setF({ ...f, officeHub: f.officeHub === h.key ? '' : h.key })} />)}</Row>
      <Txt v="label" color="muted">Food</Txt>
      {chips('food', [['ANY', 'कोई भी'], ['VEG', 'Veg'], ['NONVEG', 'Non-veg']])}
      <Row gap={10}><Switch value={!!f.smoking} onValueChange={(v) => setF({ ...f, smoking: v })} trackColor={{ true: c.brand }} /><Txt v="small">Smoking</Txt></Row>
      <Input label="अपने बारे में" value={f.about} onChangeText={(v) => setF({ ...f, about: v })} multiline />
      <Button title="Save" loading={busy} onPress={save} />
    </Card>
  );
}

function Matches({ enabled }: { enabled: boolean }) {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['flatmate-matches'], queryFn: () => api<any[]>('/flatmates/matches'), enabled });
  if (!enabled) return <Empty icon={<Users size={26} color={c.brand} />} title="पहले profile बनाएँ" />;
  if (q.isLoading) return <Loader />;
  if (!q.data?.length) return <Empty icon={<Users size={26} color={c.brand} />} title="अभी कोई match नहीं" />;
  return (
    <>
      {q.data.map((m) => (
        <Card key={m.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
          <Row gap={10}>
            <Avatar name={m.name} uri={m.avatarUrl} size={40} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong">{m.name}</Txt>
              <Txt v="caption" color="muted">{`${m.lookingFor === 'ROOM' ? 'Room ढूँढ रहे' : 'Flatmate ढूँढ रहे'}${m.budgetMax ? ` · ${formatINR(m.budgetMax)} तक` : ''}`}</Txt>
            </View>
            <Badge label={`${m.score}%`} color={c.success} />
          </Row>
          {!!m.about && <Txt v="small" numberOfLines={3}>{m.about}</Txt>}
          {m.connection ? <Badge label={m.connection.status === 'ACCEPTED' ? 'Connected' : 'Request भेजी'} color={c.brand} /> : <Button title="Connect" size="sm" onPress={() => post(`/flatmates/connect/${m.userId}`, {}).then(() => (toast.success('Request भेजी'), q.refetch())).catch(showError)} />}
        </Card>
      ))}
    </>
  );
}

function Requests() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['flatmate-connections'], queryFn: () => api<any[]>('/flatmates/connections') });
  const respond = useApiMutation((b: { id: string; status: string }) => patch(`/flatmates/connections/${b.id}`, { status: b.status }), { success: 'Updated', invalidate: [['flatmate-connections']] });
  if (q.isLoading) return <Loader />;
  if (!q.data?.length) return <Empty icon={<Users size={26} color={c.brand} />} title="कोई request नहीं" />;
  return (
    <>
      {q.data.map((r) => (
        <Card key={r.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
          <Txt v="bodyStrong">{r.other.name}</Txt>
          <Txt v="caption" color="muted">{r.status === 'ACCEPTED' ? 'Connected' : r.incoming ? 'आपके लिए request' : 'Request भेजी'}</Txt>
          <Row>
            {!!r.other.phone && <Button title="WhatsApp" size="sm" variant="whatsapp" onPress={() => Linking.openURL(whatsappLink(r.other.phone, 'नमस्ते, BrokerIQ flatmates से'))} />}
            {r.incoming && r.status === 'PENDING' && (
              <>
                <Button title="Accept" size="sm" onPress={() => respond.mutate({ id: r.id, status: 'ACCEPTED' })} />
                <Button title="Decline" size="sm" variant="ghost" onPress={() => respond.mutate({ id: r.id, status: 'DECLINED' })} />
              </>
            )}
          </Row>
        </Card>
      ))}
    </>
  );
}
