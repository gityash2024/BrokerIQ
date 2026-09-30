import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Check, Crown, Rocket, Sparkles } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { RazorpayCheckout, type RzpOrder } from '@/components/razorpay';
import { Badge, Button, Card, ErrorView, Header, Loader, Row, Screen, Segmented, Txt, Empty } from '@/ui';
import { useFreeMode } from '@/lib/config';

const METERS = [
  ['leadsPerMonth', 'Leads (month)'],
  ['activeListings', 'Active listings'],
  ['agents', 'Team'],
  ['aiCredits', 'AI credits'],
  ['automations', 'Automations'],
  ['connectors', 'Connectors'],
] as const;

export default function BillingScreen() {
  const blocked = useFreeMode();
  if (blocked)
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Plan & billing" />
        <Empty icon={<Sparkles size={28} color="#4F46E5" />} title="अभी BrokerIQ पूरी तरह free है — कोई plan, limit या payment नहीं।" />
      </Screen>
    );
  return <Billing />;
}

function Billing() {
  const { c } = useTheme();
  const { isBrokerAdmin } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['billing'], queryFn: () => api<any>('/broker/billing'), enabled: isBrokerAdmin });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<any[]>('/billing/plans', { auth: false }) });
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [order, setOrder] = useState<RzpOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!isBrokerAdmin)
    return (
      <Screen>
        <Header title="Plan & billing" />
        <Txt color="muted">सिर्फ़ firm admin plan बदल सकते हैं।</Txt>
      </Screen>
    );
  if (q.isLoading) return <Loader />;
  if (q.isError)
    return (
      <Screen>
        <Header title="Plan & billing" />
        <ErrorView error={q.error} />
      </Screen>
    );
  const d = q.data;
  const current = d.subscription?.plan?.code ?? d.limits.plan;
  const buy = async (code: string) => {
    setBusy(code);
    try {
      setOrder(await post<RzpOrder>('/broker/billing/checkout', { planCode: code, cycle }));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Plan & billing" />
      <Card style={{ padding: 16, gap: 12, backgroundColor: '#1E1B4B', borderColor: '#1E1B4B' }}>
        <Row gap={8}>
          <Crown size={22} color="#FBBF24" />
          <Txt v="h2" color="white">
            {d.subscription?.plan?.name ?? 'Free'}
          </Txt>
        </Row>
        {METERS.map(([k, label]) => {
          const used = d.usage?.[k] ?? 0;
          const lim = d.limits.limits[k] ?? 0;
          const pct = lim >= 100000 ? 3 : Math.min(100, (used / Math.max(1, lim)) * 100);
          return (
            <View key={k} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="caption" color="rgba(255,255,255,0.8)">
                  {label}
                </Txt>
                <Txt v="caption" color="rgba(255,255,255,0.8)">
                  {used} / {lim >= 100000 ? '∞' : lim}
                </Txt>
              </Row>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: pct > 85 ? '#FB7185' : '#818CF8' }} />
              </View>
            </View>
          );
        })}
      </Card>
      {!d.razorpayReady && (
        <Txt v="small" color="warning" style={{ marginTop: 12 }}>
          Online payment अभी चालू नहीं (platform admin ने Razorpay नहीं जोड़ा)।
        </Txt>
      )}
      <View style={{ marginVertical: 16 }}>
        <Segmented
          value={cycle}
          onChange={setCycle}
          options={[
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'YEARLY', label: 'Yearly (बचत)' },
          ]}
        />
      </View>
      <View style={{ gap: 12 }}>
        {(plans.data ?? []).map((p, i) => {
          const price = cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly;
          const isCur = p.code === current;
          return (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 60)}>
              <Card style={{ padding: 16, gap: 8, borderColor: p.isPopular ? c.brand : c.line, borderWidth: p.isPopular ? 2 : 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="h3">{p.name}</Txt>
                  {p.isPopular && <Badge label="Most popular" color={c.brand} icon={<Sparkles size={11} color={c.brand} />} />}
                </Row>
                <Txt v="h1">
                  {price > 0 ? formatINR(price) : '₹0'}
                  <Txt v="small" color="muted">
                    /{cycle === 'YEARLY' ? 'year' : 'month'} + GST
                  </Txt>
                </Txt>
                {(p.features as string[]).slice(0, 6).map((f) => (
                  <Row key={f} gap={6}>
                    <Check size={15} color={c.success} />
                    <Txt v="small">{f}</Txt>
                  </Row>
                ))}
                <Button
                  title={isCur ? 'Current plan' : price <= 0 ? 'Free' : 'Upgrade'}
                  variant={isCur ? 'secondary' : 'primary'}
                  disabled={isCur || price <= 0}
                  loading={busy === p.code}
                  icon={!isCur && price > 0 ? <Rocket size={16} color="#fff" /> : undefined}
                  onPress={() => buy(p.code)}
                />
              </Card>
            </Animated.View>
          );
        })}
      </View>
      <RazorpayCheckout
        order={order}
        onClose={() => setOrder(null)}
        onPaid={() => (toast.success('Plan upgrade हो गया 🎉'), qc.invalidateQueries({ queryKey: ['billing'] }))}
      />
    </Screen>
  );
}
