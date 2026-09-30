'use client';
import { useQuery } from '@tanstack/react-query';
import { Flame, Snowflake, Sun } from 'lucide-react';
import { LEAD_SOURCE_COLORS, LEAD_SOURCE_LABELS, LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, type LeadSource, type LeadStage } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  const c = LEAD_SOURCE_COLORS[source as LeadSource] ?? '#64748b';
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', className)}
      style={{ background: `${c}1a`, color: c }}
    >
      {LEAD_SOURCE_LABELS[source as LeadSource] ?? source}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const c = LEAD_STAGE_COLORS[stage as LeadStage] ?? '#64748b';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ background: `${c}1a`, color: c }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {LEAD_STAGE_LABELS[stage as LeadStage] ?? stage}
    </span>
  );
}

export function TempBadge({ t }: { t?: string | null }) {
  if (!t) return null;
  const m = {
    HOT: ['text-rose-600 bg-rose-50 dark:bg-rose-500/15', Flame],
    WARM: ['text-amber-600 bg-amber-50 dark:bg-amber-500/15', Sun],
    COLD: ['text-sky-600 bg-sky-50 dark:bg-sky-500/15', Snowflake],
  } as const;
  const [cls, Icon] = m[t as keyof typeof m];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', cls)}>
      <Icon className="size-3" /> {t[0] + t.slice(1).toLowerCase()}
    </span>
  );
}

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: () => api<any>('/broker/team'), staleTime: 60_000 });
}
