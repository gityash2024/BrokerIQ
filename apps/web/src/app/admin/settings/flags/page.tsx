'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Empty, Skeleton, Switch } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const LABELS: Record<string, string> = {
  ai_scanner: 'AI listing-book scanner (brokers)',
  ai_assist: 'AI description / lead insights',
  whatsapp_automation: 'WhatsApp automation messages',
  broker_microsites: 'Broker microsites',
  reviews: 'Broker reviews',
  projects: 'New projects section',
  boosts: 'Paid listing boosts',
  chat: 'In-app chat (user ↔ broker)',
};

export default function FlagsPage() {
  const q = useQuery({ queryKey: ['admin-flags'], queryFn: () => api<any[]>('/admin/flags') });
  const toggle = useApiMutation((f: any) => patch(`/admin/flags/${f.key}`, { enabled: !f.enabled }), { success: (r: any) => `${LABELS[r.key] ?? r.key} ${r.enabled ? 'ON' : 'OFF'}`, invalidate: [['admin-flags']] });
  return (
    <>
      <PageHeader title="Feature flags" subtitle="किसी भी feature को बिना deploy किए तुरंत on/off करें — web और app दोनों पर लागू" />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !q.data.length ? (
        <Empty icon={<ToggleRight className="size-7" />} title="कोई flag नहीं" text="Seed चलाने पर default flags बनते हैं।" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((f, i) => (
            <motion.div key={f.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card flex items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{LABELS[f.key] ?? f.key}</p>
                <p className="text-xs text-muted">{f.description ?? f.key} · updated {formatDateTime(f.updatedAt)}</p>
              </div>
              <Switch checked={f.enabled} onCheckedChange={() => toggle.mutate(f)} />
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
