import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Check, Rocket, Sparkles } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { post } from '@/lib/api';
import { useConfig, useFreeMode } from '@/lib/config';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { RazorpayCheckout, type RzpOrder } from '@/components/razorpay';
import { Button, Card, Header, Row, Screen, Txt, Empty } from '@/ui';

export default function BoostScreen() {
  const blocked = useFreeMode();
  if (blocked)
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Boost" />
        <Empty icon={<Sparkles size={28} color="#4F46E5" />} title="अभी BrokerIQ पूरी तरह free है — boost की ज़रूरत नहीं, सब listings बराबर दिखती हैं।" />
      </Screen>
    );
  return <Boost />;
}

function Boost() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { c } = useTheme();
  const { app } = useConfig();
  const qc = useQueryClient();
  const [weeks, setWeeks] = useState(2);
  const [order, setOrder] = useState<RzpOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const per = app.monetization?.boostPricePerWeek ?? 499;
  const gst = app.monetization?.gstPercent ?? 18;
  const total = Math.round(per * weeks * (1 + gst / 100));
  const pay = async () => {
    setBusy(true);
    try {
      setOrder(await post<RzpOrder>('/billing/boost', { listingId: id, weeks }));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Listing boost करें" subtitle={title} />
      <LinearGradient colors={['#F59E0B', '#EA580C']} style={{ borderRadius: 24, padding: 22, gap: 8, marginTop: 8 }}>
        <Animated.View entering={ZoomIn.springify()}><Rocket size={40} color="#fff" /></Animated.View>
        <Txt v="h1" color="white">Featured listing</Txt>
        <Txt color="rgba(255,255,255,0.9)">Search में सबसे ऊपर, homepage पर “Handpicked” में, और Featured badge — औसतन कई गुना ज़्यादा views और enquiries।</Txt>
      </LinearGradient>
      <Txt v="label" color="subtle" style={{ marginTop: 22, marginBottom: 10 }}>Duration</Txt>
      <Row wrap gap={10}>
        {[1, 2, 4, 8].map((w) => (
          <Card key={w} onPress={() => setWeeks(w)} style={{ width: '47%', padding: 16, gap: 4, borderColor: weeks === w ? c.brand : c.line, borderWidth: weeks === w ? 2 : 1 }}>
            <Txt v="h2">{w} week{w > 1 ? 's' : ''}</Txt>
            <Txt v="small" color="muted">{formatINR(per * w)} + GST</Txt>
            {w === 4 && <Txt v="caption" color="success">Most popular</Txt>}
          </Card>
        ))}
      </Row>
      <View style={{ marginTop: 20, gap: 6 }}>
        {['Search results में top placement', 'Homepage featured section', 'Featured badge और highlighted card', 'Payment पर GST invoice'].map((t) => (
          <Row key={t}><Check size={16} color={c.success} /><Txt v="small">{t}</Txt></Row>
        ))}
      </View>
      <Button title={`Pay ${formatINR(total)} (incl. ${gst}% GST)`} size="lg" style={{ marginTop: 24 }} loading={busy} onPress={pay} />
      <RazorpayCheckout
        order={order}
        onClose={() => setOrder(null)}
        onPaid={() => {
          toast.success('Payment successful — listing featured 🚀');
          qc.invalidateQueries({ queryKey: ['my-listings'] });
          router.back();
        }}
      />
    </Screen>
  );
}
