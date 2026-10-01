import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { formatINR, moveInCost, rentAffordability, rentSplit } from '@brokeriq/shared';
import { FairRentTool } from '@/components/fair-rent';
import { useFlag } from '@/lib/config';
import { Button, Card, Chip, Header, Input, Row, Screen, Segmented, Txt } from '@/ui';

/** Rent tools — BrokerIQ is a rental marketplace (old emi/stamp/afford links open the first tool). */
type Tab = 'fair' | 'rent' | 'movein' | 'split';
const TABS: Tab[] = ['fair', 'rent', 'movein', 'split'];
const n = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0;

function Result({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <Txt color="muted" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt v={big ? 'h2' : 'bodyStrong'} color={big ? 'brand' : 'fg'}>
        {value}
      </Txt>
    </Row>
  );
}

export default function Tools() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const fairOn = useFlag('fair_rent');
  const [tab, setTab] = useState<Tab>(TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'rent');
  // rent budget
  const [income, setIncome] = useState('100000');
  const [emis, setEmis] = useState('0');
  // move-in
  const [rent, setRent] = useState('40000');
  const [depositMonths, setDepositMonths] = useState('2');
  const [brokerage, setBrokerage] = useState<'NONE' | 'DAYS_15' | 'MONTH_1' | 'FIXED'>('MONTH_1');
  const [fixed, setFixed] = useState('20000');
  const [gst, setGst] = useState(false);
  const [maintenance, setMaintenance] = useState('3000');
  // split
  const [splitRent, setSplitRent] = useState('60000');
  const [bills, setBills] = useState('6000');
  const [people, setPeople] = useState('3');
  const [premium, setPremium] = useState('15');

  const budget = rentAffordability(n(income), n(emis));
  const move = moveInCost({
    rent: n(rent),
    depositMonths: n(depositMonths),
    brokerage,
    brokerageFixed: n(fixed),
    brokerageGst: gst,
    maintenance: n(maintenance),
  });
  const split = rentSplit(n(splitRent), n(bills), n(people), n(premium));

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Rent tools" subtitle="फ़ैसले से पहले हिसाब — बिल्कुल free" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ...(fairOn ? [{ value: 'fair' as const, label: 'Fair rent' }] : []),
          { value: 'rent', label: 'Rent budget' },
          { value: 'movein', label: 'Move-in cost' },
          { value: 'split', label: 'Rent split' },
        ]}
      />
      <Animated.View key={tab} entering={FadeIn} style={{ gap: 14, marginTop: 16 }}>
        {tab === 'fair' && fairOn && <FairRentTool />}
        {tab === 'rent' && (
          <>
            <Card style={{ padding: 16, gap: 12 }}>
              <Input label="Monthly take-home income (₹)" value={income} onChangeText={setIncome} keyboardType="numeric" />
              <Input label="Existing EMIs (₹/month)" value={emis} onChangeText={setEmis} keyboardType="numeric" />
              <Txt v="caption" color="muted">
                Rule of thumb: किराया take-home का लगभग 30% (ज़्यादा से ज़्यादा 40%) रखें।
              </Txt>
            </Card>
            <Card style={{ padding: 16 }}>
              <Result label="आराम से दे सकते हैं" value={formatINR(budget.comfortable)} big />
              <Result label="Stretch budget" value={formatINR(budget.stretch)} />
            </Card>
            <Button
              title="इस budget में घर देखें"
              onPress={() => router.push({ pathname: '/(user)/search', params: { category: 'RESIDENTIAL', maxPrice: String(budget.comfortable) } })}
            />
          </>
        )}
        {tab === 'movein' && (
          <>
            <Card style={{ padding: 16, gap: 12 }}>
              <Input label="Monthly rent (₹)" value={rent} onChangeText={setRent} keyboardType="numeric" />
              <Input label="Security deposit (months)" value={depositMonths} onChangeText={setDepositMonths} keyboardType="numeric" />
              <Txt v="label" color="subtle">
                Brokerage
              </Txt>
              <Row wrap>
                {(
                  [
                    ['MONTH_1', '1 month rent'],
                    ['DAYS_15', '15 days rent'],
                    ['FIXED', 'Fixed'],
                    ['NONE', 'No brokerage'],
                  ] as const
                ).map(([k, l]) => (
                  <Chip key={k} label={l} active={brokerage === k} onPress={() => setBrokerage(k)} />
                ))}
              </Row>
              {brokerage === 'FIXED' && <Input label="Brokerage amount (₹)" value={fixed} onChangeText={setFixed} keyboardType="numeric" />}
              <Chip label="Brokerage पर 18% GST" active={gst} onPress={() => setGst(!gst)} />
              <Input label="Maintenance (₹/month)" value={maintenance} onChangeText={setMaintenance} keyboardType="numeric" />
            </Card>
            <Card style={{ padding: 16 }}>
              {move.lines.map((l) => (
                <Result key={l.label} label={l.label} value={formatINR(l.amount)} />
              ))}
              <Result label="Move-in के लिए कुल" value={formatINR(move.total)} big />
              <Txt v="caption" color="muted">
                Deposit ({formatINR(move.refundable)}) घर खाली करते समय वापस मिलता है।
              </Txt>
            </Card>
          </>
        )}
        {tab === 'split' && (
          <>
            <Card style={{ padding: 16, gap: 12 }}>
              <Input label="Monthly rent (₹)" value={splitRent} onChangeText={setSplitRent} keyboardType="numeric" />
              <Input label="Bills (electricity, wifi, maid …) (₹)" value={bills} onChangeText={setBills} keyboardType="numeric" />
              <Input label="Flatmates" value={people} onChangeText={setPeople} keyboardType="numeric" />
              <Input label="Master room premium (%)" value={premium} onChangeText={setPremium} keyboardType="numeric" />
            </Card>
            <Card style={{ padding: 16 }}>
              <Result label="बराबर बाँटने पर हर person" value={formatINR(split.perPerson)} big />
              {n(people) > 1 && n(premium) > 0 && (
                <>
                  <Result label="Master room वाला" value={formatINR(split.master)} />
                  <Result label="बाकी हर person" value={formatINR(split.others)} />
                </>
              )}
              <Result label="कुल monthly" value={formatINR(split.total)} />
            </Card>
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
