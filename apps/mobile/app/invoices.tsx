import { useEffect, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Send } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, Header, Input, Loader, Row, Screen, Segmented, Sheet, Txt } from '@/ui';

const TONE: Record<string, string> = { SENT: '#F59E0B', PAID: '#10B981', CANCELLED: '#94A3B8', DRAFT: '#64748B' };

/** Brokerage invoices paid straight to the firm's UPI; the broker marks them paid. */
export default function Invoices() {
  const { c } = useTheme();
  const { isBrokerAdmin } = useAuth();
  const [status, setStatus] = useState('');
  const [create, setCreate] = useState(false);
  const [upi, setUpi] = useState(false);
  const list = useQuery({ queryKey: ['invoices', status], queryFn: () => api<any[]>(`/broker/invoices${status ? `?status=${status}` : ''}`) });
  const settings = useQuery({ queryKey: ['payment-settings'], queryFn: () => api<any>('/broker/payment-settings') });
  const paid = useApiMutation((id: string) => patch(`/broker/invoices/${id}`, { status: 'PAID', paidMode: 'UPI' }), {
    success: 'Paid mark हुआ',
    invalidate: [['invoices']],
  });
  const send = async (id: string) => {
    try {
      const r = await post<any>(`/broker/invoices/${id}/send`);
      if (r.whatsapp || r.email) toast.success('Invoice भेजा गया');
      else await Share.share({ message: r.text });
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Invoices"
        subtitle="Client सीधे आपके UPI पर pay करता है"
        right={<Button title="नया" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => setCreate(true)} />}
      />
      {settings.data && !settings.data.upiId && (
        <Card style={{ padding: 12, borderColor: c.warning }} onPress={isBrokerAdmin ? () => setUpi(true) : undefined}>
          <Txt v="small">अपना UPI ID जोड़ें ताकि invoice पर "UPI से pay करें" दिखे।{isBrokerAdmin ? ' (Tap करें)' : ''}</Txt>
        </Card>
      )}
      {isBrokerAdmin && settings.data?.upiId && <Txt v="caption" color="brand" onPress={() => setUpi(true)}>{`UPI: ${settings.data.upiId} · बदलें`}</Txt>}
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: '', label: 'All' },
          { value: 'SENT', label: 'Pending' },
          { value: 'PAID', label: 'Paid' },
        ]}
      />
      {list.isLoading ? (
        <Loader />
      ) : !list.data?.length ? (
        <Empty
          icon={<FileText size={26} color={c.brand} />}
          title="अभी कोई invoice नहीं"
          action={<Button title="Invoice बनाएँ" onPress={() => setCreate(true)} />}
        />
      ) : (
        list.data.map((i) => (
          <Card key={i.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong">{i.number}</Txt>
              <Badge label={i.status === 'SENT' ? 'Pending' : i.status} color={TONE[i.status]} />
            </Row>
            <Txt v="small">{`${i.clientName} · ${formatINR(i.total)}`}</Txt>
            {i.status === 'SENT' && (
              <Row>
                <Button title="भेजें" size="sm" variant="secondary" icon={<Send size={14} color={c.fg} />} onPress={() => send(i.id)} />
                <Button title="Paid" size="sm" onPress={() => paid.mutate(i.id)} />
                <Button
                  title="Link"
                  size="sm"
                  variant="ghost"
                  onPress={async () => {
                    const d = await api<any>(`/broker/invoices/${i.id}`);
                    Linking.openURL(d.link);
                  }}
                />
              </Row>
            )}
          </Card>
        ))
      )}
      <CreateSheet open={create} onClose={() => setCreate(false)} />
      <UpiSheet open={upi} data={settings.data} onClose={() => setUpi(false)} />
    </Screen>
  );
}

function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      onSuccess: () => (onClose(), setF({ clientName: '', clientPhone: '', description: 'Brokerage', amount: '', gst: false })),
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title="नया invoice">
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
    </Sheet>
  );
}

function UpiSheet({ open, data, onClose }: { open: boolean; data: any; onClose: () => void }) {
  const [f, setF] = useState({ upiId: '', upiName: '' });
  useEffect(() => {
    if (data) setF({ upiId: data.upiId ?? '', upiName: data.upiName ?? '' });
  }, [data]);
  const save = useApiMutation(() => patch('/broker/payment-settings', f), { success: 'Saved', invalidate: [['payment-settings']], onSuccess: onClose });
  return (
    <Sheet open={open} onClose={onClose} title="UPI settings">
      <View style={{ gap: 10 }}>
        <Input label="UPI ID" value={f.upiId} onChangeText={(v) => setF({ ...f, upiId: v.trim() })} autoCapitalize="none" hint="जैसे sharmarealty@okicici" />
        <Input label="UPI पर दिखने वाला नाम" value={f.upiName} onChangeText={(v) => setF({ ...f, upiName: v })} />
        <Button title="Save" loading={save.isPending} onPress={() => save.mutate(undefined)} />
      </View>
    </Sheet>
  );
}
