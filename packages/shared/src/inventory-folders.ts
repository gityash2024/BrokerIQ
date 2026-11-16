import { z } from 'zod';
import { INVENTORY_PROPERTY_TYPES } from './property-fields';
import type { InventoryInput } from './inventory';

export const inventoryMonthSchema = z.string().regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/, 'Choose a year and month');
export const inventoryFolderModeSchema = z.enum(['AVAILABLE', 'RENTED', 'REVIEW']);
export type InventoryFolderMode = z.infer<typeof inventoryFolderModeSchema>;
export type InventoryFolder = { key: string; label: string; count: number };
export type InventoryFolders = { folders: InventoryFolder[]; years: string[] };

export function inventoryMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(({ type }) => type === 'year')?.value}-${parts.find(({ type }) => type === 'month')?.value}`;
}

type FolderProperty = {
  sector?: string | null;
  address?: string | null;
  houseNo?: string | null;
  unitLabel?: string | null;
  floor?: string | null;
  purpose?: string | null;
  category?: string | null;
  propertyType?: string | null;
  furnishing?: string | null;
  bhk?: number | null;
  roomKind?: string | null;
  area?: unknown;
  areaUnit?: string | null;
  monthlyRent?: unknown;
  rent?: unknown;
  totalSalePrice?: unknown;
};

export function missingInventoryFolderFields(item: FolderProperty): string[] {
  const rooms = item.category === 'RESIDENTIAL';
  const building = rooms || item.category === 'COMMERCIAL';
  const amount = item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : item.totalSalePrice;
  const fields: [boolean, string][] = [
    [!!item.sector?.trim(), 'Sector / locality'],
    [!!(item.address?.trim() || item.houseNo?.trim()), 'Address or house / plot number'],
    [item.purpose === 'RENT' || item.purpose === 'SALE', 'Transaction'],
    [!!item.category, 'Category'],
    [!!item.propertyType, 'Property type'],
    [!rooms || item.roomKind === 'STUDIO' || item.roomKind === 'RK' || (item.roomKind === 'BHK' && Number(item.bhk) > 0), 'Room configuration'],
    [!building || !!item.furnishing, 'Furnishing'],
    [item.propertyType !== 'BUILDER_FLOOR' || !!(item.floor?.trim() || item.unitLabel?.trim()), 'Floor or unit'],
    [Number(item.area) > 0 && !!item.areaUnit, 'Area and unit'],
    [Number(amount) > 0, item.purpose === 'SALE' ? 'Total sale price' : 'Monthly rent'],
  ];
  return fields.flatMap(([present, label]) => (present ? [] : [label]));
}

export const NAMED_INVENTORY_TYPES = ['PENTHOUSE', 'BUILDER_FLOOR', 'INDEPENDENT_HOUSE'] as const;

export function inventoryRoomFolder(item: Pick<FolderProperty, 'roomKind' | 'bhk' | 'propertyType'>): string {
  if (NAMED_INVENTORY_TYPES.some((type) => type === item.propertyType)) return `TYPE:${item.propertyType}`;
  if (item.roomKind === 'STUDIO') return 'STUDIO';
  if (item.roomKind === 'RK') return 'RK';
  if (item.bhk && (item.roomKind === 'BHK' || !item.roomKind)) return `BHK:${item.bhk}`;
  return item.propertyType ? `TYPE:${item.propertyType}` : 'OTHER';
}

export function inventoryFolderDefaults(
  room?: string | null,
  furnishing?: string | null,
): Pick<InventoryInput, 'roomKind' | 'bhk' | 'category' | 'propertyType' | 'furnishing'> {
  const bedrooms = /^BHK:([1-9][0-9]?|100)$/.exec(room ?? '');
  const otherType = /^TYPE:([A-Z_]+)$/.exec(room ?? '');
  return {
    ...(bedrooms ? { roomKind: 'BHK' as const, bhk: Number(bedrooms[1]), category: 'RESIDENTIAL' as const } : {}),
    ...(room === 'RK' || room === 'STUDIO' ? { roomKind: room, category: 'RESIDENTIAL' as const } : {}),
    ...(otherType && INVENTORY_PROPERTY_TYPES.includes(otherType[1]) ? { propertyType: otherType[1] } : {}),
    ...(furnishing === 'UNFURNISHED' || furnishing === 'SEMI_FURNISHED' || furnishing === 'FULLY_FURNISHED' ? { furnishing } : {}),
  };
}
