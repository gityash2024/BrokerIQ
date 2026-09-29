import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Copy, Gift, Share2, Trophy } from 'lucide-react-native';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Avatar, Badge, Button, Card, Empty, ErrorView, Header, Loader, Row, Screen, SectionTitle, Txt } from '@/ui';

/** A broker's personal invite link + who joined through it + top inviters. */
export default function InviteBrokers() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['referrals'], queryFn: () => api<any>('/broker/referrals') });
  if (q.isLoading) return <Loader />;
  if (q.isError) return <Screen><Header title="Brokers को invite करें" /><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const d = q.data;
  const message = d.link ? `नमस्ते! मैं अपनी सारी leads (Housing, 99acres, Facebook) और WhatsApp follow-ups BrokerIQ पर manage करता हूँ। आप भी जुड़िए — मेरा invite link: ${d.link}` : '';
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Brokers को invite करें" subtitle="Network जितना बड़ा, सबको उतनी ज़्यादा inventory" />
      {!d.enabled || !d.link ? (
        <Empty title="Broker referrals अभी बंद हैं" text="BrokerIQ team इसे जल्द चालू करेगी।" />
      ) : (
        <>
          <LinearGradient colors={['#4338CA', '#7C3AED']} style={{ borderRadius: 24, padding: 20, gap: 6 }}>
            <Gift size={28} color="#fff" />
            <Txt v="title" color="white">आपका invite code</Txt>
            <Txt v="h1" color="white" style={{ letterSpacing: 3 }}>{d.code}</Txt>
            {d.grant && <Txt v="small" color="rgba(255,255,255,0.85)">{`जुड़ने वाले broker को ${d.grant.planCode} plan ${d.grant.months ? `${d.grant.months} महीने` : 'हमेशा'} free`}</Txt>}
            <Txt v="caption" color="rgba(255,255,255,0.7)">{`${d.usesLeft} invites बाकी`}</Txt>
            <Row style={{ marginTop: 10 }}>
              <Button title="Share करें" size="sm" variant="accent" icon={<Share2 size={15} color="#0f172a" />} onPress={() => Share.share({ message })} />
              <Button title="Link copy" size="sm" variant="secondary" icon={<Copy size={15} color={c.fg} />} onPress={async () => (await Clipboard.setStringAsync(d.link), toast.success('Copied'))} />
            </Row>
          </LinearGradient>
          <SectionTitle title={`आपके जोड़े हुए brokers (${d.joined.length})`} />
          {d.joined.length === 0 ? (
            <Txt v="small" color="muted">अभी कोई नहीं — link share कीजिए।</Txt>
          ) : (
            <Card style={{ padding: 6 }}>
              {d.joined.map((o: any) => (
                <Row key={o.id} gap={12} style={{ padding: 10 }}>
                  <Avatar name={o.name} uri={o.logoUrl} size={36} />
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" numberOfLines={1}>{o.name}</Txt>
                    <Txt v="caption" color="muted">{new Date(o.createdAt).toLocaleDateString('en-IN')}</Txt>
                  </View>
                  {o.verification === 'VERIFIED' && <Badge label="Verified" color={c.success} />}
                </Row>
              ))}
            </Card>
          )}
          {d.leaderboard.length > 0 && (
            <>
              <SectionTitle title="Top inviters" />
              <Card style={{ padding: 6 }}>
                {d.leaderboard.map((r: any, i: number) => (
                  <Row key={r.org.id} gap={12} style={{ padding: 10 }}>
                    {i === 0 ? <Trophy size={18} color={c.accent} /> : <Txt v="bodyStrong" color="muted">{String(i + 1)}</Txt>}
                    <Avatar name={r.org.name} uri={r.org.logoUrl} size={30} />
                    <Txt v="body" numberOfLines={1} style={{ flex: 1 }}>{r.org.name}</Txt>
                    <Badge label={String(r.count)} color={c.brand} />
                  </Row>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
