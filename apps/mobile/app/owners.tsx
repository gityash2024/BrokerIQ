import { useState } from 'react';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, MessageCircle, Phone, UserRound } from 'lucide-react-native';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api, patch } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, Header, Input, Loader, Row, Screen, Segmented, Txt } from '@/ui';

const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400_000);

/** Landlord CRM + leases with renewal reminders (60 / 30 / 7 days before end). */
export default function Owners() {
  const [tab, setTab] = useState<'owners' | 'leases'>('owners');
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Owners & leases" subtitle="Lease ख़त्म होने से पहले reminder" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owners', label: 'Owners' },
          { value: 'leases', label: 'Leases' },
        ]}
      />
      {tab === 'owners' ? <OwnerList /> : <Leases />}
    </Screen>
  );
}

function OwnerList() {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['owners', q], queryFn: () => api<any[]>(`/broker/owners${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  return (
    <>
      <Input placeholder="नाम या number…" value={q} onChangeText={setQ} containerStyle={{ marginTop: 12 }} />
      {list.isLoading ? (
        <Loader />
      ) : !list.data?.length ? (
        <Empty
          icon={<UserRound size={26} color={c.brand} />}
          title="अभी कोई owner नहीं"
          text="Listings में owner का नाम और number भरें — वो यहाँ अपने-आप आ जाएँगे।"
        />
      ) : (
        list.data.map((o) => (
          <Card key={o.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Txt v="bodyStrong">{o.name}</Txt>
            <Txt v="small" color="muted">
              {o.phone}
            </Txt>
            <Row wrap>
              <Badge label={`${o._count.listings} listings`} color={c.brand} />
              {o.tenancies[0] && (
                <Badge label={`Lease ${daysLeft(o.tenancies[0].endDate)} दिन`} color={daysLeft(o.tenancies[0].endDate) <= 30 ? c.warning : c.success} />
              )}
            </Row>
            <Row>
              <Button title="Call" size="sm" variant="secondary" icon={<Phone size={14} color={c.fg} />} onPress={() => Linking.openURL(`tel:${o.phone}`)} />
              <Button
                title="WhatsApp"
                size="sm"
                variant="whatsapp"
                icon={<MessageCircle size={14} color="#fff" />}
                onPress={() => Linking.openURL(whatsappLink(o.phone, `नमस्ते ${o.name} जी,`))}
              />
            </Row>
          </Card>
        ))
      )}
    </>
  );
}

function Leases() {
  const { c } = useTheme();
  const list = useQuery({ queryKey: ['tenancies'], queryFn: () => api<any[]>('/broker/tenancies') });
  const renew = useApiMutation((id: string) => patch(`/broker/tenancies/${id}`, { renewMonths: 11 }), {
    success: 'Lease renew हुआ',
    invalidate: [['tenancies']],
  });
  const end = useApiMutation((id: string) => patch(`/broker/tenancies/${id}`, { status: 'ENDED' }), { success: 'Lease बंद', invalidate: [['tenancies']] });
  if (list.isLoading) return <Loader />;
  if (!list.data?.length)
    return <Empty icon={<KeyRound size={26} color={c.brand} />} title="अभी कोई lease नहीं" text="Rent deal close करने पर lease अपने-आप बनता है (11 महीने)।" />;
  return (
    <>
      {list.data.map((t) => {
        const left = daysLeft(t.endDate);
        return (
          <Card key={t.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {t.tenantName}
              </Txt>
              <Badge
                label={t.status === 'ACTIVE' ? (left >= 0 ? `${left} दिन बाकी` : 'ख़त्म') : t.status}
                color={t.status !== 'ACTIVE' ? c.muted : left <= 30 ? c.warning : c.success}
              />
            </Row>
            <Txt v="small" color="muted" numberOfLines={1}>{`${t.listing?.title ?? 'Property'} · ${formatINR(t.rent)}/month`}</Txt>
            <Txt v="caption" color="subtle">{`${new Date(t.startDate).toLocaleDateString('en-IN')} → ${new Date(t.endDate).toLocaleDateString('en-IN')}`}</Txt>
            {t.status === 'ACTIVE' && (
              <Row>
                <Button title="Renew (11 महीने)" size="sm" variant="secondary" onPress={() => renew.mutate(t.id)} />
                <Button title="बंद करें" size="sm" variant="ghost" onPress={() => end.mutate(t.id)} />
              </Row>
            )}
          </Card>
        );
      })}
    </>
  );
}
