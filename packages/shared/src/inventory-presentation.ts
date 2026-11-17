import { inventoryDateLabel, inventoryDateSchema } from './inventory-folders';
import type { LedgerItem } from './inventory';
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
  Pick<
    LedgerItem,
    | 'propertyType'
    | 'houseNo'
    | 'sector'
    | 'bhk'
    | 'floor'
    | 'monthlyRent'
    | 'rent'
    | 'totalSalePrice'
    | 'assignedTo'
    | 'availability'
  >
> & { purpose?: string | null; furnishing?: string | null; roomKind?: string | null };

/** Client messages use structured fields so private inventory labels never become the heading. */
export function clientPropertyShare(item: ClientShareProperty, contact?: string): string {
  const propertyType = item.propertyType && INVENTORY_PROPERTY_TYPES.includes(item.propertyType) ? readableValue(item.propertyType) : 'Property';
  const roomKind = item.roomKind && /^(BHK|RK|STUDIO)$/i.test(item.roomKind) ? item.roomKind.toUpperCase() : '';
  const rooms = roomKind === 'STUDIO' ? 'Studio' : item.bhk ? `${item.bhk} ${roomKind || 'rooms'}` : '';
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
  const floorValue = item.floor?.trim() ?? '';
  const floor = /^(?:\d{1,2}(?:(?:st|nd|rd|th)?[ _]floor)?|GF|TF|TOP|GROUND(?:[ _]FLOOR)?|TOP[ _]FLOOR|BASEMENT|LOWER[ _]GROUND|UPPER[ _]GROUND|STILT)$/i.test(
    floorValue,
  )
    ? floorLabel(/^(?:GF|TF|TOP)$/i.test(floorValue) ? floorValue.toUpperCase() : floorValue)
    : '';
  const price = item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : item.purpose === 'SALE' ? item.totalSalePrice : null;
  const managedBy = contact || item.assignedTo?.name;
  return [
    `🏠 ${propertyType}`,
    locality && `📍 Location: ${locality}`,
    (item.purpose === 'RENT' || item.purpose === 'SALE') && `🏷️ Transaction: ${readableValue(item.purpose)}`,
    rooms && `🛏️ Config: ${rooms}`,
    floor && `🏢 Floor: ${floor}`,
    item.furnishing && /^(UNFURNISHED|SEMI_FURNISHED|FULLY_FURNISHED)$/.test(item.furnishing) && `🛋️ Furnishing: ${readableValue(item.furnishing)}`,
    price != null ? `💰 Price: ${formatINR(price)}${item.purpose === 'RENT' ? '/month' : ''}` : '💰 Price not recorded',
    managedBy && `👤 Managed by: ${managedBy}`,
    item.availability === 'AVAILABLE' ? 'Availability recorded as available · reconfirm before visit' : '⚠️ Availability to be confirmed',
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
