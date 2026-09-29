'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Pause, Play, Trash2 } from 'lucide-react';
import { FURNISHING_LABELS, formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { del, patch, useApiMutation } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ListingCard } from '@/components/site/listing-card';
import { RequirementButton } from '@/components/site/requirement';

function RequirementsInner() {
  const sp = useSearchParams();
  const list = useQuery({ queryKey: ['requirements'], queryFn: () => api<any[]>('/requirements/mine') });
  const [sel, setSel] = useState<string | null>(sp.get('id'));
  const active = sel ?? list.data?.[0]?.id ?? null;
  const matches = useQuery({ queryKey: ['requirement-matches', active], queryFn: () => api<any[]>(`/requirements/${active}/matches`), enabled: !!active });
  const setStatus = useApiMutation((b: { id: string; status: string }) => patch(`/requirements/${b.id}`, { status: b.status }), { success: 'Updated', invalidate: [['requirements']] });
  const remove = useApiMutation((id: string) => del(`/requirements/${id}`), { success: 'Deleted', invalidate: [['requirements']], onSuccess: () => setSel(null) });
  return (
    <>
      <PageHeader title="मेरी ज़रूरतें" subtitle="नई matching property आते ही app notification, email और WhatsApp से बताएँगे" actions={<RequirementButton variant="primary" />} />
      {list.isLoading ? (
        <Skeleton className="h-40" />
      ) : !list.data?.length ? (
        <Empty icon={<ClipboardList className="size-6" />} title="अभी कोई ज़रूरत नहीं बताई" text="BHK, budget और sector बताइए — हम मिलती properties ढूँढकर भेजेंगे।" action={<RequirementButton variant="primary" />} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {list.data.map((r) => (
              <button key={r.id} onClick={() => setSel(r.id)} className={`card w-full p-4 text-left transition ${active === r.id ? 'border-brand-500 ring-2 ring-brand-500/20' : 'hover:border-brand-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{r.bedrooms.length ? `${r.bedrooms.join('/')} BHK` : 'कोई भी BHK'}{r.maxBudget ? ` · ${formatINR(r.maxBudget)} तक` : ''}</p>
                  <Badge tone={r.status === 'ACTIVE' ? 'success' : 'neutral'}>{r.status === 'ACTIVE' ? 'Alerts ON' : r.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{r.localityIds.length ? `${r.localityIds.length} इलाके` : 'पूरा Gurgaon'}{r.furnishing ? ` · ${FURNISHING_LABELS[r.furnishing as keyof typeof FURNISHING_LABELS]}` : ''} · {formatDate(r.createdAt)}</p>
                <p className="mt-1 text-xs text-muted">{r.matchCount} alerts भेजे{r.sharedOrgIds.length ? ` · ${r.sharedOrgIds.length} brokers को भेजी` : ''}</p>
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {r.status === 'ACTIVE' ? (
                    <Button size="xs" variant="secondary" onClick={() => setStatus.mutate({ id: r.id, status: 'PAUSED' })}><Pause className="size-3.5" /> Alerts रोकें</Button>
                  ) : (
                    <Button size="xs" variant="secondary" onClick={() => setStatus.mutate({ id: r.id, status: 'ACTIVE' })}><Play className="size-3.5" /> Alerts चालू</Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => confirm('यह ज़रूरत delete करें?') && remove.mutate(r.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-3 font-display font-bold">Matching properties {matches.data ? `(${matches.data.length})` : ''}</p>
            {matches.isLoading ? (
              <Skeleton className="h-64" />
            ) : !matches.data?.length ? (
              <Empty title="अभी कोई matching property नहीं" text="जैसे ही आएगी, हम बताएँगे।" />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{matches.data.map((l) => <ListingCard key={l.id} l={l} />)}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function RequirementsPage() {
  return (
    <Suspense>
      <RequirementsInner />
    </Suspense>
  );
}
