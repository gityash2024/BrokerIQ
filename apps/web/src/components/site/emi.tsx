'use client';
import { useMemo, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { calculateEmi, formatINR, formatPriceShort } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';

export function RangeSlider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <Slider.Root
      className="relative flex h-6 w-full touch-none items-center select-none"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
    >
      <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-2">
        <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" />
      </Slider.Track>
      <Slider.Thumb
        className="block size-5 rounded-full border-2 border-brand-600 bg-white shadow-md transition hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
        aria-label="value"
      />
    </Slider.Root>
  );
}

export function EmiCalculator({ price, compact }: { price?: number; compact?: boolean }) {
  const { app } = useConfig();
  const [amount, setAmount] = useState(price ? Math.round(price * 0.8) : 5000000);
  const [rate, setRate] = useState(app.finance.defaultInterestRate);
  const [years, setYears] = useState(20);
  const emi = useMemo(() => calculateEmi(amount, rate, years), [amount, rate, years]);
  const total = emi * years * 12;
  const interest = total - amount;
  const pct = Math.round((amount / total) * 100);
  return (
    <div className={compact ? '' : 'card p-6'}>
      <div className="grid gap-6 md:grid-cols-[1fr_220px] md:items-center">
        <div className="space-y-5">
          <Row label="Loan amount" value={formatPriceShort(amount)}>
            <RangeSlider value={amount} min={500000} max={Math.max(100000000, (price ?? 0) * 1.2)} step={100000} onChange={setAmount} />
          </Row>
          <Row label="Interest rate" value={`${rate.toFixed(2)}%`}>
            <RangeSlider value={rate} min={6} max={15} step={0.05} onChange={setRate} />
          </Row>
          <Row label="Tenure" value={`${years} years`}>
            <RangeSlider value={years} min={1} max={30} step={1} onChange={setYears} />
          </Row>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="relative size-36">
            <svg viewBox="0 0 36 36" className="size-36 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-saffron-400" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeDasharray={`${pct} ${100 - pct}`}
                className="text-brand-600 transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <p className="text-[11px] text-muted">Monthly EMI</p>
                <p className="font-display text-lg font-extrabold">{formatINR(emi)}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <p className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-600" /> Principal {formatPriceShort(amount)}
            </p>
            <p className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-saffron-400" /> Interest {formatPriceShort(interest)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      {children}
    </div>
  );
}
