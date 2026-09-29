import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, Header, Input, Loader, Row, Screen, SectionTitle, Sheet, Txt } from '@/ui';
import { ListingRow } from '@/components/listing';

/** "अपनी ज़रूरत बताएँ" — requirements with instant matches and alerts on new listings. */
export default function Requirements() {
  const { c } = useTheme();
  const list = useQuery({ queryKey: ['requirements'], queryFn: () => api<any[]>('/requirements/mine') });
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const active = sel ?? list.data?.[0]?.id ?? null;
  const matches = useQuery({ queryKey: ['requirement-matches', active], queryFn: () => api<any[]>(`/requirements/${active}/matches`), enabled: !!active });
  const setStatus = useApiMutation((b: { id: string; status: string }) => patch(`/requirements/${b.id}`, { status: b.status }), { success: 'Updated', invalidate: [['requirements']] });
  useEffect(() => {
    if (list.data && !list.data.length) setForm(true);
  }, [list.data]);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="मेरी ज़रूरतें" subtitle="मिलती property आते ही बताएँगे" right={<Button title="नई" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => setForm(true)} />} />
      {list.isLoading ? <Loader /> : !list.data?.length ? (
        <Empty icon={<ClipboardList size={26} color={c.brand} />} title="अपनी ज़रूरत बताएँ" text="BHK, budget और sector बताइए — हम मिलती properties ढूँढकर भेजेंगे।" action={<Button title="शुरू करें" onPress={() => setForm(true)} />} />
      ) : (
        <>
          {list.data.map((r) => (
            <Card key={r.id} onPress={() => setSel(r.id)} style={{ padding: 14, gap: 6, marginTop: 10, borderColor: active === r.id ? c.brand : c.line }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="bodyStrong">{`${r.bedrooms.length ? `${r.bedrooms.join('/')} BHK` : 'कोई भी BHK'}${r.maxBudget ? ` · ${formatINR(r.maxBudget)} तक` : ''}`}</Txt>
                <Badge label={r.status === 'ACTIVE' ? 'Alerts ON' : r.status} color={r.status === 'ACTIVE' ? c.success : c.muted} />
              </Row>
              <Txt v="caption" color="muted">{`${r.localityIds.length ? `${r.localityIds.length} इलाके` : 'पूरा Gurgaon'} · ${r.matchCount} alerts`}</Txt>
              <Row>
                <Button title={r.status === 'ACTIVE' ? 'Alerts रोकें' : 'Alerts चालू'} size="sm" variant="secondary" onPress={() => setStatus.mutate({ id: r.id, status: r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })} />
                <Button title="Delete" size="sm" variant="ghost" onPress={() => del(`/requirements/${r.id}`).then(() => list.refetch()).catch(showError)} />
              </Row>
            </Card>
          ))}
          <SectionTitle title={`Matching properties${matches.data ? ` (${matches.data.length})` : ''}`} />
          {matches.isLoading ? <Loader /> : !matches.data?.length ? <Txt v="small" color="muted">अभी कोई नहीं — आते ही बताएँगे।</Txt> : <View style={{ gap: 10 }}>{matches.data.map((l) => <ListingRow key={l.id} l={l} />)}</View>}
        </>
      )}
      <RequirementSheet open={form} onClose={() => setForm(false)} onSaved={(id) => (setSel(id), list.refetch())} />
    </Screen>
  );
}

function RequirementSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const { user } = useAuth();
  const { c } = useTheme();
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000, enabled: open });
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', bedrooms: [] as number[], maxBudget: '', localityIds: [] as string[], share: true });
  const [locQ, setLocQ] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const save = async () => {
    setBusy(true);
    try {
      const r = await post<any>('/requirements', { name: f.name, phone: f.phone, bedrooms: f.bedrooms, maxBudget: f.maxBudget ? Number(f.maxBudget) : null, localityIds: f.localityIds, shareWithBrokers: f.share });
      toast.success(`Save हुई — ${r.matches.length} matching properties`);
      onClose();
      onSaved(r.requirement.id);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const shown = (locs.data ?? []).filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase())).slice(0, 24);
  return (
    <Sheet open={open} onClose={onClose} title="अपनी ज़रूरत बताएँ" full>
      <View style={{ gap: 12 }}>
        <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input label="Mobile" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
        <Txt v="label" color="muted">BHK</Txt>
        <Row wrap>{[1, 2, 3, 4].map((b) => <Chip key={b} label={b === 4 ? '4+ BHK' : `${b} BHK`} active={f.bedrooms.includes(b)} onPress={() => setF({ ...f, bedrooms: toggle(f.bedrooms, b) })} />)}</Row>
        <Input label="Max rent (₹/month)" value={f.maxBudget} onChangeText={(v) => setF({ ...f, maxBudget: v.replace(/\D/g, '') })} keyboardType="number-pad" />
        <Input label="Sector / इलाका खोजें" value={locQ} onChangeText={setLocQ} hint={f.localityIds.length ? `${f.localityIds.length} चुने` : 'खाली छोड़ें तो पूरा Gurgaon'} />
        <Row wrap>{shown.map((l) => <Chip key={l.id} label={l.name} active={f.localityIds.includes(l.id)} onPress={() => setF({ ...f, localityIds: toggle(f.localityIds, l.id) })} />)}</Row>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Switch value={f.share} onValueChange={(v) => setF({ ...f, share: v })} trackColor={{ true: c.brand }} />
          <Txt v="small" style={{ flex: 1 }}>मेरी ज़रूरत और नंबर इन इलाकों के 3 भरोसेमंद brokers को भेजें, ताकि वे मिलती properties दिखा सकें।</Txt>
        </Row>
        <Button title="Save करें" loading={busy} disabled={!f.name || !f.phone} onPress={save} />
      </View>
    </Sheet>
  );
}
