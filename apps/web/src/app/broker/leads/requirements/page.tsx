'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { Dialog } from '@/components/ui/dialog';
import { RequirementForm } from '@/components/broker/launch/requirement-form';
import { formatINR } from '@brokeriq/shared';
export default function RequirementsPage() {
  const [adding, setAdding] = useState(false);
  const [match, setMatch] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['broker-requirements', page], queryFn: () => api<any>(`/broker-requirements?page=${page}`) });
  const matches = useQuery({ queryKey: ['requirement-matches', match], queryFn: () => api<any>(`/broker-requirements/${match}/matches`), enabled: !!match });
  return (
    <>
      <PageHeader
        title="Requirements"
        subtitle="एक contact की अलग-अलग जरूरतें सुरक्षित रहती हैं"
        actions={
          <button onClick={() => setAdding(true)} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">
            + Requirement
          </button>
        }
      />
      <div className="mb-5 flex gap-5 text-sm">
        <Link href="/broker/leads">Contacts & leads</Link>
        <Link href="/broker/pipeline">Pipeline</Link>
        <Link href="/broker/follow-ups">Follow-ups</Link>
        <Link href="/broker/visits">Visits</Link>
      </div>
      {query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {query.data?.items.map((item: any) => (
            <article key={item.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex justify-between">
                <h2 className="font-bold">{item.contactName || 'Contact not recorded'}</h2>
                <span className="text-xs text-muted">{item.status}</span>
              </div>
              <p className="mt-2 text-sm">
                {item.purpose || 'Purpose unknown'} · {item.bedrooms.join(', ') || 'Rooms not specified'} {item.roomKind || ''}
              </p>
              <p className="mt-1 text-sm text-muted">{item.localityNames.join(' · ') || 'Locality unknown'}</p>
              <p className="mt-3 font-semibold">
                {item.minBudget != null ? formatINR(item.minBudget) : 'No minimum'} — {item.maxBudget != null ? formatINR(item.maxBudget) : 'No maximum'}
              </p>
              <p className="mt-2 line-clamp-3 text-xs text-muted">{item.notes}</p>
              <button onClick={() => setMatch(item.id)} className="mt-4 text-sm font-semibold text-brand-600">
                Find matching properties →
              </button>
            </article>
          ))}
        </div>
      )}
      {query.data?.total === 0 && (
        <p className="rounded-xl border border-line p-8 text-center text-muted">Add a requirement or approve one from Inbox imports.</p>
      )}
      <div className="mt-5 flex justify-end gap-5 text-sm">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
      <Dialog open={adding} onOpenChange={setAdding} title="New requirement">
        <RequirementForm
          onSave={async (body) => {
            await api('/broker-requirements', { body });
            setAdding(false);
            await qc.invalidateQueries({ queryKey: ['broker-requirements'] });
          }}
        />
      </Dialog>
      <Dialog
        open={!!match}
        onOpenChange={(open) => {
          if (!open) setMatch(null);
        }}
        title="Matching inventory"
        size="lg"
      >
        {matches.error && <p role="alert">{errorMessage(matches.error)}</p>}
        {['available', 'unknown'].map((group) => (
          <div key={group} className="mb-5">
            <h2 className="mb-3 font-bold">{group === 'available' ? 'Confirmed available' : 'Availability needs confirmation'}</h2>
            {matches.data?.[group].map((m: any) => (
              <Link key={m.item.id} href="/broker/inventory" className="mb-2 block rounded-xl border border-line p-3">
                <p className="font-semibold">
                  {m.item.houseNo || 'House not recorded'} · {m.item.sector}
                </p>
                <p className="mt-1 text-xs text-muted">{m.reasons.join(' · ')}</p>
              </Link>
            ))}
            {matches.data?.[group].length === 0 && <p className="text-sm text-muted">No matches in this group</p>}
          </div>
        ))}
      </Dialog>
    </>
  );
}
