import { inventoryNavigation, visitShortlistStops, visitShortlistedIds, type VisitPropertySnapshot } from '@brokeriq/shared';

export function VisitItinerary({ snapshot, remainingOnly }: { snapshot?: VisitPropertySnapshot | null; remainingOnly?: boolean }) {
  const selected = remainingOnly ? visitShortlistedIds(snapshot) : [];
  const stops = visitShortlistStops(snapshot).filter(({ id }) => !selected.includes(id));
  if (!stops.length) return null;
  return (
    <details className="mt-2 rounded-xl border border-line p-3 text-sm">
      <summary className="cursor-pointer font-semibold">{stops.length} properties</summary>
      <ol className="mt-2 list-decimal space-y-2 pl-5">
        {stops.map((stop) => {
          const { route, exact, sectorMap } = inventoryNavigation(stop);
          return (
            <li key={stop.id}>
              {stop.title}
              {stop.address && stop.address !== stop.title && <span className="block text-xs text-muted">{stop.address}</span>}
              {route && (
                <a href={route} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 underline">
                  {exact ? 'Open property directions' : 'Search address in Maps'}
                </a>
              )}
              {sectorMap && (
                <a href={sectorMap} target="_blank" rel="noreferrer" className="ml-3 text-xs font-semibold text-muted underline">
                  Sector map
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
