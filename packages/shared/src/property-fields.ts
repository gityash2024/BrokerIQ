import { z } from 'zod';
import { PROPERTY_TYPES } from './enums';
export const INVENTORY_PROPERTY_TYPES = [...PROPERTY_TYPES, 'FARMHOUSE', 'FACTORY', 'BARE_SHELL_OFFICE', 'READY_OFFICE', 'OTHER'] as [string, ...string[]];
export type PropertyField = {
  key: string;
  label: string;
  group: string;
  kind: 'select' | 'number' | 'text' | 'boolean' | 'multi';
  options?: string[];
  categories?: string[];
  min?: number;
  max?: number;
  integer?: boolean;
};
/** One contract feeds editing, extraction, import review and filters on web/native. Null means unknown, never no. */
export const PROPERTY_FIELDS: PropertyField[] = [
  { key: 'projectName', label: 'Project / society', group: 'Location', kind: 'text' },
  { key: 'builderName', label: 'Builder / developer', group: 'Location', kind: 'text' },
  { key: 'tower', label: 'Tower / block', group: 'Location', kind: 'text' },
  { key: 'purchaseType', label: 'New booking / resale', group: 'Transaction', kind: 'select', options: ['NEW_BOOKING', 'RESALE'] },
  { key: 'tenureType', label: 'Rent / lease / PG', group: 'Transaction', kind: 'select', options: ['RENT', 'LEASE', 'PG', 'CO_LIVING'] },
  { key: 'investmentType', label: 'Investment type', group: 'Transaction', kind: 'select', options: ['PRE_LEASED', 'PRE_RENTED', 'VACANT', 'SELF_USE'] },
  { key: 'possessionStatus', label: 'Possession status', group: 'Possession', kind: 'select', options: ['READY_TO_MOVE', 'UNDER_CONSTRUCTION', 'NEW_LAUNCH'] },
  { key: 'possessionDate', label: 'Possession date (YYYY-MM-DD)', group: 'Possession', kind: 'text' },
  { key: 'propertyAge', label: 'Property age (years)', group: 'Possession', kind: 'number', min: 0, max: 200 },
  { key: 'areaBasis', label: 'Area measurement', group: 'Size & rooms', kind: 'select', options: ['CARPET', 'BUILT_UP', 'SUPER_BUILT_UP', 'PLOT'] },
  { key: 'bathrooms', label: 'Bathrooms', group: 'Size & rooms', kind: 'number', min: 0, max: 100 },
  { key: 'additionalRooms', label: 'Additional rooms (use unspecified)', group: 'Size & rooms', kind: 'number', min: 0, max: 20, integer: true },
  { key: 'balconies', label: 'Balconies', group: 'Size & rooms', kind: 'number', min: 0, max: 100 },
  { key: 'totalFloors', label: 'Total floors', group: 'Size & rooms', kind: 'number', min: 0, max: 300 },
  {
    key: 'facing',
    label: 'Facing',
    group: 'Features',
    kind: 'select',
    options: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST'],
  },
  { key: 'parkingSpaces', label: 'Parking spaces', group: 'Features', kind: 'number', min: 0, max: 500 },
  { key: 'parkingType', label: 'Parking type', group: 'Features', kind: 'select', options: ['COVERED', 'OPEN', 'BASEMENT', 'STILT', 'NONE'] },
  { key: 'gatedSociety', label: 'Gated society', group: 'Features', kind: 'boolean' },
  { key: 'cornerProperty', label: 'Corner property', group: 'Features', kind: 'boolean' },
  { key: 'roadWidth', label: 'Road width (feet)', group: 'Features', kind: 'number', min: 0, max: 1000 },
  {
    key: 'ownershipType',
    label: 'Ownership',
    group: 'Legal & source',
    kind: 'select',
    options: ['FREEHOLD', 'LEASEHOLD', 'CO_OPERATIVE', 'POWER_OF_ATTORNEY'],
  },
  { key: 'reraNumber', label: 'RERA number', group: 'Legal & source', kind: 'text' },
  { key: 'postedBy', label: 'Posted by', group: 'Legal & source', kind: 'select', options: ['OWNER', 'BUILDER', 'DEALER', 'FEATURED_DEALER'] },
  {
    key: 'officeCondition',
    label: 'Office condition',
    group: 'Commercial',
    kind: 'select',
    options: ['READY_TO_MOVE', 'BARE_SHELL', 'WARM_SHELL', 'FURNISHED'],
    categories: ['COMMERCIAL'],
  },
  { key: 'workstations', label: 'Workstations', group: 'Commercial', kind: 'number', min: 0, max: 100000, categories: ['COMMERCIAL'] },
  { key: 'cabins', label: 'Cabins', group: 'Commercial', kind: 'number', min: 0, max: 1000, categories: ['COMMERCIAL'] },
  { key: 'meetingRooms', label: 'Meeting rooms', group: 'Commercial', kind: 'number', min: 0, max: 1000, categories: ['COMMERCIAL'] },
  { key: 'washroomType', label: 'Washroom', group: 'Commercial', kind: 'select', options: ['PRIVATE', 'SHARED', 'NONE'], categories: ['COMMERCIAL'] },
  { key: 'pantry', label: 'Pantry', group: 'Commercial', kind: 'select', options: ['WET', 'DRY', 'SHARED', 'NONE'], categories: ['COMMERCIAL'] },
  { key: 'powerLoad', label: 'Power load (kW)', group: 'Commercial', kind: 'number', min: 0, max: 100000, categories: ['COMMERCIAL', 'LAND'] },
  { key: 'ceilingHeight', label: 'Ceiling height (feet)', group: 'Commercial', kind: 'number', min: 0, max: 500, categories: ['COMMERCIAL'] },
  {
    key: 'landUse',
    label: 'Land use / zone',
    group: 'Land & plots',
    kind: 'select',
    options: ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL', 'MIXED', 'FREE_ZONE', 'R_ZONE'],
    categories: ['LAND', 'PLOT'],
  },
  { key: 'plotLength', label: 'Plot length (feet)', group: 'Land & plots', kind: 'number', min: 0, max: 100000, categories: ['LAND', 'PLOT'] },
  { key: 'plotWidth', label: 'Plot width (feet)', group: 'Land & plots', kind: 'number', min: 0, max: 100000, categories: ['LAND', 'PLOT'] },
  { key: 'openSides', label: 'Open sides', group: 'Land & plots', kind: 'number', min: 0, max: 4, categories: ['LAND', 'PLOT'] },
  { key: 'boundaryWall', label: 'Boundary wall', group: 'Land & plots', kind: 'boolean', categories: ['LAND', 'PLOT'] },
  { key: 'tenantType', label: 'Suitable tenants', group: 'Rental', kind: 'select', options: ['FAMILY', 'BACHELORS', 'GIRLS', 'BOYS', 'COMPANY', 'ANY'] },
  { key: 'availableFrom', label: 'Available from (YYYY-MM-DD)', group: 'Rental', kind: 'text' },
  { key: 'petFriendly', label: 'Pets allowed', group: 'Rental', kind: 'boolean' },
  { key: 'maintenanceMonthly', label: 'Monthly maintenance ₹', group: 'Rental', kind: 'number', min: 0, max: 10000000 },
  { key: 'securityMonths', label: 'Security (months)', group: 'Rental', kind: 'number', min: 0, max: 120 },
  { key: 'advanceMonths', label: 'Advance rent (months)', group: 'Rental', kind: 'number', min: 0, max: 120 },
  { key: 'lockInMonths', label: 'Lock-in (months)', group: 'Rental', kind: 'number', min: 0, max: 600 },
];
const shape: Record<string, z.ZodType> = {};
for (const field of PROPERTY_FIELDS) {
  let schema: z.ZodType =
    field.kind === 'number'
      ? z
          .number()
          .finite()
          .refine((value) => !field.integer || Number.isInteger(value), 'Enter a whole number')
          .min(field.min ?? 0)
          .max(field.max ?? 1e13)
      : field.kind === 'boolean'
        ? z.boolean()
        : field.options
          ? z.enum(field.options as [string, ...string[]])
          : z.string().trim().max(200);
  if (['possessionDate', 'availableFrom'].includes(field.key)) schema = z.string().date();
  shape[field.key] = schema.nullable().optional();
}
export const propertyDetailsSchema = z.object(shape).strict();
export const PROPERTY_AMENITIES = [
  'LIFT',
  'POWER_BACKUP',
  'WATER_SUPPLY',
  'SECURITY',
  'CCTV',
  'CLUBHOUSE',
  'GYM',
  'SWIMMING_POOL',
  'PARK',
  'CHILDREN_PLAY_AREA',
  'VISITOR_PARKING',
  'FIRE_SAFETY',
  'AIR_CONDITIONING',
  'INTERNET',
  'GAS_PIPELINE',
  'WHEELCHAIR_ACCESS',
  'SERVICE_LIFT',
  'LOADING_DOCK',
  'SEWAGE',
  'RAINWATER_HARVESTING',
  'EV_CHARGING',
  'INTERCOM',
  'TERRACE',
  'SERVANT_ROOM',
  'STORE_ROOM',
];
export const INVENTORY_SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'price:asc', label: 'Price: low to high' },
  { value: 'price:desc', label: 'Price: high to low' },
  { value: 'ratePerSqft:asc', label: 'Price / sq.ft.: low to high' },
  { value: 'ratePerSqft:desc', label: 'Price / sq.ft.: high to low' },
  { value: 'sector:asc', label: 'Locality A–Z' },
];
export function visiblePropertyFields(category?: string | null) {
  return PROPERTY_FIELDS.filter((f) => !category || !f.categories || f.categories.includes(category));
}

export function preparePropertyDetails(value: Record<string, any> = {}) {
  const result = { ...value };
  for (const f of PROPERTY_FIELDS) {
    if (result[f.key] === undefined) delete result[f.key];
    else if (result[f.key] === '') result[f.key] = null;
    else if (f.kind === 'number' && result[f.key] != null) result[f.key] = Number(result[f.key]);
  }
  return result;
}

export const INVENTORY_FILTER_LABELS: Record<string, string> = {
  sector: 'Sector / locality',
  purpose: 'Purpose',
  propertyType: 'Property type',
  category: 'Property category',
  bhk: 'Rooms',
  roomKinds: 'Room kind',
  furnishing: 'Furnishing',
  availability: 'Availability',
  sourceType: 'Source',
  areaUnit: 'Area unit',
  minBudget: 'Minimum budget ₹',
  maxBudget: 'Maximum budget ₹',
  minArea: 'Minimum area',
  maxArea: 'Maximum area',
  minRate: 'Minimum ₹ / sq.ft.',
  maxRate: 'Maximum ₹ / sq.ft.',
};
