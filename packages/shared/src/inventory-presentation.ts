import type { LedgerItem } from './inventory';
import { PROPERTY_FIELDS } from './property-fields';
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
