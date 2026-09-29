import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react-native';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Avatar, Button, Card, Empty, Header, Input, Loader, Row, Screen, Sheet, Txt } from '@/ui';

const LABELS: Record<string, string> = { PACKERS: 'Packers & movers', FURNITURE: 'Furniture rental', BROADBAND: 'Broadband', CLEANING: 'Deep cleaning', PAINTING: 'Painting', OTHER: 'Other' };

/** Move-in partners (added by BrokerIQ) — request a callback. */
export default function Services() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['services'], queryFn: () => api<any[]>('/public/services', { auth: false }) });
  const [pick, setPick] = useState<any>(null);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Move-in services" subtitle="Shifting, furniture, internet" />
      {q.isLoading ? <Loader /> : !q.data?.length ? (
        <Empty icon={<Truck size={26} color={c.brand} />} title="जल्द आ रहा है" text="BrokerIQ जल्द भरोसेमंद partners जोड़ेगा।" />
      ) : (
        q.data.map((p) => (
          <Card key={p.id} style={{ padding: 14, marginTop: 10 }} onPress={() => setPick(p)}>
            <Row gap={12}>
              <Avatar name={p.name} uri={p.logoUrl} size={44} />
              <Txt v="bodyStrong" style={{ flex: 1 }}>{p.name}</Txt>
              <Txt v="caption" color="muted">{LABELS[p.category] ?? p.category}</Txt>
            </Row>
            {!!p.offer && <Txt v="caption" color="success">{p.offer}</Txt>}
          </Card>
        ))
      )}
      <RequestSheet partner={pick} onClose={() => setPick(null)} />
    </Screen>
  );
}

function RequestSheet({ partner, onClose }: { partner: any; onClose: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', notes: '' });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await post('/services/requests', { partnerId: partner.id, name: f.name, phone: f.phone, notes: f.notes || undefined });
      toast.success(`${partner.name} जल्द call करेंगे`);
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={!!partner} onClose={onClose} title={partner?.name ?? ''}>
      {!!partner?.description && <Txt v="small" color="muted">{partner.description}</Txt>}
      <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Input label="Mobile" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
      <Input label="Details" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} multiline />
      <Button title={user ? 'Callback माँगें' : 'Login करें'} loading={busy} disabled={!user || !f.name || !f.phone} onPress={send} />
    </Sheet>
  );
}
