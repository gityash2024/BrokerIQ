import { Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Award, Gift } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, ErrorView, Header, Loader, Screen, Stat, Txt } from '@/ui';

const BADGE_TEXT: Record<string, string> = { Helper: 'Helper — पहला दोस्त जुड़ा', Connector: 'Connector — 5+ दोस्त', Champion: 'Champion — 20+ दोस्त' };

/** "दोस्तों को बुलाएँ": personal invite link; thanks + badge, no money. */
export default function Invite() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['my-referral'], queryFn: () => api<any>('/me/referral') });
  const r = q.data;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="दोस्तों को बुलाएँ" subtitle="घर ढूँढ रहे दोस्तों को BrokerIQ भेजें" />
      {q.isError ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : !r ? (
        <Loader />
      ) : (
        <View style={{ gap: 12 }}>
          <Card style={{ padding: 16, gap: 10 }}>
            <Gift size={24} color={c.brand} />
            <Txt v="small">{r.url}</Txt>
            <Button
              title="WhatsApp / share"
              variant="whatsapp"
              full
              onPress={() =>
                Share.share({
                  message: `मैं घर ढूँढने के लिए BrokerIQ इस्तेमाल करता/करती हूँ — verified listings, broker से सीधी बात, सब free। तुम भी देखो: ${r.url}`,
                })
              }
            />
            <Txt v="caption" color="muted">{`Code: ${r.code} · कोई पैसा नहीं — बस धन्यवाद और badge 🙏`}</Txt>
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Stat label="दोस्त जुड़े" value={r.signups} />
            </View>
            <View style={{ flex: 1 }}>
              <Stat label="Visit की" value={r.visited} />
            </View>
            <View style={{ flex: 1 }}>
              <Stat label="Move-in" value={r.movedIn} />
            </View>
          </View>
          {!!r.badge && (
            <Card style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Award size={22} color="#F59E0B" />
              <Badge label={BADGE_TEXT[r.badge] ?? r.badge} color="#F59E0B" />
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
