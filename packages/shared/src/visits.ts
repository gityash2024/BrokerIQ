import type { LedgerItem } from './inventory';
import { inventoryPrice } from './inventory-presentation';

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
