'use client';

import { useState } from 'react';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';

import {
  MAX_VISIT_PROPERTIES,
  visitInventoryTitle,
  visitPropertyStops,
  visitShortlistStops,
  visitShortlistedIds,
  type LedgerItem,
  type VisitPropertySelection,
  type VisitPropertySnapshot,
} from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { VisitPropertyPicker } from './visit-property-picker';

export function VisitProperties({ items, onChange }: { items: LedgerItem[]; onChange: (items: LedgerItem[]) => void }) {
  return (
    <section className="space-y-3" aria-label="Visit properties">
      <p className="text-sm font-semibold">
        Properties · {items.length}/{MAX_VISIT_PROPERTIES}
      </p>
      {items.length > 0 && (
        <ol className="list-decimal space-y-2 pl-6">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{visitInventoryTitle(item)}</span>
                <Button type="button" size="xs" variant="ghost" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {items.length < MAX_VISIT_PROPERTIES && (
        <VisitPropertyPicker
          excluded={items.map((item) => item.id)}
          value={null}
          onChange={(item) => {
            if (item && !items.some((entry) => entry.id === item.id)) onChange([...items, item]);
          }}
        />
      )}
    </section>
  );
}

export function VisitItinerary({ snapshot, remainingOnly }: { snapshot?: VisitPropertySnapshot | null; remainingOnly?: boolean }) {
  const selected = remainingOnly ? visitShortlistedIds(snapshot) : [];
  const stops = (selected.length ? visitShortlistStops(snapshot) : visitPropertyStops(snapshot)).filter(({ id }) => !selected.includes(id));
  if (!stops.length) return null;
  return (
    <details className="mt-2 rounded-xl border border-line p-3 text-sm">
      <summary className="cursor-pointer font-semibold">{stops.length} properties</summary>
      <ol className="mt-2 list-decimal space-y-2 pl-5">
        {stops.map((stop) => (
          <li key={stop.id}>
            {stop.title}
            {stop.address && stop.address !== stop.title && <span className="block text-xs text-muted">{stop.address}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}

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
