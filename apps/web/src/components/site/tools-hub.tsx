'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatINR, moveInCost, rentAffordability, rentSplit } from '@brokeriq/shared';
import { Segmented } from '../ui/tabs';
import { Field, Input, Select } from '../ui/field';
import { Button } from '../ui/button';
import { Switch } from '../ui/misc';
import { RangeSlider } from './emi';

/** Rent tools — BrokerIQ is a rental marketplace (old ?t=emi/stamp/… links land on the first tool). */
type Tool = 'rent' | 'movein' | 'split';
const TOOLS: { value: Tool; label: string }[] = [
  { value: 'rent', label: 'Rent budget' },
  { value: 'movein', label: 'Move-in cost' },
  { value: 'split', label: 'Rent split' },
];

export function ToolsHub() {
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get('t') as Tool;
  const t: Tool = TOOLS.some((x) => x.value === raw) ? raw : 'rent';
  return (
    <div className="container-x py-10">
      <Segmented value={t} onChange={(v) => router.replace(`/tools?t=${v}`, { scroll: false })} options={TOOLS} />
      <div className="mt-8">{t === 'rent' ? <RentBudget /> : t === 'movein' ? <MoveIn /> : <Split />}</div>
    </div>
  );
}

function Result({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={big ? 'font-display text-3xl font-extrabold text-brand-600' : 'font-display text-xl font-bold'}>{value}</p>
    </div>
  );
}

function RentBudget() {
  const [income, setIncome] = useState(100000);
  const [emis, setEmis] = useState(0);
  const r = rentAffordability(income, emis);
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slide label="Monthly take-home income" v={income} set={setIncome} min={15000} max={1000000} step={5000} fmt={formatINR} />
        <Slide label="Existing EMIs" v={emis} set={setEmis} min={0} max={300000} step={1000} fmt={formatINR} />
        <p className="text-xs text-subtle">Rule of thumb: किराया take-home का लगभग 30% (ज़्यादा से ज़्यादा 40%) रखें।</p>
      </div>
      <div className="grid content-start gap-3">
        <Result big label="आराम से दे सकते हैं (monthly rent)" value={formatINR(r.comfortable)} />
        <Result label="Stretch budget" value={formatINR(r.stretch)} />
        <Button href={`/rent?maxPrice=${r.comfortable}`} className="mt-2">
          इस budget में घर देखें →
        </Button>
      </div>
    </div>
  );
}

function MoveIn() {
  const [rent, setRent] = useState(40000);
  const [depositMonths, setDepositMonths] = useState(2);
  const [brokerage, setBrokerage] = useState<'NONE' | 'DAYS_15' | 'MONTH_1' | 'FIXED'>('MONTH_1');
  const [fixed, setFixed] = useState(20000);
  const [gst, setGst] = useState(false);
  const [maintenance, setMaintenance] = useState(3000);
  const [shifting, setShifting] = useState(0);
  const r = moveInCost({ rent, depositMonths, brokerage, brokerageFixed: fixed, brokerageGst: gst, maintenance, shifting });
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slide label="Monthly rent" v={rent} set={setRent} min={5000} max={500000} step={1000} fmt={formatINR} />
        <Slide
          label="Security deposit (months)"
          v={depositMonths}
          set={setDepositMonths}
          min={0}
          max={6}
          step={1}
          fmt={(x) => `${x} month${x === 1 ? '' : 's'}`}
        />
        <Field label="Brokerage">
          <Select value={brokerage} onChange={(e) => setBrokerage(e.target.value as any)}>
            <option value="MONTH_1">1 month rent</option>
            <option value="DAYS_15">15 days rent</option>
            <option value="FIXED">Fixed amount</option>
            <option value="NONE">No brokerage</option>
          </Select>
        </Field>
        {brokerage === 'FIXED' && <Slide label="Brokerage amount" v={fixed} set={setFixed} min={0} max={300000} step={1000} fmt={formatINR} />}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Brokerage पर 18% GST</span>
          <Switch checked={gst} onCheckedChange={setGst} />
        </div>
        <Slide label="Maintenance (monthly)" v={maintenance} set={setMaintenance} min={0} max={50000} step={500} fmt={formatINR} />
        <Slide label="Packers & shifting" v={shifting} set={setShifting} min={0} max={100000} step={1000} fmt={formatINR} />
      </div>
      <div className="grid content-start gap-3">
        <Result big label="Move-in के लिए कुल चाहिए" value={formatINR(r.total)} />
        <div className="rounded-2xl bg-surface-2 p-4 text-sm">
          {r.lines.map((l) => (
            <div key={l.label} className="flex justify-between py-1">
              <span className="text-muted">{l.label}</span>
              <span className="font-semibold">{formatINR(l.amount)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-subtle">Deposit ({formatINR(r.refundable)}) घर खाली करते समय वापस मिलता है।</p>
      </div>
    </div>
  );
}

function Split() {
  const [rent, setRent] = useState(60000);
  const [bills, setBills] = useState(6000);
  const [people, setPeople] = useState(3);
  const [premium, setPremium] = useState(15);
  const r = rentSplit(rent, bills, people, premium);
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slide label="Monthly rent" v={rent} set={setRent} min={5000} max={500000} step={1000} fmt={formatINR} />
        <Slide label="Bills (electricity, wifi, maid …)" v={bills} set={setBills} min={0} max={100000} step={500} fmt={formatINR} />
        <Slide label="Flatmates" v={people} set={setPeople} min={1} max={8} step={1} fmt={(x) => `${x}`} />
        <Slide label="Master room premium" v={premium} set={setPremium} min={0} max={50} step={5} fmt={(x) => `${x}%`} />
      </div>
      <div className="grid content-start gap-3">
        <Result big label="बराबर बाँटने पर हर person" value={formatINR(r.perPerson)} />
        {people > 1 && premium > 0 && (
          <>
            <Result label="Master room वाला" value={formatINR(r.master)} />
            <Result label="बाकी हर person" value={formatINR(r.others)} />
          </>
        )}
        <Result label="कुल monthly" value={formatINR(r.total)} />
      </div>
    </div>
  );
}

function Slide({
  label,
  v,
  set,
  min,
  max,
  step,
  fmt,
}: {
  label: string;
  v: number;
  set: (n: number) => void;
  min: number;
  max: number;
  step: number;
  fmt: (n: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <Input className="h-8 w-36 text-right font-semibold" value={fmt(v)} readOnly />
      </div>
      <RangeSlider value={v} min={min} max={max} step={step} onChange={set} />
    </div>
  );
}
