'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, Select } from '@/components/ui/field';

export type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';

export interface DateRangeValue {
  preset: DatePreset;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
}

const IST_OFFSET_MS = 5.5 * 3600_000;

/**
 * Client-side evaluation helper ensuring exact alignment with backend IST midnight boundaries (+05:30).
 */
export function isDateInRange(
  dateInput: string | Date | number | null | undefined,
  value: DateRangeValue,
): boolean {
  if (!dateInput) return false;
  if (!value) return true;
  const preset = (value.preset || 'ALL').toUpperCase() as DatePreset;
  if (preset === 'ALL') return true;

  const timestamp = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(timestamp)) return true;

  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();

  const getIstDayUtcRange = (y: number, m: number, d: number) => {
    const start = Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS;
    const end = Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS;
    return { start, end };
  };

  switch (preset) {
    case 'TODAY': {
      const { start, end } = getIstDayUtcRange(istYear, istMonth, istDay);
      return timestamp >= start && timestamp <= end;
    }
    case 'YESTERDAY': {
      const { start, end } = getIstDayUtcRange(istYear, istMonth, istDay - 1);
      return timestamp >= start && timestamp <= end;
    }
    case 'LAST_7_DAYS': {
      const { start } = getIstDayUtcRange(istYear, istMonth, istDay - 6);
      const { end } = getIstDayUtcRange(istYear, istMonth, istDay);
      return timestamp >= start && timestamp <= end;
    }
    case 'THIS_MONTH': {
      const { start } = getIstDayUtcRange(istYear, istMonth, 1);
      const { end } = getIstDayUtcRange(istYear, istMonth, istDay);
      return timestamp >= start && timestamp <= end;
    }
    case 'CUSTOM': {
      let matches = true;
      if (value.from) {
        const [y, m, d] = value.from.split('-').map(Number);
        const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
        if (timestamp < start) matches = false;
      }
      if (value.to) {
        const [y, m, d] = value.to.split('-').map(Number);
        const end = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS;
        if (timestamp > end) matches = false;
      }
      return matches;
    }
    default:
      return true;
  }
}

export function DateRangeFilter({
  value,
  onChange,
  className,
  size = 'sm',
  disabled = false,
}: DateRangeFilterProps) {
  const normalizedPreset = (value?.preset || 'ALL').toUpperCase() as DatePreset;

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'CUSTOM') {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      onChange({
        preset: 'CUSTOM',
        from: value?.from || todayStr,
        to: value?.to || todayStr,
      });
    } else {
      onChange({
        preset,
        from: undefined,
        to: undefined,
      });
    }
  };

  const isSmall = size === 'sm' || size === 'xs';

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <div className="relative min-w-[145px]">
        <Select
          value={normalizedPreset}
          disabled={disabled}
          onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
          className={cn(isSmall ? 'h-9 text-xs' : 'h-11 text-sm', 'pl-8')}
        >
          <option value="ALL">सभी तिथियां (All Time)</option>
          <option value="TODAY">आज (Today)</option>
          <option value="YESTERDAY">कल (Yesterday)</option>
          <option value="LAST_7_DAYS">पिछले 7 दिन (Last 7 Days)</option>
          <option value="THIS_MONTH">इस महीने (This Month)</option>
          <option value="CUSTOM">कस्टम तारीख (Custom Range)</option>
        </Select>
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
      </div>

      {normalizedPreset === 'CUSTOM' && (
        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
          <Input
            type="date"
            disabled={disabled}
            value={value?.from || ''}
            max={value?.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={cn(isSmall ? 'h-9 text-xs w-32 px-2' : 'h-11 text-sm w-36 px-3')}
            placeholder="From"
            aria-label="Start date"
          />
          <span className="text-xs text-muted">to</span>
          <Input
            type="date"
            disabled={disabled}
            value={value?.to || ''}
            min={value?.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={cn(isSmall ? 'h-9 text-xs w-32 px-2' : 'h-11 text-sm w-36 px-3')}
            placeholder="To"
            aria-label="End date"
          />
        </div>
      )}
    </div>
  );
}
