import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { calculateEmi, formatINR, formatPriceShort } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { Card, Chip, Header, Input, Row, Screen, Segmented, Txt } from '@/ui';

type Tab = 'emi' | 'stamp' | 'afford';
const n = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0;

function Result({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <Txt color="muted">{label}</Txt>
      <Txt v={big ? 'h2' : 'bodyStrong'} color={big ? 'brand' : 'fg'}>{value}</Txt>
    </Row>
  );
}

export default function Tools() {
  const params = useLocalSearchParams<{ tab?: Tab; price?: string }>();
  const { c } = useTheme();
  const { app } = useConfig();
  const fin = app.finance;
  const [tab, setTab] = useState<Tab>(params.tab ?? 'emi');
  const [price, setPrice] = useState(params.price ?? '15000000');
  const [down, setDown] = useState('20');
  const [rate, setRate] = useState(String(fin?.defaultInterestRate ?? 8.5));
  const [years, setYears] = useState('20');
  const [buyer, setBuyer] = useState<'male' | 'female' | 'joint'>('female');
  const [income, setIncome] = useState('150000');
  const [otherEmi, setOtherEmi] = useState('0');

  const emi = useMemo(() => {
    const loan = n(price) * (1 - n(down) / 100);
    const e = calculateEmi(loan, n(rate), n(years));
    const total = e * n(years) * 12;
    return { loan, e, total, interest: total - loan };
  }, [price, down, rate, years]);
  const stamp = useMemo(() => {
    const pct = buyer === 'female' ? fin?.stampDutyFemalePct ?? 5 : buyer === 'joint' ? fin?.stampDutyJointPct ?? 6 : fin?.stampDutyMalePct ?? 7;
    const duty = (n(price) * pct) / 100;
    const reg = Math.min(fin?.registrationFeeMax ?? 50000, n(price) * 0.01);
    return { pct, duty, reg, total: duty + reg };
  }, [price, buyer, fin]);
  const afford = useMemo(() => {
    const maxEmi = Math.max(0, n(income) * 0.45 - n(otherEmi));
    const r = n(rate) / 12 / 100;
    const m = n(years) * 12;
    const loan = r ? (maxEmi * (Math.pow(1 + r, m) - 1)) / (r * Math.pow(1 + r, m)) : maxEmi * m;
    return { maxEmi, loan, budget: loan / (1 - n(down) / 100) };
  }, [income, otherEmi, rate, years, down]);

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Property calculators" subtitle="Haryana rates — admin से update होते हैं" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'emi', label: 'EMI' }, { value: 'stamp', label: 'Stamp duty' }, { value: 'afford', label: 'Affordability' }]} />
      <Animated.View key={tab} entering={FadeIn} style={{ gap: 14, marginTop: 16 }}>
        {tab !== 'afford' && <Input label="Property price (₹)" value={price} onChangeText={setPrice} keyboardType="numeric" hint={formatPriceShort(n(price))} />}
        {tab === 'afford' && (
          <>
            <Input label="Monthly income (₹, in-hand)" value={income} onChangeText={setIncome} keyboardType="numeric" />
            <Input label="Existing EMIs (₹/month)" value={otherEmi} onChangeText={setOtherEmi} keyboardType="numeric" />
          </>
        )}
        {tab !== 'stamp' && (
          <Row>
            <Input label="Down payment %" value={down} onChangeText={setDown} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            <Input label="Rate %" value={rate} onChangeText={setRate} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            <Input label="Years" value={years} onChangeText={setYears} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </Row>
        )}
        {tab === 'stamp' && (
          <Row>
            <Chip label="Female" active={buyer === 'female'} onPress={() => setBuyer('female')} />
            <Chip label="Joint" active={buyer === 'joint'} onPress={() => setBuyer('joint')} />
            <Chip label="Male" active={buyer === 'male'} onPress={() => setBuyer('male')} />
          </Row>
        )}
        <Card style={{ padding: 16, borderColor: c.brand }}>
          {tab === 'emi' && (
            <>
              <Result label="Monthly EMI" value={formatINR(Math.round(emi.e))} big />
              <Result label="Loan amount" value={formatPriceShort(emi.loan)} />
              <Result label="Total interest" value={formatPriceShort(emi.interest)} />
              <Result label="Total payment" value={formatPriceShort(emi.total)} />
              <View style={{ height: 10, borderRadius: 5, backgroundColor: c.accent, overflow: 'hidden', marginTop: 8 }}>
                <View style={{ height: '100%', width: `${(emi.loan / Math.max(1, emi.total)) * 100}%`, backgroundColor: c.brand }} />
              </View>
              <Txt v="caption" color="muted" style={{ marginTop: 6 }}>नीला = principal · नारंगी = interest</Txt>
            </>
          )}
          {tab === 'stamp' && (
            <>
              <Result label={`Stamp duty (${stamp.pct}%)`} value={formatINR(Math.round(stamp.duty))} />
              <Result label="Registration fee" value={formatINR(Math.round(stamp.reg))} />
              <Result label="Total govt. charges" value={formatINR(Math.round(stamp.total))} big />
              <Txt v="caption" color="muted">Female buyers को Haryana में stamp duty में छूट मिलती है।</Txt>
            </>
          )}
          {tab === 'afford' && (
            <>
              <Result label="आप ले सकते हैं (budget)" value={formatPriceShort(afford.budget)} big />
              <Result label="Max loan" value={formatPriceShort(afford.loan)} />
              <Result label="Comfortable EMI (45% of income)" value={formatINR(Math.round(afford.maxEmi))} />
            </>
          )}
        </Card>
      </Animated.View>
    </Screen>
  );
}
