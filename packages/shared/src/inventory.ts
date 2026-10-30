import { z } from 'zod';
import { INVENTORY_PROPERTY_TYPES, propertyDetailsSchema, preparePropertyDetails } from './property-fields';
import { normalizeIndianPhone } from './utils';

const text = z.string().trim().max(200).nullable().optional();
const money = z.number().finite().nonnegative().max(1e13).nullable().optional();
export const areaUnitSchema = z.enum(['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE']);
export const availabilitySchema = z.enum(['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE']);
export const sourceTypeSchema = z.enum(['MANUAL', 'PDF_REGISTER', 'WHATSAPP', 'CHAT_EXPORT', 'IMAGE', 'TEXT', 'PORTAL']);
export const inventoryContactSchema = z.object({
  name: text,
  phone: z
    .string()
    .trim()
    .max(25)
    .nullable()
    .optional()
    .superRefine((s, ctx) => {
      if (s && !normalizeIndianPhone(s)) ctx.addIssue({ code: 'custom', message: 'Enter a valid Indian phone number' });
    })
    .transform((s) => (s ? normalizeIndianPhone(s) : null)),
  role: z.enum(['OWNER', 'BROKER', 'UNKNOWN']).default('UNKNOWN'),
  note: z.string().max(2000).nullable().optional(),
});
export const inventoryInputSchema = z
  .object({
    clientMutationId: z.string().max(100).optional(),
    details: propertyDetailsSchema.optional(),
    photoUrls: z
      .array(
        z
          .string()
          .url()
          .max(2000)
          .refine((s) => /^https?:\/\//.test(s), 'Use HTTP or HTTPS media URLs'),
      )
      .max(50)
      .optional(),
    videoUrls: z
      .array(
        z
          .string()
          .url()
          .max(2000)
          .refine((s) => /^https?:\/\//.test(s), 'Use HTTP or HTTPS media URLs'),
      )
      .max(10)
      .optional(),
    sector: text,
    houseNo: text,
    address: z.string().max(1000).nullable().optional(),
    unitLabel: text,
    ownerName: text,
    ownerPhone: text,
    propertyType: z.enum(INVENTORY_PROPERTY_TYPES).nullable().optional(),
    category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND']).nullable().optional(),
    purpose: z.enum(['RENT', 'SALE']).nullable().optional(),
    bhk: z.number().int().min(1).max(100).nullable().optional(),
    roomKind: z.enum(['BHK', 'RK', 'STUDIO']).nullable().optional(),
    floor: text,
    furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).nullable().optional(),
    area: money,
    areaUnit: areaUnitSchema.nullable().optional(),
    rent: money,
    monthlyRent: money,
    totalSalePrice: money,
    ratePerArea: money,
    rateAreaUnit: areaUnitSchema.nullable().optional(),
    securityDeposit: money,
    brokerage: text,
    tenantPreference: text,
    amenities: z.array(z.string().max(120)).max(100).optional(),
    notes: z.string().max(20000).nullable().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'RENTED']).optional(),
    availability: availabilitySchema.optional(),
    verificationStatus: z.enum(['NEEDS_REVIEW', 'VERIFIED']).optional(),
    contacts: z.array(inventoryContactSchema).max(30).optional(),
    date: z.string().datetime().optional(),
    pageNo: z.number().int().min(1).max(10000).nullable().optional(),
    organizationId: z.string().max(100).optional(),
    assignedToId: z.string().max(100).nullable().optional(),
    expectedRevision: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rent != null && data.monthlyRent != null && data.rent !== data.monthlyRent)
      ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'Rent values must agree' });
    if (data.purpose === 'SALE' && (data.monthlyRent != null || data.rent != null))
      ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'Sale price belongs in totalSalePrice, not monthlyRent' });
    if (data.area != null && !data.areaUnit) ctx.addIssue({ code: 'custom', path: ['areaUnit'], message: 'Area unit required' });
    if (data.ratePerArea != null && !data.rateAreaUnit) ctx.addIssue({ code: 'custom', path: ['rateAreaUnit'], message: 'Rate unit required' });
  });
export type InventoryInput = z.infer<typeof inventoryInputSchema>;
export const inventoryFilterSchema = z.object({
  detailFilters: z.string().max(12000).optional(),
  amenities: z.string().max(2000).optional(),
  hasPhotos: z.enum(['true', 'false']).optional(),
  hasVideos: z.enum(['true', 'false']).optional(),
  verificationStatus: z.enum(['VERIFIED', 'NEEDS_REVIEW']).optional(),
  localities: z.string().max(4000).optional(),
  propertyTypes: z.string().max(2000).optional(),
  floor: z.string().max(200).optional(),
  roomKinds: z.string().max(100).optional(),
  minRate: z.coerce.number().nonnegative().optional(),
  maxRate: z.coerce.number().nonnegative().optional(),
  sort: z.string().max(100).optional(),

  search: z.string().max(200).optional(),
  sector: z.string().max(100).optional(),
  houseNo: z.string().max(100).optional(),
  bhk: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'RENTED']).optional(),
  purpose: z.enum(['RENT', 'SALE']).optional(),
  propertyType: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  furnishing: z.string().max(80).optional(),
  roomKind: z.string().max(20).optional(),
  availability: availabilitySchema.optional(),
  sourceType: sourceTypeSchema.optional(),
  assignedToId: z.string().max(100).optional(),
  onlyMine: z.enum(['true', 'false']).optional(),
  minBudget: z.coerce.number().nonnegative().optional(),
  maxBudget: z.coerce.number().nonnegative().optional(),
  minArea: z.coerce.number().nonnegative().optional(),
  maxArea: z.coerce.number().nonnegative().optional(),
  areaUnit: areaUnitSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  organizationId: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  sortBy: z.enum(['createdAt', 'updatedAt', 'sector', 'houseNo', 'monthlyRent', 'totalSalePrice', 'rent', 'date', 'availability']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export const brokerRequirementSchema = z
  .object({
    clientMutationId: z.string().max(100).optional(),
    leadId: z.string().max(100).nullable().optional(),
    contactName: text,
    contactPhone: text,
    purpose: z.enum(['RENT', 'SALE']).nullable().optional(),
    category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND']).nullable().optional(),
    propertyTypes: z.array(z.string().max(80)).max(30).default([]),
    localityNames: z.array(z.string().max(100)).max(30).default([]),
    minBudget: money,
    maxBudget: money,
    bedrooms: z.array(z.number().int().min(1).max(100)).max(100).default([]),
    roomKind: z.enum(['BHK', 'RK', 'STUDIO']).nullable().optional(),
    furnishing: text,
    minArea: money,
    maxArea: money,
    areaUnit: areaUnitSchema.nullable().optional(),
    notes: z.string().max(20000).nullable().optional(),
    status: z.enum(['OPEN', 'FULFILLED', 'CLOSED']).default('OPEN'),
  })
  .superRefine((data, ctx) => {
    if (data.minBudget != null && data.maxBudget != null && data.minBudget > data.maxBudget)
      ctx.addIssue({ code: 'custom', path: ['maxBudget'], message: 'Maximum must be at least minimum' });
    if ((data.minArea != null || data.maxArea != null) && !data.areaUnit) ctx.addIssue({ code: 'custom', path: ['areaUnit'], message: 'Area unit required' });
  });
export type BrokerRequirementInput = z.infer<typeof brokerRequirementSchema>;
export interface LedgerItem extends Omit<InventoryInput, 'contacts'> {
  localityId?: string | null;
  publishedListingId?: string | null;
  isPublished?: boolean;
  id: string;
  organizationId: string;
  createdById?: string | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    role: string;
    avatarUrl?: string | null;
  } | null;
  createdBy?: {
    id: string;
    name: string;
  } | null;
  matchingLeadsCount?: number;
  revision: number;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
  contacts: z.infer<typeof inventoryContactSchema>[];
  sourceEntry?: {
    id: string;
    rawText: string;
    pageNo?: number | null;
    bbox?: unknown;
    batch?: { id: string; fileName?: string | null; sourceType: string };
  } | null;
}
export interface PagedLedger {
  items: LedgerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
const FACTORS = { SQ_FT: 1, SQ_YD: 9, SQ_M: 10.7639104167, ACRE: 43560, HECTARE: 107639.104167 };
export function areaSqft(value: number, unit: string) {
  return unit in FACTORS ? value * FACTORS[unit as keyof typeof FACTORS] : null;
}
export const localityKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/gurugram/g, 'gurgaon')
    .replace(/lok\s*i\b/g, 'lok 1')
    .replace(/[^a-z0-9]/g, '');

/** Hard filters are explicit facts. Unknown availability is shown separately, never as confirmed. */
export function ledgerMatch(requirement: BrokerRequirementInput, item: InventoryInput) {
  const reasons: string[] = [];
  if (!requirement.purpose || !item.purpose || requirement.purpose !== item.purpose) return null;
  reasons.push(requirement.purpose === 'RENT' ? 'Monthly rent' : 'Sale');
  if (requirement.category && item.category !== requirement.category) return null;
  if (requirement.propertyTypes.length && (!item.propertyType || !requirement.propertyTypes.includes(item.propertyType))) return null;
  if (requirement.localityNames.length && !requirement.localityNames.some((l) => localityKey(l) === localityKey(item.sector ?? ''))) return null;
  if (requirement.localityNames.length) reasons.push('Preferred locality');
  if (requirement.bedrooms.length && (!item.bhk || !requirement.bedrooms.includes(item.bhk))) return null;
  if (requirement.roomKind && item.roomKind !== requirement.roomKind) return null;
  if (requirement.furnishing && item.furnishing !== requirement.furnishing) return null;
  const price = item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : item.totalSalePrice;
  if (requirement.minBudget != null || requirement.maxBudget != null) {
    if (price == null || (requirement.minBudget != null && price < requirement.minBudget) || (requirement.maxBudget != null && price > requirement.maxBudget))
      return null;
    reasons.push('Within budget');
  }
  if (requirement.minArea != null || requirement.maxArea != null) {
    if (item.area == null || !item.areaUnit || !requirement.areaUnit) return null;
    const size = areaSqft(item.area, item.areaUnit);
    const min = requirement.minArea == null ? null : areaSqft(requirement.minArea, requirement.areaUnit);
    const max = requirement.maxArea == null ? null : areaSqft(requirement.maxArea, requirement.areaUnit);
    if (size == null || (min != null && size < min) || (max != null && size > max)) return null;
    reasons.push('Area matches');
  }
  if (!['AVAILABLE', 'UNKNOWN'].includes(item.availability ?? 'UNKNOWN')) return null;
  return { reasons, availability: item.availability ?? 'UNKNOWN' };
}

export function inventoryDerived(input: Record<string, any>) {
  const price = input.purpose === 'RENT' ? (input.monthlyRent ?? input.rent) : input.purpose === 'SALE' ? input.totalSalePrice : null;
  const size = input.area != null && input.areaUnit ? areaSqft(Number(input.area), input.areaUnit) : null;
  const rate =
    input.ratePerArea != null && input.rateAreaUnit
      ? Number(input.ratePerArea) / areaSqft(1, input.rateAreaUnit)!
      : size && price != null
        ? Number(price) / size
        : null;
  return { price: price == null ? null : Number(price), ratePerSqft: rate };
}

/**
 * Legacy source-ledger rows can hold database nulls in optional write fields.
 * Editors omit them before strict validation; this does not broaden the API.
 */
export function prepareInventoryEditorInput(value: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key of Object.keys(inventoryInputSchema.shape)) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  // Database identity metadata is not a user-editable value. Imported rows have
  // clientMutationId=null; copying that null into a write caused every save to fail.
  for (const key of ['clientMutationId', 'date', 'organizationId', 'expectedRevision', 'status', 'availability', 'verificationStatus'])
    if (result[key] == null) delete result[key];
  for (const key of ['bhk', 'area', 'monthlyRent', 'rent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'])
    if (key in result) result[key] = result[key] === '' || result[key] == null ? null : Number(result[key]);
  if ('monthlyRent' in result) delete result.rent; // monthlyRent is the canonical editor field.
  if (result.details != null) result.details = preparePropertyDetails(result.details);
  else delete result.details;
  if (Array.isArray(result.contacts)) result.contacts = result.contacts.map((contact) => ({
    name: contact?.name ?? null,
    phone: contact?.phone ?? null,
    role: contact?.role ?? 'UNKNOWN',
    note: contact?.note ?? null,
  }));
  return result;
}

/** Build a sparse update: omitted values are untouched; explicit null/[] clears. */
export function inventoryEditorPatch(value: Record<string, any>, initial: Record<string, any>) {
  const next = prepareInventoryEditorInput(value);
  const previous = prepareInventoryEditorInput(initial);
  const equal = (a: any, b: any): boolean => {
    if (a == null && b == null) return true;
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.every((key) => equal(a[key], b[key]));
  };
  const patch: Record<string, any> = {};
  for (const [key, current] of Object.entries(next)) {
    if (['clientMutationId', 'expectedRevision', 'organizationId'].includes(key)) continue;
    if (key === 'details') {
      const changed = Object.fromEntries(Object.entries(current).filter(([field, entry]) => !equal(entry, previous.details?.[field])));
      if (Object.keys(changed).length) patch.details = changed;
    } else if (!equal(current, previous[key])) patch[key] = current;
  }
  const revision = initial.expectedRevision ?? initial.revision;
  // The shared contract validates coupled area fields together.
  if (patch.area != null && !('areaUnit' in patch)) patch.areaUnit = next.areaUnit ?? previous.areaUnit;
  if (patch.ratePerArea != null && !('rateAreaUnit' in patch)) patch.rateAreaUnit = next.rateAreaUnit ?? previous.rateAreaUnit;
  if (revision != null) patch.expectedRevision = revision;
  return patch;
}
