import { useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { Button, Input } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';

export default function NewAgreement() {
  const client = useQueryClient();
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
      await client.invalidateQueries({ queryKey: ['agreements'] });
      router.back();
      const { url } = await post<{ url: string }>(`/agreements/${a.id}/link`);
      await Linking.openURL(url);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <BrokerScreen title="Rent agreement (11 महीने)" back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 12 }}>
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
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
