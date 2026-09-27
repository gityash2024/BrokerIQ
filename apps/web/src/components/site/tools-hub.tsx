'use client';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateEmi, formatINR, formatPriceShort } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { Segmented } from '../ui/tabs';
import { Field, Input, Select } from '../ui/field';
import { Button } from '../ui/button';
import { EmiCalculator, RangeSlider } from './emi';

type Tool = 'emi' | 'afford' | 'stamp' | 'rentbuy';

export function ToolsHub() {
  const sp = useSearchParams();
  const router = useRouter();
  const t = (sp.get('t') as Tool) || 'emi';
  return (
    <div className="container-x py-10">
      <Segmented value={t} onChange={(v) => router.replace(`/tools?t=${v}`, { scroll: false })} options={[{ value: 'emi', label: 'EMI' }, { value: 'afford', label: 'Affordability' }, { value: 'stamp', label: 'Stamp duty' }, { value: 'rentbuy', label: 'Rent vs Buy' }]} />
      <div className="mt-8">{t === 'emi' ? <EmiCalculator /> : t === 'afford' ? <Afford /> : t === 'stamp' ? <Stamp /> : <RentBuy />}</div>
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

function Afford() {
  const { app } = useConfig();
  const [income, setIncome] = useState(150000);
  const [emis, setEmis] = useState(0);
  const [down, setDown] = useState(2500000);
  const [rate, setRate] = useState(app.finance.defaultInterestRate);
  const [years, setYears] = useState(20);
  const maxEmi = Math.max(0, income * 0.5 - emis);
  const r = rate / 1200;
  const n = years * 12;
  const loan = r ? (maxEmi * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n)) : maxEmi * n;
  const budget = loan + down;
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slide label="Monthly take-home income" v={income} set={setIncome} min={20000} max={1500000} step={5000} fmt={formatINR} />
        <Slide label="Existing EMIs" v={emis} set={setEmis} min={0} max={500000} step={1000} fmt={formatINR} />
        <Slide label="Down payment available" v={down} set={setDown} min={0} max={50000000} step={100000} fmt={formatPriceShort} />
        <Slide label="Interest rate" v={rate} set={setRate} min={6} max={14} step={0.05} fmt={(x) => `${x.toFixed(2)}%`} />
        <Slide label="Tenure" v={years} set={setYears} min={5} max={30} step={1} fmt={(x) => `${x} yrs`} />
      </div>
      <div className="grid content-start gap-3">
        <Result big label="आप इतने तक का घर ले सकते हैं" value={formatPriceShort(budget)} />
        <Result label="Max loan eligibility" value={formatPriceShort(loan)} />
        <Result label="Comfortable EMI (50% FOIR)" value={formatINR(maxEmi)} />
        <Button href={`/buy?maxPrice=${Math.round(budget)}`} className="mt-2">इस budget में properties देखें →</Button>
      </div>
    </div>
  );
}

function Stamp() {
  const { app } = useConfig();
  const [value, setValue] = useState(15000000);
  const [owner, setOwner] = useState<'male' | 'female' | 'joint'>('male');
  const pct = owner === 'female' ? app.finance.stampDutyFemalePct : owner === 'joint' ? app.finance.stampDutyJointPct : app.finance.stampDutyMalePct;
  const duty = (value * pct) / 100;
  const reg = Math.min(app.finance.registrationFeeMax, value <= 5000000 ? 25000 : app.finance.registrationFeeMax);
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slide label="Property value" v={value} set={setValue} min={1000000} max={200000000} step={100000} fmt={formatPriceShort} />
        <Field label="Buyer">
          <Select value={owner} onChange={(e) => setOwner(e.target.value as any)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="joint">Joint (male + female)</option>
          </Select>
        </Field>
        <p className="text-xs text-subtle">Haryana urban rates (admin-configurable)। Final amount sub-registrar office से confirm करें।</p>
      </div>
      <div className="grid content-start gap-3">
        <Result big label="Total government charges" value={formatINR(duty + reg)} />
        <Result label={`Stamp duty @ ${pct}%`} value={formatINR(duty)} />
        <Result label="Registration fee (approx.)" value={formatINR(reg)} />
      </div>
    </div>
  );
}

function RentBuy() {
  const { app } = useConfig();
  const [price, setPrice] = useState(15000000);
  const [rent, setRent] = useState(45000);
  const [years, setYears] = useState(10);
  const [appr, setAppr] = useState(6);
  const [rentInc, setRentInc] = useState(5);
  const res = useMemo(() => {
    const loan = price * 0.8;
    const emi = calculateEmi(loan, app.finance.defaultInterestRate, 20);
    const buyCost = price * 0.2 + emi * 12 * years + price * 0.07;
    const future = price * Math.pow(1 + appr / 100, years);
    const r = app.finance.defaultInterestRate / 1200;
    const paidMonths = years * 12;
    const outstanding = loan * Math.pow(1 + r, paidMonths) - (emi * (Math.pow(1 + r, paidMonths) - 1)) / r;
    const buyNet = buyCost - (future - Math.max(0, outstanding));
    let rentTotal = 0;
    for (let y = 0; y < years; y++) rentTotal += rent * 12 * Math.pow(1 + rentInc / 100, y);
    return { buyNet, rentTotal, future, emi };
  }, [price, rent, years, appr, rentInc, app.finance.defaultInterestRate]);
  const buyBetter = res.buyNet < res.rentTotal;
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slide label="Property price" v={price} set={setPrice} min={2000000} max={100000000} step={100000} fmt={formatPriceShort} />
        <Slide label="Monthly rent of similar home" v={rent} set={setRent} min={5000} max={500000} step={1000} fmt={formatINR} />
        <Slide label="Time horizon" v={years} set={setYears} min={3} max={25} step={1} fmt={(x) => `${x} yrs`} />
        <Slide label="Property appreciation / yr" v={appr} set={setAppr} min={0} max={15} step={0.5} fmt={(x) => `${x}%`} />
        <Slide label="Rent increase / yr" v={rentInc} set={setRentInc} min={0} max={12} step={0.5} fmt={(x) => `${x}%`} />
      </div>
      <div className="grid content-start gap-3">
        <div className={`rounded-2xl p-5 text-white ${buyBetter ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-brand-500 to-brand-700'}`}>
          <p className="text-sm opacity-80">{years} साल में बेहतर option</p>
          <p className="font-display text-3xl font-extrabold">{buyBetter ? 'Buy करना' : 'Rent पर रहना'}</p>
          <p className="mt-1 text-sm opacity-90">लगभग {formatPriceShort(Math.abs(res.rentTotal - res.buyNet))} का फ़र्क</p>
        </div>
        <Result label="Buy का net cost (appreciation घटाकर)" value={formatPriceShort(res.buyNet)} />
        <Result label="Total rent paid" value={formatPriceShort(res.rentTotal)} />
        <Result label={`Property value after ${years} yrs`} value={formatPriceShort(res.future)} />
        <p className="text-xs text-subtle">Assumes 20% down payment, 20-year loan, 7% stamp duty. अनुमान मात्र है।</p>
      </div>
    </div>
  );
}

function Slide({ label, v, set, min, max, step, fmt }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string }) {
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
