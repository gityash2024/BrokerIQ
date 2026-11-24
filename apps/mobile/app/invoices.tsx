import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Linking, Share, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FileText, Plus, Send } from 'lucide-react-native';
import { formatINR, hasDelegatedAccess } from '@brokeriq/shared';
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
  const { user, isBrokerAdmin } = useAuth();
  const mayManage = isBrokerAdmin || user?.role === 'SUB_BROKER_ADMIN';
  const canEdit = mayManage && hasDelegatedAccess(user, 'deals', 'view', 'edit');
  const canCancel = mayManage && hasDelegatedAccess(user, 'deals', 'view', 'delete');
  const [status, setStatus] = useState('');
  const [upi, setUpi] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['invoices', status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<{ items: any[]; total: number; pendingTotal: number; totalPages: number }>(
        `/broker/invoices?paginated=true&page=${pageParam}&pageSize=50${status ? `&status=${status}` : ''}`,
      ),
    getNextPageParam: (last, _pages, current) => (current < last.totalPages ? current + 1 : undefined),
  });
  const invoices = list.data?.pages.flatMap((p) => p.items) ?? [];
  const editing = canEdit && invoices.find(({ id, status }) => id === editingId && (status === 'DRAFT' || status === 'SENT'));
  const settings = useQuery({ queryKey: ['payment-settings'], queryFn: () => api<any>('/broker/payment-settings') });
  const paid = useApiMutation((id: string) => patch(`/broker/invoices/${id}`, { status: 'PAID', paidMode: 'UPI' }), {
    success: 'Paid mark हुआ',
    invalidate: [['invoices']],
  });
  const cancel = useApiMutation((id: string) => patch(`/broker/invoices/${id}`, { status: 'CANCELLED' }), {
    success: 'Invoice cancelled', invalidate: [['invoices']],
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
        right={<Button title="नया" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => router.push('/invoices/new')} />}
      />
      {settings.data && !settings.data.upiId && (
        <Card style={{ padding: 12, borderColor: c.warning }} onPress={isBrokerAdmin ? () => setUpi(true) : undefined}>
          <Txt v="small">अपना UPI ID जोड़ें ताकि invoice पर "UPI से pay करें" दिखे।{isBrokerAdmin ? ' (Tap करें)' : ''}</Txt>
        </Card>
      )}
      {settings.data?.upiId && (
        <Txt
          v="caption"
          color="brand"
          onPress={() => (isBrokerAdmin ? setUpi(true) : toast.info('Ask your Broker Admin for permission to update payment settings.'))}
        >{`UPI: ${settings.data.upiId} · बदलें`}</Txt>
      )}
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: '', label: 'All' },
          { value: 'SENT', label: 'Pending' },
          { value: 'PAID', label: 'Paid' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ]}
      />
      {list.isError ? (
        <Empty title="Invoices लोड नहीं हुए" action={<Button title="Retry" onPress={() => list.refetch()} />} />
      ) : list.isLoading ? (
        <Loader />
      ) : !invoices.length ? (
        <Empty
          icon={<FileText size={26} color={c.brand} />}
          title="अभी कोई invoice नहीं"
          action={<Button title="Invoice बनाएँ" onPress={() => router.push('/invoices/new')} />}
        />
      ) : (
        invoices.map((i) => (
          <Card key={i.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong">{i.number}</Txt>
              <Badge label={i.status === 'SENT' ? 'Pending' : i.status} color={TONE[i.status]} />
            </Row>
            <Txt v="small">{`${i.clientName} · ${formatINR(i.total)}`}</Txt>
            {i.status === 'SENT' && (
              <Row>
                <Button title="भेजें" size="sm" variant="secondary" icon={<Send size={14} color={c.fg} />} onPress={() => send(i.id)} />
                {(user?.role !== 'SUB_BROKER_ADMIN' || canEdit) && <Button title="Paid" size="sm" onPress={() => paid.mutate(i.id)} />}
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
            {(i.status === 'SENT' || i.status === 'DRAFT') && (canEdit || canCancel) && <Row style={{ flexWrap: 'wrap' }}>
              {canEdit && <Button title="Edit" size="sm" variant="secondary" onPress={() => setEditingId(i.id)} />}
              {canCancel && <Button title="Cancel invoice" size="sm" variant="secondary" disabled={cancel.isPending} onPress={() => {
                Alert.alert(`Cancel invoice ${i.number}?`, 'The invoice will remain in your history.', [
                  { text: 'Keep invoice', style: 'cancel' }, { text: 'Cancel invoice', style: 'destructive', onPress: () => cancel.mutate(i.id) },
                ]);
              }} />}
            </Row>}
          </Card>
        ))
      )}
      {list.hasNextPage && <Button title="Load more" loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} />}
      <UpiSheet open={upi} data={settings.data} onClose={() => setUpi(false)} />
      {editing && <EditInvoiceSheet key={editing.id} invoice={editing} close={() => setEditingId((id) => id === editing.id ? null : id)} />}
    </Screen>
  );
}

function EditInvoiceSheet({ invoice, close }: { invoice: { id: string; number: string; dueDate?: string; notes?: string }; close: () => void }) {
  const [dueDate, setDueDate] = useState(invoice.dueDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const validDueDate = !dueDate || (Number.isFinite(Date.parse(dueDate)) && new Date(dueDate).toISOString().slice(0, 10) === dueDate);
  const save = useApiMutation(() => patch(`/broker/invoices/${invoice.id}`, { dueDate: dueDate || null, notes: notes || null }), {
    success: 'Invoice updated', invalidate: [['invoices']], onSuccess: close,
  });
  return <Sheet open onClose={close} title={`Edit invoice ${invoice.number}`}>
    <View style={{ gap: 10 }}>
      <Input label="Due date" placeholder="YYYY-MM-DD" value={dueDate} onChangeText={setDueDate} maxLength={10} />
      <Input label="Notes" value={notes} onChangeText={setNotes} maxLength={1000} multiline />
      <Button title="Save" loading={save.isPending} disabled={!validDueDate} onPress={() => save.mutate(undefined)} />
    </View>
  </Sheet>;
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
