import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Handshake, MessageCircle, Phone } from 'lucide-react-native';
import { whatsappLink } from '@brokeriq/shared';
import { api, patch, post } from '@/lib/api';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, Header, Input, Loader, Row, Screen, Segmented, Txt } from '@/ui';
import { ListingRow } from '@/components/listing';

const TONE: Record<string, string> = { PENDING: '#F59E0B', ACCEPTED: '#10B981', REJECTED: '#E11D48', CANCELLED: '#94A3B8', CLOSED: '#0EA5E9' };

/** Co-broking: other BrokerIQ firms' open listings + requests in/out. */
export default function Network() {
  const [tab, setTab] = useState<'network' | 'incoming' | 'outgoing'>('network');
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Co-broking network" subtitle="दूसरे brokers की inventory, commission split के साथ" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'network', label: 'Network' },
          { value: 'incoming', label: 'Incoming' },
          { value: 'outgoing', label: 'Outgoing' },
        ]}
      />
      <View style={{ marginTop: 12, gap: 10 }}>{tab === 'network' ? <NetworkList /> : <Requests box={tab} />}</View>
    </Screen>
  );
}

function NetworkList() {
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['cobroke-network', q], queryFn: () => api<any>(`/cobroking/network${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  const req = useApiMutation((listingId: string) => post('/cobroking/requests', { listingId }), { success: 'Request भेजी', invalidate: [['cobroke-network']] });
  return (
    <>
      <Input placeholder="Sector, society या title…" value={q} onChangeText={setQ} />
      {list.isLoading ? (
        <Loader />
      ) : !list.data?.items.length ? (
        <Empty title="अभी network में कोई listing नहीं" text="अपनी listings co-broking के लिए खोलें और brokers को invite करें।" />
      ) : (
        list.data.items.map((l: any) => (
          <ListingRow
            key={l.id}
            l={l}
            right={
              <View style={{ alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Badge label={`${l.coBrokingSharePct ?? 50}%`} color="#4F46E5" />
                {l.myRequest ? (
                  <Badge label={l.myRequest.status} color={TONE[l.myRequest.status]} />
                ) : (
                  <Button title="Request" size="sm" onPress={() => req.mutate(l.id)} />
                )}
              </View>
            }
          />
        ))
      )}
    </>
  );
}

function Requests({ box }: { box: 'incoming' | 'outgoing' }) {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['cobroke', box], queryFn: () => api<any[]>(`/cobroking/requests?box=${box}`) });
  const act = (id: string, action: string) =>
    patch(`/cobroking/requests/${id}`, { action })
      .then(() => (toast.success('Updated'), q.refetch()))
      .catch(showError);
  if (q.isLoading) return <Loader />;
  if (!q.data?.length) return <Empty icon={<Handshake size={26} color={c.brand} />} title="कोई request नहीं" />;
  return (
    <>
      {q.data.map((r) => {
        const other = box === 'incoming' ? r.requester : r.ownerOrg;
        const phone = other.whatsapp ?? other.phone;
        const open = r.status === 'ACCEPTED' || r.status === 'CLOSED';
        return (
          <Card key={r.id} style={{ padding: 14, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge label={r.status} color={TONE[r.status]} />
              <Txt v="caption" color="muted">{`${r.sharePct}% share`}</Txt>
            </Row>
            <Txt v="bodyStrong" numberOfLines={1}>
              {r.listing.title}
            </Txt>
            <Txt v="small" color="muted">
              {other.name}
            </Txt>
            {!!r.message && <Txt v="small">{`“${r.message}”`}</Txt>}
            <Row wrap>
              {open && phone && (
                <>
                  <Button title="Call" size="sm" variant="secondary" icon={<Phone size={14} color={c.fg} />} onPress={() => Linking.openURL(`tel:${phone}`)} />
                  <Button
                    title="WhatsApp"
                    size="sm"
                    variant="whatsapp"
                    icon={<MessageCircle size={14} color="#fff" />}
                    onPress={() => Linking.openURL(whatsappLink(phone, `नमस्ते, BrokerIQ co-broking: ${r.listing.title}`))}
                  />
                </>
              )}
              {box === 'incoming' && r.status === 'PENDING' && (
                <>
                  <Button title="Accept" size="sm" onPress={() => act(r.id, 'accept')} />
                  <Button title="Reject" size="sm" variant="ghost" onPress={() => act(r.id, 'reject')} />
                </>
              )}
              {box === 'outgoing' && ['PENDING', 'ACCEPTED'].includes(r.status) && (
                <Button title="वापस लें" size="sm" variant="ghost" onPress={() => act(r.id, 'cancel')} />
              )}
            </Row>
          </Card>
        );
      })}
    </>
  );
}
