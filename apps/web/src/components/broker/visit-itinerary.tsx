import { visitPropertyStops, visitShortlistStops, visitShortlistedIds, type VisitPropertySnapshot } from '@brokeriq/shared';

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
