'use client';

import { useState } from 'react';
import { visitShortlistStops, visitShortlistedIds, type VisitPropertySelection } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';

export function VisitShortlist({ visits, canEdit, onChange }: { visits: VisitPropertySelection[]; canEdit: boolean; onChange: () => void }) {
  const completed = visits.filter((visit) => visit.status === 'COMPLETED' && visitShortlistStops(visit.propertySnapshot).length);
  return (
    <section className="card space-y-4 p-5" aria-label="Shortlisted properties">
      <h3 className="font-display font-bold">Shortlisted properties</h3>
      {!completed.length && <p className="text-sm text-muted">There are no properties on this lead’s completed visits.</p>}
      {completed.map((visit) => (
        <ShortlistVisit key={visit.id + ':' + visit.updatedAt} visit={visit} canEdit={canEdit} onChange={onChange} />
      ))}
    </section>
  );
}

function ShortlistVisit({ visit, canEdit, onChange }: { visit: VisitPropertySelection; canEdit: boolean; onChange: () => void }) {
  const saved = visitShortlistedIds(visit.propertySnapshot);
  const [selected, setSelected] = useState(saved);
  const save = useApiMutation(() => patch(`/visits/${visit.id}/shortlist`, { propertyIds: selected, expectedUpdatedAt: visit.updatedAt }), {
    success: 'Shortlist saved',
    onSuccess: onChange,
  });
  const changed = selected.length !== saved.length || selected.some((id) => !saved.includes(id));
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3" disabled={!canEdit || save.isPending}>
      <legend className="px-1 text-sm font-semibold">{formatDateTime(visit.scheduledAt)}</legend>
      {visitShortlistStops(visit.propertySnapshot).map((stop) => (
        <label key={stop.id} className="flex items-start gap-2 py-1 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(stop.id)}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelected((ids) => (checked ? [...ids, stop.id] : ids.filter((id) => id !== stop.id)));
            }}
          />
          <span>
            {stop.title}
            {stop.address && stop.address !== stop.title && <span className="block text-xs text-muted">{stop.address}</span>}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted">{saved.includes(stop.id) ? 'Shortlisted' : 'Site visit'}</span>
        </label>
      ))}
      {canEdit && (
        <Button type="button" size="sm" disabled={!changed} loading={save.isPending} onClick={() => save.mutate()}>
          Save shortlist
        </Button>
      )}
    </fieldset>
  );
}
