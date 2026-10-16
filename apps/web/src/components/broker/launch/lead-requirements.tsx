'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { RequirementForm } from './requirement-form';

/** Contact-specific requirements use the same inventory matcher as Inbox imports. */
export function LeadRequirements({ lead }: { lead: { id: string; name: string; phone: string } }) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['broker-requirements', 'lead', lead.id, page],
    queryFn: () => api<any>(`/broker-requirements?leadId=${lead.id}&page=${page}`),
  });
  const matches = useQuery({
    queryKey: ['requirement-matches', selected],
    queryFn: () => api<any>(`/broker-requirements/${selected}/matches`),
    enabled: !!selected,
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Each requirement is saved separately.</p>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add requirement
        </Button>
      </div>
      {query.error && <ApiErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.total === 0 && <p className="card p-6 text-muted">Add a requirement to match your inventory.</p>}
      {query.data?.items.map((item: any) => (
        <article key={item.id} className="card space-y-2 p-4">
          <div className="flex justify-between gap-3">
            <b>{item.purpose || 'Purpose unknown'}</b>
            <span className="text-xs text-muted">{item.status}</span>
          </div>
          <p>{item.localityNames.join(' · ')}</p>
          <p className="text-sm text-muted">
            {item.bedrooms.join(', ')} {item.roomKind || ''} · {item.minBudget == null ? 'No minimum' : formatINR(item.minBudget)} —{' '}
            {item.maxBudget == null ? 'No maximum' : formatINR(item.maxBudget)}
          </p>
          {item.notes && <p className="whitespace-pre-line text-sm">{item.notes}</p>}
          <Button variant="secondary" size="sm" onClick={() => setSelected(item.id)}>
            Find matching properties →
          </Button>
        </article>
      ))}
      <div className="flex justify-end gap-3">
        <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="ghost" disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
      <Dialog open={adding} onOpenChange={setAdding} title="New requirement">
        <RequirementForm
          initial={{ leadId: lead.id, contactName: lead.name, contactPhone: lead.phone }}
          onSave={async (body) => {
            await api('/broker-requirements', { body });
            setAdding(false);
            await qc.invalidateQueries({ queryKey: ['broker-requirements'] });
          }}
        />
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Matching inventory"
      >
        {matches.error && <ApiErrorState error={matches.error} onRetry={() => matches.refetch()} />}
        {['available', 'unknown'].map((group) => (
          <section key={group} className="mb-5 space-y-3">
            <h3 className="font-bold">{group === 'available' ? 'Confirmed available' : 'Availability needs confirmation'}</h3>
            {matches.data?.[group].map((result: any) => (
              <div key={result.item.id} className="rounded-xl border border-line p-3">
                <b>
                  {result.item.houseNo || 'House not recorded'} · {result.item.unitLabel || result.item.floor} · {result.item.sector}
                </b>
                <p className="mt-1 text-xs text-muted">{result.reasons.join(' · ')}</p>
              </div>
            ))}
            {matches.data?.[group].length === 0 && <p className="text-sm text-muted">No matches in this group</p>}
          </section>
        ))}
        <Link href="/broker/inventory" className="font-semibold text-brand-600">
          Open inventory →
        </Link>
      </Dialog>
    </div>
  );
}
