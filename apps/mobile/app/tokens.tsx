import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, patch } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, Header, Loader, Row, Screen, Txt } from '@/ui';

const TONE: Record<string, string> = { CLAIMED: '#F59E0B', RECEIVED: '#10B981', REFUNDED: '#0EA5E9', CANCELLED: '#94A3B8' };

/** Broker: confirm tokens tenants say they paid. */
export default function Tokens() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['broker-tokens'], queryFn: () => api<any[]>('/broker/tokens') });
  const mark = useApiMutation((b: { id: string; status: string }) => patch(`/broker/tokens/${b.id}`, { status: b.status }), {
    success: 'Updated',
    invalidate: [['broker-tokens']],
  });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Token records" subtitle="मिला हो तो Received करें" />
      {q.isLoading ? (
        <Loader />
      ) : !q.data?.length ? (
        <Empty icon={<Wallet size={26} color={c.brand} />} title="अभी कोई token record नहीं" />
      ) : (
        q.data.map((t) => (
          <Card key={t.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong">{`${formatINR(t.amount)} · ${t.mode}${t.ref ? ` · ${t.ref}` : ''}`}</Txt>
              <Badge label={t.status} color={TONE[t.status]} />
            </Row>
            <Txt v="small" color="muted" numberOfLines={1}>
              {t.listing.title}
            </Txt>
            <Row>
              {t.status === 'CLAIMED' && <Button title="Received" size="sm" onPress={() => mark.mutate({ id: t.id, status: 'RECEIVED' })} />}
              {t.status === 'RECEIVED' && (
                <Button title="Refunded" size="sm" variant="secondary" onPress={() => mark.mutate({ id: t.id, status: 'REFUNDED' })} />
              )}
              {['CLAIMED', 'RECEIVED'].includes(t.status) && (
                <Button title="Cancel" size="sm" variant="ghost" onPress={() => mark.mutate({ id: t.id, status: 'CANCELLED' })} />
              )}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
