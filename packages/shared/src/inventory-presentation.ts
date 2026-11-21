import { inventoryDate, inventoryDateLabel, inventoryDateSchema } from './inventory-folders';
import type { LedgerItem, OwnerEditableProperty } from './inventory';
import { INVENTORY_PROPERTY_TYPES, PROPERTY_FIELDS } from './property-fields';
import { floorLabel } from './design';
import { formatINR } from './utils';
export const readableValue = (value: unknown): string =>
  typeof value === 'boolean'
    ? value
      ? 'Yes'
      : 'No'
    : Array.isArray(value)
      ? value.map(readableValue).join(' · ')
      : /^[A-Z_\d]+$/.test(String(value))
        ? String(value)
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : String(value);
export const inventoryTitle = (item: LedgerItem) =>
  `${item.propertyType ? readableValue(item.propertyType) : item.houseNo ? 'House' : 'Property'}${item.houseNo ? ` ${item.houseNo}` : ''}${item.unitLabel ? ` · ${item.unitLabel}` : ''}`;
export const inventoryPrice = (item: LedgerItem) =>
  item.purpose === 'RENT' && (item.monthlyRent ?? item.rent) != null
    ? `${formatINR((item.monthlyRent ?? item.rent)!)}/month`
    : item.totalSalePrice != null
      ? formatINR(item.totalSalePrice)
      : item.ratePerArea != null
        ? `${formatINR(item.ratePerArea)}${item.rateAreaUnit ? `/${item.rateAreaUnit.replace(/_/g, ' ').toLowerCase()}` : ' · Area unit not recorded'}`
        : 'Price not recorded';
type ClientShareProperty = Partial<
  Pick<LedgerItem, 'propertyType' | 'houseNo' | 'sector' | 'bhk' | 'floor' | 'monthlyRent' | 'rent' | 'totalSalePrice' | 'assignedTo'>
> & { purpose?: string | null; furnishing?: string | null; roomKind?: string | null };

/** Client messages use structured fields so private inventory labels never become the heading. */
export function clientPropertyShare(item: ClientShareProperty, _contact?: string): string {
  const propertyType = item.propertyType && INVENTORY_PROPERTY_TYPES.includes(item.propertyType) ? readableValue(item.propertyType) : 'Property';
  const roomKind = item.roomKind && /^(BHK|RK|STUDIO)$/i.test(item.roomKind) ? item.roomKind.toUpperCase() : '';
  const rooms = roomKind === 'STUDIO' ? 'Studio' : item.bhk ? `${item.bhk} ${roomKind || 'rooms'}` : roomKind === 'RK' ? 'RK' : '';
  const sector = item.sector?.trim() ?? '';
  // Imported locality values occasionally contain a full property address.
  const numberedSector = sector.match(/^(?:sector|sec\.?)[\s-]*(\d{1,3}[a-z]?)(?=$|[\s,/-])/i);
  const house = item.houseNo?.trim().toLowerCase();
  const locality = numberedSector
    ? `Sector ${numberedSector[1].toUpperCase()}`
    : /^[\p{L}\p{M}\d][\p{L}\p{M}\d .'-]{0,80}$/u.test(sector) &&
        !/\b(?:house|plot|unit|flat|door)\s+(?:no\.?\s*)?\d/i.test(sector) &&
        (!house || !(' ' + sector.toLowerCase().replace(/[\s-]+/g, ' ') + ' ').includes(' ' + house.replace(/[\s-]+/g, ' ') + ' '))
      ? sector
      : '';
  const aliases: Record<string, string> = { FF: '1', SF: '2', TF: 'TOP', GF: '0', FIRST: '1', SECOND: '2', THIRD: '3', GROUND: '0' };
  const rawFloor = item.floor?.trim() ?? '';
  const numbered = rawFloor.match(/^(\d{1,2})(?:st|nd|rd|th)?(?:[ _]floor)?$/i);
  const floorValue = aliases[rawFloor.toUpperCase()] ?? numbered?.[1] ?? rawFloor;
  const floor = /^(?:\d{1,2}(?:(?:st|nd|rd|th)?[ _]floor)?|GF|TF|TOP|GROUND(?:[ _]FLOOR)?|TOP[ _]FLOOR|BASEMENT|LOWER[ _]GROUND|UPPER[ _]GROUND|STILT)$/i.test(
    floorValue,
  )
    ? floorLabel(/^(?:GF|TF|TOP)$/i.test(floorValue) ? floorValue.toUpperCase() : floorValue)
    : '';
  const price = item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : item.purpose === 'SALE' ? item.totalSalePrice : null;
  return [
    locality && `📍 Location: ${locality}`,
    rooms && `🛏️ Config: ${rooms} · ${propertyType}`,
    item.furnishing && /^(UNFURNISHED|SEMI_FURNISHED|FULLY_FURNISHED)$/.test(item.furnishing) && `🛋️ Furnishing: ${readableValue(item.furnishing)}`,
    `🏢 Floor: ${floor || 'Not recorded'}`,
    price != null ? `💰 Price: ${formatINR(price)}${item.purpose === 'RENT' ? '/month' : ''}` : '💰 Price not recorded',
  ]
    .filter(Boolean)
    .join('\n');
}

export type InventoryFact = { label: string; value: string };
export function inventoryFactGroups(item: LedgerItem) {
  const groups: Record<string, InventoryFact[]> = {};
  const add = (group: string, label: string, value: unknown) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return;
    (groups[group] ??= []).push({ label, value: String(value) });
  };
  add('Location & configuration', 'Locality', item.sector);
  add('Location & configuration', 'Address', item.address);
  add('Location & configuration', 'House / plot no.', item.houseNo);
  add('Location & configuration', 'Unit', item.unitLabel);
  add('Location & configuration', 'Property type', item.propertyType && readableValue(item.propertyType));
  add('Location & configuration', 'Category', item.category && readableValue(item.category));
  add('Location & configuration', 'Floor', item.floor != null ? floorLabel(item.floor) : null);
  add('Location & configuration', 'Rooms', item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : item.roomKind === 'STUDIO' ? 'Studio' : null);
  add('Location & configuration', 'Furnishing', item.furnishing && readableValue(item.furnishing));
  add('Location & configuration', 'Area', item.area != null ? `${item.area} ${item.areaUnit?.replace(/_/g, ' ').toLowerCase() ?? ''}` : null);
  if (item.availability === 'AVAILABLE') {
    const since = inventoryDateSchema.safeParse(item.availableSince);
    add('Price & terms', 'Available since', since.success ? inventoryDateLabel(since.data) : 'Not recorded');
  }
  add('Price & terms', 'Transaction', item.purpose && readableValue(item.purpose));
  add('Price & terms', 'Monthly rent', item.monthlyRent != null ? formatINR(item.monthlyRent) : null);
  add('Price & terms', 'Sale price', item.totalSalePrice != null ? formatINR(item.totalSalePrice) : null);
  add(
    'Price & terms',
    'Rate per area',
    item.ratePerArea != null
      ? `${formatINR(item.ratePerArea)}${item.rateAreaUnit ? `/${item.rateAreaUnit.replace(/_/g, ' ').toLowerCase()}` : ' · Area unit not recorded'}`
      : null,
  );
  add('Price & terms', 'Security deposit', item.securityDeposit != null ? formatINR(item.securityDeposit) : null);
  add('Price & terms', 'Brokerage', item.brokerage);
  add('Price & terms', 'Tenant preference', item.tenantPreference);
  for (const field of PROPERTY_FIELDS) {
    const value = item.details?.[field.key];
    if (value != null) add(field.group, field.label, readableValue(value));
  }
  return Object.entries(groups).map(([title, facts]) => ({ title, facts }));
}

export function inventoryAvailabilityDate(item: Pick<LedgerItem, 'availableSince' | 'details'>): string | null {
  for (const value of [item.details?.availableFrom, item.details?.possessionDate, item.availableSince]) {
    const parsed = inventoryDateSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** Numbered addresses are only available when the API grants full detail access. */
export function inventoryCardTitle(item: LedgerItem) {
  let title = inventoryTitle(item);
  if (item.houseNo?.trim()) {
    title = [`House ${item.houseNo.trim()}`, item.unitLabel?.trim()].filter(Boolean).join(' · ');
  } else if (isPendingSurvey(item) && !item.address) {
    if (item.photoUrls?.length) title = 'Survey photo to review';
    else if (item.contacts?.some((contact) => contact.phone)) title = 'Survey phone to call';
  }
  return [title, item.sector?.trim()].filter(Boolean).join(' · ');
}

export function inventoryConfigurationLabel({ roomKind, bhk }: Pick<LedgerItem, 'roomKind' | 'bhk'>) {
  if (roomKind === 'RK') return 'RK';
  if (roomKind === 'STUDIO') return 'Studio';
  return bhk ? `${bhk} BHK` : (roomKind ?? null);
}

export function inventoryAvailabilityLabel(item: Pick<LedgerItem, 'availableSince' | 'details'>) {
  const explicit = inventoryDateSchema.safeParse(item.details?.availableFrom);
  const possession = inventoryDateSchema.safeParse(item.details?.possessionDate);
  const date = explicit.success ? explicit.data : possession.success ? possession.data : null;
  if (date) return `Available from: ${inventoryDateLabel(date)}`;
  const since = inventoryDateSchema.safeParse(item.availableSince);
  if (since.success && since.data > inventoryDate()) return `Available from: ${inventoryDateLabel(since.data)}`;
  return 'Ready to move';
}

export function inventoryPossessionLabel(item: Pick<LedgerItem, 'availableSince' | 'details'>) {
  const possession = inventoryDateSchema.safeParse(item.details?.possessionDate);
  if (possession.success) return `Possession date: ${inventoryDateLabel(possession.data)}`;
  const available = inventoryAvailabilityLabel(item);
  return available === 'Ready to move' ? 'Possession date not recorded' : available;
}

export function isPendingSurvey(item: Pick<LedgerItem, 'sourceType' | 'status'>) {
  return item.sourceType === 'SURVEY' && item.status === 'DRAFT';
}

export function ownerChangeSummary(changes: OwnerEditableProperty) {
  const labels: Record<string, string> = {
    houseNo: 'House / plot no.',
    sector: 'Sector / locality',
    bhk: 'Room count',
    roomKind: 'Configuration',
    monthlyRent: 'Monthly rent (₹)',
    totalSalePrice: 'Sale price (₹)',
    photoUrls: 'Property photos',
    videoUrls: 'Property videos',
    ...Object.fromEntries(PROPERTY_FIELDS.map(({ key, label }) => [key, label])),
  };
  const values = Object.entries(changes).flatMap<[string, unknown]>(([key, value]) =>
    key === 'details' && value && typeof value === 'object' ? Object.entries(value) : [[key, value]],
  );
  return values.map(([key, value]) => {
    const label = labels[key] ?? key.replace(/[A-Z]/g, (letter) => ' ' + letter.toLowerCase()).replace(/^./, (letter) => letter.toUpperCase());
    const display = Array.isArray(value)
      ? key === 'photoUrls' || key === 'videoUrls'
        ? value.length + ' attached'
        : value.map((part) => readableValue(String(part))).join(', ')
      : typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : value == null || value === ''
          ? 'Cleared'
          : String(value);
    return { key, label, display: typeof value === 'string' && /^[A-Z][A-Z_]+$/.test(value) ? readableValue(value) : display };
  });
}
