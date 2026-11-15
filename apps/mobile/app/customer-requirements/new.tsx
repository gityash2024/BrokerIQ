import { useState } from 'react';
import { Switch, View } from 'react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LocalityListItem } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Button, Chip, Input, Row, Txt } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';

export default function NewRequirement() {
  const client = useQueryClient();
  const { user } = useAuth();
  const { c } = useTheme();
  const locs = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }),
    staleTime: 600_000,
  });
  const [f, setF] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    bedrooms: [] as number[],
    maxBudget: '',
    localityIds: [] as string[],
    share: true,
  });
  const [locQ, setLocQ] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const save = async () => {
    setBusy(true);
    try {
      const r = await post<any>('/requirements', {
        name: f.name,
        phone: f.phone,
        bedrooms: f.bedrooms,
        maxBudget: f.maxBudget ? Number(f.maxBudget) : null,
        localityIds: f.localityIds,
        shareWithBrokers: f.share,
      });
      toast.success(`Save हुई — ${r.matches.length} matching properties`);
      await client.invalidateQueries({ queryKey: ['consumer-requirements'] });
      router.replace({ pathname: '/customer-requirements', params: { selected: r.requirement.id } });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const shown = (locs.data ?? []).filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase())).slice(0, 24);
  return (
    <BrokerScreen title="अपनी ज़रूरत बताएँ" back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 12 }}>
          <View style={{ gap: 12 }}>
            <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
            <Input label="Mobile" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
            <Txt v="label" color="muted">
              BHK
            </Txt>
            <Row wrap>
              {[1, 2, 3, 4].map((b) => (
                <Chip
                  key={b}
                  label={b === 4 ? '4+ BHK' : `${b} BHK`}
                  active={f.bedrooms.includes(b)}
                  onPress={() => setF({ ...f, bedrooms: toggle(f.bedrooms, b) })}
                />
              ))}
            </Row>
            <Input
              label="Max rent (₹/month)"
              value={f.maxBudget}
              onChangeText={(v) => setF({ ...f, maxBudget: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
            />
            <Input
              label="Sector / इलाका खोजें"
              value={locQ}
              onChangeText={setLocQ}
              hint={f.localityIds.length ? `${f.localityIds.length} चुने` : 'खाली छोड़ें तो पूरा Gurgaon'}
            />
            <Row wrap>
              {shown.map((l) => (
                <Chip
                  key={l.id}
                  label={l.name}
                  active={f.localityIds.includes(l.id)}
                  onPress={() => setF({ ...f, localityIds: toggle(f.localityIds, l.id) })}
                />
              ))}
            </Row>
            <Row gap={10} style={{ alignItems: 'flex-start' }}>
              <Switch value={f.share} onValueChange={(v) => setF({ ...f, share: v })} trackColor={{ true: c.brand }} />
              <Txt v="small" style={{ flex: 1 }}>
                मेरी ज़रूरत और नंबर इन इलाकों के 3 भरोसेमंद brokers को भेजें, ताकि वे मिलती properties दिखा सकें।
              </Txt>
            </Row>
            <Button title="Save" loading={busy} disabled={!f.name || !f.phone} onPress={save} />
          </View>
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
