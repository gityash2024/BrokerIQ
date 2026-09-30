import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Wallet } from 'lucide-react-native';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api, patch } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, Header, Loader, Row, Screen, SectionTitle, Txt } from '@/ui';

const TOKEN: Record<string, [string, string]> = {
  CLAIMED: ['Broker की पुष्टि बाकी', '#F59E0B'],
  RECEIVED: ['Broker ने पुष्टि की', '#10B981'],
  REFUNDED: ['Refund', '#0EA5E9'],
  CANCELLED: ['Cancelled', '#94A3B8'],
};
const when = (d: string) => new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Tenant: booked site visits + token records. */
export default function MyVisits() {
  const { c } = useTheme();
  const visits = useQuery({ queryKey: ['my-visits'], queryFn: () => api<any[]>('/me/visits') });
  const tokens = useQuery({ queryKey: ['my-tokens'], queryFn: () => api<any[]>('/me/tokens') });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Visits & tokens" />
      {visits.isLoading ? (
        <Loader />
      ) : !visits.data?.length ? (
        <Empty icon={<CalendarCheck size={26} color={c.brand} />} title="अभी कोई visit नहीं" text="Broker listing पर 'Visit' दबाकर खाली समय चुनें।" />
      ) : (
        visits.data.map((v) => {
          const upcoming = new Date(v.scheduledAt) > new Date() && ['SCHEDULED', 'CONFIRMED'].includes(v.status);
          const phone = v.organization?.whatsapp ?? v.organization?.phone;
          return (
            <Card key={v.id} style={{ padding: 14, gap: 6, marginTop: 10 }} onPress={v.listing ? () => router.push(`/property/${v.listing.slug}`) : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="bodyStrong">{when(v.scheduledAt)}</Txt>
                <Badge label={upcoming ? 'Upcoming' : v.status} color={upcoming ? c.brand : c.muted} />
              </Row>
              {!!v.listing && (
                <Txt v="small" color="brand" numberOfLines={1}>
                  {v.listing.title}
                </Txt>
              )}
              <Txt v="caption" color="muted" numberOfLines={2}>{`${v.address ?? ''} · ${v.organization?.name ?? ''}`}</Txt>
              <Row>
                {!!phone && (
                  <Button
                    title="WhatsApp"
                    size="sm"
                    variant="whatsapp"
                    onPress={() => Linking.openURL(whatsappLink(phone, `नमस्ते, site visit ${when(v.scheduledAt)} के बारे में`))}
                  />
                )}
                {upcoming && (
                  <Button
                    title="Cancel"
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      patch(`/me/visits/${v.id}/cancel`)
                        .then(() => visits.refetch())
                        .catch(showError)
                    }
                  />
                )}
              </Row>
            </Card>
          );
        })
      )}
      <SectionTitle title="Token records" />
      {tokens.isLoading ? (
        <Loader />
      ) : !tokens.data?.length ? (
        <Empty icon={<Wallet size={26} color={c.brand} />} title="कोई token record नहीं" />
      ) : (
        tokens.data.map((t) => (
          <Card key={t.id} style={{ padding: 14, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">{`${formatINR(t.amount)} · ${t.mode}`}</Txt>
                <Txt v="caption" color="muted" numberOfLines={1}>
                  {t.listing.title}
                </Txt>
              </View>
              <Badge label={TOKEN[t.status][0]} color={TOKEN[t.status][1]} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
