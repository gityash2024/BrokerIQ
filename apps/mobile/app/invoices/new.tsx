import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { post } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { Button, Chip, Input, Row } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';

export default function NewInvoice() {
  const [f, setF] = useState({ clientName: '', clientPhone: '', description: 'Brokerage', amount: '', gst: false });
  const save = useApiMutation(
    () =>
      post('/broker/invoices', {
        clientName: f.clientName,
        clientPhone: f.clientPhone || undefined,
        items: [{ description: f.description, amount: Number(f.amount) }],
        gstPct: f.gst ? 18 : 0,
      }),
    {
      success: 'Invoice बन गया',
      invalidate: [['invoices']],
      onSuccess: () => router.back(),
    },
  );
  return (
    <BrokerScreen title="New invoice" back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 12 }}>
          <View style={{ gap: 10 }}>
            <Input label="Client का नाम" value={f.clientName} onChangeText={(v) => setF({ ...f, clientName: v })} />
            <Input label="Client mobile" value={f.clientPhone} onChangeText={(v) => setF({ ...f, clientPhone: v })} keyboardType="phone-pad" />
            <Input label="Description" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} />
            <Input label="Amount (₹)" value={f.amount} onChangeText={(v) => setF({ ...f, amount: v.replace(/\D/g, '') })} keyboardType="number-pad" />
            <Row>
              <Chip label="GST 18%" active={f.gst} onPress={() => setF({ ...f, gst: !f.gst })} />
            </Row>
            <Button title="Invoice बनाएँ" loading={save.isPending} disabled={!f.clientName || !f.amount} onPress={() => save.mutate(undefined)} />
          </View>
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
