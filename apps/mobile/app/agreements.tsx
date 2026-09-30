import { useState } from 'react';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, Plus } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Button, Card, Empty, Header, Input, Loader, Screen, Sheet, Txt } from '@/ui';

/** Draft 11-month rent agreement PDF (opens in the browser via a short-lived link). */
export default function AgreementsScreen() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['agreements'], queryFn: () => api<any[]>('/agreements') });
  const [open, setOpen] = useState(false);
  const pdf = (id: string) =>
    post<{ url: string }>(`/agreements/${id}/link`)
      .then((r) => Linking.openURL(r.url))
      .catch(showError);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Rent agreement"
        subtitle="Draft PDF · e-stamp: egrashry.nic.in"
        right={<Button title="नया" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => setOpen(true)} />}
      />
      <Txt v="caption" color="muted">
        Standard template है, legal सलाह नहीं। e-stamp paper पर print करके sign करें; police verification: harsamay.gov.in
      </Txt>
      {q.isLoading ? (
        <Loader />
      ) : !q.data?.length ? (
        <Empty
          icon={<FileSignature size={26} color={c.brand} />}
          title="अभी कोई agreement नहीं"
          action={<Button title="Agreement बनाएँ" onPress={() => setOpen(true)} />}
        />
      ) : (
        q.data.map((a) => (
          <Card key={a.id} style={{ padding: 14, gap: 4, marginTop: 10 }}>
            <Txt v="bodyStrong">{`${a.landlordName} → ${a.tenantName}`}</Txt>
            <Txt v="caption" color="muted" numberOfLines={1}>{`${a.propertyAddress} · ${formatINR(a.rent)}/month`}</Txt>
            <Button title="PDF खोलें" size="sm" variant="secondary" onPress={() => pdf(a.id)} />
          </Card>
        ))
      )}
      <NewAgreement open={open} onClose={() => setOpen(false)} onSaved={(id) => (q.refetch(), pdf(id))} />
    </Screen>
  );
}

function NewAgreement({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ landlordName: '', tenantName: '', propertyAddress: '', rent: '', deposit: '', startDate: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const a = await post<any>('/agreements', {
        landlordName: f.landlordName,
        tenantName: f.tenantName,
        propertyAddress: f.propertyAddress,
        rent: Number(f.rent),
        deposit: Number(f.deposit || 0),
        startDate: f.startDate,
      });
      toast.success('Agreement बन गया');
      onClose();
      onSaved(a.id);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Rent agreement (11 महीने)" full>
      <Input label="Owner का नाम" value={f.landlordName} onChangeText={(v) => setF({ ...f, landlordName: v })} />
      <Input label="Tenant का नाम" value={f.tenantName} onChangeText={(v) => setF({ ...f, tenantName: v })} />
      <Input label="Property का पूरा पता" value={f.propertyAddress} onChangeText={(v) => setF({ ...f, propertyAddress: v })} multiline />
      <Input label="Rent (₹/month)" value={f.rent} onChangeText={(v) => setF({ ...f, rent: v.replace(/\D/g, '') })} keyboardType="number-pad" />
      <Input label="Security deposit (₹)" value={f.deposit} onChangeText={(v) => setF({ ...f, deposit: v.replace(/\D/g, '') })} keyboardType="number-pad" />
      <Input label="Start date (YYYY-MM-DD)" value={f.startDate} onChangeText={(v) => setF({ ...f, startDate: v })} placeholder="2026-11-01" />
      <Button
        title="PDF बनाएँ"
        size="lg"
        loading={busy}
        disabled={!f.landlordName || !f.tenantName || !f.propertyAddress || !f.rent || !/^\d{4}-\d{2}-\d{2}$/.test(f.startDate)}
        onPress={save}
      />
    </Sheet>
  );
}
