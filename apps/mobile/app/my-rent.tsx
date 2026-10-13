// BROKER-ONLY LAUNCH: Consumer screen disabled
// Original code commented out below
import { View } from 'react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Screen, Txt } from '@/ui';

export default function DisabledScreen() {
  useEffect(() => {
    // Auto-redirect to broker dashboard
    const timer = setTimeout(() => router.replace('/(broker)/dashboard'), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen title="Coming Soon">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Txt v="h2" center>🚧 Coming Soon</Txt>
        <Txt v="body" center style={{ marginTop: 8, opacity: 0.6 }}>
          यह feature जल्द ही उपलब्ध होगा। Broker Dashboard पर redirect हो रहे हैं...
        </Txt>
      </View>
    </Screen>
  );
}

/* === ORIGINAL CODE (commented out for broker-only launch) ===
import { Linking, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Home, Receipt } from 'lucide-react-native';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, ErrorView, Header, Loader, Row, Screen, Txt } from '@/ui';

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "मेरा किराया": due date, owner's UPI (pay straight from any UPI app), rent receipts for HRA. */
export default function MyRent() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="मेरा किराया" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
        <Txt v="h2">Coming Soon</Txt>
        <Txt color="muted" style={{ textAlign: 'center' }}>
          यह फीचर जल्द ही उपलब्ध होगा।
        </Txt>
      </View>
    </Screen>
  );
  /*
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['my-rent'], queryFn: () => api<any[]>('/me/rent') });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="मेरा किराया" subtitle="UPI से सीधे owner को pay करें, receipts यहीं" />
      {q.isError ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Loader />
      ) : !q.data.length ? (
        <Empty
          icon={<Home size={26} color={c.brand} />}
          title="अभी कोई lease नहीं जुड़ा"
          text="आपके broker ने lease BrokerIQ पर जोड़ा है तो वो आपके mobile number या email से यहाँ अपने-आप दिखेगा।"
        />
      ) : (
        q.data.map((t) => (
          <Card key={t.id} style={{ padding: 14, gap: 8, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {t.listing?.title ?? 'Lease'}
              </Txt>
              <Badge label={`${monthLabel(t.currentMonth)}: ${t.paidThisMonth ? 'Paid ✓' : 'Due'}`} color={t.paidThisMonth ? c.success : c.warning} />
            </Row>
            <Txt v="small" color="muted">{`${formatINR(t.rent)}/month${t.rentDueDay ? ` · हर महीने ${t.rentDueDay} तारीख` : ''} · ${t.broker.name}`}</Txt>
            {!t.paidThisMonth && !!t.upiId && (
              <View style={{ gap: 8 }}>
                <Txt v="small">{`Owner का UPI: ${t.upiId}`}</Txt>
                <Row wrap>
                  {!!t.upiLink && (
                    <Button title="UPI app से pay करें" size="sm" onPress={() => Linking.openURL(t.upiLink).catch(() => toast.error('UPI app नहीं मिला'))} />
                  )}
                  <Button
                    title="UPI ID copy"
                    size="sm"
                    variant="secondary"
                    onPress={() => Clipboard.setStringAsync(t.upiId).then(() => toast.success('Copy हुआ'))}
                  />
                  {!!t.broker.phone && (
                    <Button
                      title="Broker को बताएँ"
                      size="sm"
                      variant="whatsapp"
                      onPress={() => Linking.openURL(whatsappLink(t.broker.phone, `नमस्ते, ${monthLabel(t.currentMonth)} का किराया भेज दिया है।`))}
                    />
                  )}
                </Row>
              </View>
            )}
            <Txt v="caption" color="muted">
              Rent receipts
            </Txt>
            {!t.payments.length ? (
              <Txt v="small" color="muted">
                Paid mark होते ही receipt यहाँ आएगी।
              </Txt>
            ) : (
              <Row wrap>
                {t.payments.map((p: any) => (
                  <Button
                    key={p.id}
                    title={`${monthLabel(p.month)} · ${formatINR(p.amount)}`}
                    size="sm"
                    variant="ghost"
                    icon={<Receipt size={14} color={c.brand} />}
                    onPress={() => Linking.openURL(p.receiptUrl)}
                  />
                ))}
              </Row>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
  */
}

=== END ORIGINAL CODE === */
