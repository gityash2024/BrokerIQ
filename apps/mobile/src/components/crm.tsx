import { View } from 'react-native';
import { Flame, Snowflake, Sun } from 'lucide-react-native';
import { LEAD_SOURCE_COLORS, LEAD_SOURCE_LABELS, LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, type LeadSource, type LeadStage } from '@brokeriq/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/ui';

export const SourceBadge = ({ source }: { source: string }) => <Badge label={LEAD_SOURCE_LABELS[source as LeadSource] ?? source} color={LEAD_SOURCE_COLORS[source as LeadSource] ?? '#64748B'} />;

export function StageBadge({ stage }: { stage: string }) {
  const c = LEAD_STAGE_COLORS[stage as LeadStage] ?? '#64748B';
  return <Badge label={LEAD_STAGE_LABELS[stage as LeadStage] ?? stage} color={c} icon={<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />} />;
}

export function TempBadge({ t }: { t?: string | null }) {
  if (!t) return null;
  const m = { HOT: ['#E11D48', Flame], WARM: ['#D97706', Sun], COLD: ['#0284C7', Snowflake] } as const;
  const [col, Icon] = m[t as keyof typeof m];
  return <Badge label={t[0] + t.slice(1).toLowerCase()} color={col} icon={<Icon size={11} color={col} />} />;
}

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: () => api<any>('/broker/team'), staleTime: 60_000 });
}
