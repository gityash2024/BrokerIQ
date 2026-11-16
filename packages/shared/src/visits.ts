import { z } from 'zod';
import type { LedgerItem } from './inventory';
import { inventoryPrice } from './inventory-presentation';

export const MAX_VISIT_PROPERTIES = 20;

export type VisitPropertyStop = {
  id: string;
  title: string;
  address?: string | null;
  sector?: string | null;
  directionsUrl?: string | null;
};

export type VisitPropertySnapshot = Partial<VisitPropertyStop> & {
  stops?: VisitPropertyStop[];
  shortlistedPropertyIds?: string[];
};
export type VisitPropertySelection = {
  id: string;
  status: string;
  scheduledAt: string;
  updatedAt: string;
  propertySnapshot?: VisitPropertySnapshot | null;
};

export type MappedVisit = VisitPropertySelection & {
  address?: string | null;
  lead: { name: string };
};

export const visitShortlistSchema = z
  .object({
    propertyIds: z.array(z.string().trim().min(1).max(100)).max(MAX_VISIT_PROPERTIES),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .refine(({ propertyIds }) => new Set(propertyIds).size === propertyIds.length, {
    path: ['propertyIds'],
    message: 'Select each property only once',
  });

export function visitPropertyStops(snapshot?: { stops?: VisitPropertyStop[] } | null): VisitPropertyStop[] {
  return snapshot?.stops ?? [];
}

export function visitShortlistStops(snapshot?: VisitPropertySnapshot | null): VisitPropertyStop[] {
  const stops = visitPropertyStops(snapshot);
  if (stops.length) return stops;
  if (!snapshot?.id || !snapshot.title) return [];
  return [
    {
      id: snapshot.id,
      title: snapshot.title,
      address: snapshot.address,
      sector: snapshot.sector,
      ...(snapshot.directionsUrl ? { directionsUrl: snapshot.directionsUrl } : {}),
    },
  ];
}

export function visitShortlistedIds(snapshot?: VisitPropertySnapshot | null): string[] {
  return snapshot?.shortlistedPropertyIds ?? [];
}

/** IDs identify distinct units; a shared house number never merges floors. */
export function visitInventoryTitle(item: Pick<LedgerItem, 'houseNo' | 'unitLabel' | 'floor' | 'sector' | 'address'>): string {
  return (
    [item.houseNo, item.unitLabel, item.floor, item.sector].filter((v) => v !== null && v !== undefined && v !== '').join(' · ') || item.address || 'Property'
  );
}
export function visitInventoryDetails(item: LedgerItem): string {
  return [item.bhk != null ? `${item.bhk} ${item.roomKind || 'BHK'}` : item.roomKind, item.purpose, inventoryPrice(item), item.availability]
    .filter(Boolean)
    .join(' · ');
}
/** Date's constructor silently rolls invalid calendar days; reject them before submission. */
export function parseVisitLocalDateTime(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute
    ? date
    : null;
}
export function parseVisit12HourDateTime(date: string, hour: string, minute: string, period: 'AM' | 'PM'): Date | null {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  const h = Number(hour),
    m = Number(minute);
  if (h < 1 || h > 12 || m > 59) return null;
  return parseVisitLocalDateTime(`${date}T${String((h % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}
