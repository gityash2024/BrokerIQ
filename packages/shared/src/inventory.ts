import { z } from 'zod';
import { INVENTORY_PROPERTY_TYPES, propertyDetailsSchema, preparePropertyDetails } from './property-fields';
import { normalizeIndianPhone } from './utils';
import { directionsLinkSchema, normalizeInventoryDirections } from './map-directions';
import { inventoryDateSchema, inventoryFolderModeSchema, inventoryMonthSchema } from './inventory-folders';

const text = z.string().trim().max(200).nullable().optional();
const money = z.number().finite().nonnegative().max(1e13).nullable().optional();
export const areaUnitSchema = z.enum(['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE']);
export const availabilitySchema = z.enum(['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE']);
export const sourceTypeSchema = z.enum(['MANUAL', 'PDF_REGISTER', 'WHATSAPP', 'CHAT_EXPORT', 'IMAGE', 'TEXT', 'PORTAL', 'SURVEY']);
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
const inventoryFieldsSchema = z.object({
  clientMutationId: z.string().max(100).optional(),
  survey: z.literal(true).optional(),
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
  directionsUrl: directionsLinkSchema.nullable().optional(),
  directoryMonth: inventoryMonthSchema.optional(),
  availableSince: inventoryDateSchema.nullable().optional(),
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
});
export const inventoryInputSchema = inventoryFieldsSchema.superRefine((data, ctx) => {
  if (data.rent != null && data.monthlyRent != null && data.rent !== data.monthlyRent)
    ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'Rent values must agree' });
  if (data.purpose === 'SALE' && (data.monthlyRent != null || data.rent != null))
    ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'Sale price belongs in totalSalePrice, not monthlyRent' });
  if (data.area != null && !data.areaUnit) ctx.addIssue({ code: 'custom', path: ['areaUnit'], message: 'Area unit required' });
  if (data.ratePerArea != null && !data.rateAreaUnit) ctx.addIssue({ code: 'custom', path: ['rateAreaUnit'], message: 'Rate unit required' });
});
export type InventoryInput = z.infer<typeof inventoryInputSchema>;
export const surveyPhotoInputSchema = z.strictObject({
  clientMutationId: z.uuid(),
  sector: z.string().trim().min(1).max(200).optional(),
  photoUrl: inventoryInputSchema.shape.photoUrls.unwrap().element,
});
export type SurveyPhotoInput = z.infer<typeof surveyPhotoInputSchema>;
const surveyPhoneBase = surveyPhotoInputSchema.omit({ photoUrl: true }).extend({ directionsUrl: directionsLinkSchema.optional() });
const requiredSurveyPhone = z
  .string()
  .trim()
  .min(1)
  .max(25)
  .refine((value) => !!normalizeIndianPhone(value), 'Enter a valid Indian phone number');
export const surveyPhoneInputSchema = z.union([
  surveyPhoneBase.extend({ phone: requiredSurveyPhone }),
  surveyPhoneBase.extend({
    contacts: z
      .array(
        inventoryContactSchema.extend({
          role: z.literal('OWNER').default('OWNER'),
          phone: requiredSurveyPhone.transform((value) => normalizeIndianPhone(value)!),
        }),
      )
      .min(1, 'Add at least one owner phone number')
      .max(30),
  }),
]);
export type SurveyPhoneInput = z.infer<typeof surveyPhoneInputSchema>;
const surveyPhoneUnitSchema = z.strictObject({
  configuration: z.enum(['1_RK', '1_BHK', '2_BHK', '3_BHK', '4_BHK', '5_BHK', '6_BHK', 'STUDIO']).optional(),
  furnishing: z.enum(['SEMI_FURNISHED', 'FULLY_FURNISHED']).optional(),
  floor: z.string().trim().max(80).optional(),
});
export const surveyUnitsInputSchema = surveyPhoneInputSchema.options[1].extend({
  houseNo: z.string().trim().min(1, 'Enter the house number').max(200),
  units: z
    .array(surveyPhoneUnitSchema)
    .min(1)
    .max(20)
    .superRefine((rows, ctx) => {
      if (rows.length < 2) return;
      const identities = new Set<string>();
      for (const [index, row] of rows.entries()) {
        const identity = (row.configuration ?? '') + ':' + (row.floor ?? '').trim().toLowerCase();
        if (!row.configuration || identities.has(identity)) {
          ctx.addIssue({ code: 'custom', path: [index], message: 'Choose a configuration for each unit and record the floor for repeated configurations.' });
        }
        identities.add(identity);
      }
    }),
});
export type SurveyUnitsInput = z.infer<typeof surveyUnitsInputSchema>;
export const surveyConfigurationChoices = surveyPhoneUnitSchema.shape.configuration.unwrap().options;
export const surveyFurnishingChoices = surveyPhoneUnitSchema.shape.furnishing.unwrap().options;
export const surveyCallInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});
export type SurveyCallInput = z.infer<typeof surveyCallInputSchema>;

export function lastSurveyNoAnswer(notes?: string | null): string | undefined {
  return notes
    ?.split('\n')
    .reverse()
    .find((line) => /^Survey call: No answer - \d{4}-\d{2}-\d{2}/.test(line));
}
export const ownerEditablePropertySchema = z.strictObject(
  inventoryFieldsSchema.pick({
    sector: true,
    houseNo: true,
    unitLabel: true,
    address: true,
    directionsUrl: true,
    propertyType: true,
    category: true,
    purpose: true,
    bhk: true,
    roomKind: true,
    floor: true,
    furnishing: true,
    area: true,
    areaUnit: true,
    monthlyRent: true,
    totalSalePrice: true,
    ratePerArea: true,
    rateAreaUnit: true,
    securityDeposit: true,
    tenantPreference: true,
    amenities: true,
    details: true,
    photoUrls: true,
    videoUrls: true,
  }).shape,
);
export type OwnerEditableProperty = z.infer<typeof ownerEditablePropertySchema>;
export const ownerCreatePropertySchema = ownerEditablePropertySchema
  .extend({
    clientMutationId: z.uuid(),
    houseNo: z.string().trim().min(1, 'Enter a house / plot number').max(200),
  })
  .superRefine((input, ctx) => {
    if (!input.sector && !input.address?.trim()) ctx.addIssue({ code: 'custom', path: ['sector'], message: 'Enter the sector or address' });
  });
export const ownerEditPropertySchema = z.strictObject({
  clientMutationId: z.uuid(),
  expectedRevision: z.number().int().positive(),
  changes: ownerEditablePropertySchema.refine((changes) => Object.keys(changes).length > 0, 'Change at least one property detail'),
});
export type OwnerCreatePropertyInput = z.infer<typeof ownerCreatePropertySchema>;
export type OwnerEditPropertyInput = z.infer<typeof ownerEditPropertySchema>;

// Strip staff-only fields from the shared inventory editor before an owner submits it.
export function ownerPropertyValues(input: InventoryInput): OwnerEditableProperty {
  return Object.fromEntries(
    Object.keys(ownerEditablePropertySchema.shape)
      .filter((key) => input[key as keyof InventoryInput] !== undefined)
      .map((key) => [key, input[key as keyof InventoryInput]]),
  );
}
export const ownerReportInputSchema = z
  .strictObject({
    clientMutationId: z.uuid(),
    status: z.enum(['AVAILABLE', 'UPCOMING', 'RENTED', 'UNAVAILABLE']),
    availableFrom: inventoryDateSchema.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((input) => input.status !== 'UPCOMING' || Boolean(input.availableFrom), {
    path: ['availableFrom'],
    message: 'Choose the date the property becomes available',
  });
export type OwnerReportInput = z.infer<typeof ownerReportInputSchema>;
export type OwnerReport = Omit<OwnerReportInput, 'clientMutationId'> & {
  id: string;
  createdAt: string;
  owner?: { name: string };
};
export type OwnerPropertyChanges = {
  id: string;
  changes: OwnerEditableProperty;
  createdAt: string;
};
export type OwnerProperty = OwnerEditableProperty & {
  id: string;
  revision: number;
  availability: string;
  needsReview: boolean;
  ownerReport: OwnerReport | null;
  pendingChanges?: OwnerPropertyChanges | null;
  hasPendingChanges?: boolean;
};
export type InventoryOwnerInfo = {
  owner: { id: string; name: string; status: string } | null;
  report: OwnerReport | null;
  pendingChanges: OwnerPropertyChanges | null;
  detailsNeedReview: boolean;
  submissionPending?: boolean;
};

export type OwnerSubmissionQueue = {
  pendingCount: number;
  ownerCount: number;
  hasMore: boolean;
  items: {
    id: string;
    houseNo: string | null;
    sector: string | null;
    ownerName: string;
    availableFrom: string | null;
  }[];
};

export const inventoryFilterSchema = z.object({
  folderMode: inventoryFolderModeSchema.optional(),
  currentInventory: z.literal('true').optional(),
  folderYear: z
    .string()
    .regex(/^(?:19|20|21)\d{2}$/)
    .optional(),
  folderMonth: inventoryMonthSchema.optional(),
  folderRoom: z
    .string()
    .regex(/^(?:BHK:[1-9][0-9]{0,2}|RK|STUDIO|TYPE:[A-Z_]{1,80}|OTHER)$/)
    .optional(),
  folderFurnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED', 'OTHER']).optional(),
  folderSector: z.string().trim().max(200).optional(),
  archived: z.enum(['exclude', 'only', 'include']).optional(),
  review: z.enum(['publication']).optional(),
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
    organizationId: z.string().max(100).optional(),
    intent: z.enum(['DEMAND', 'OFFER', 'UNKNOWN']).default('DEMAND'),
    title: text,
    offerDetails: inventoryInputSchema.nullable().optional(),
    expectedRevision: z.number().int().positive().optional(),
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
    if (data.intent === 'OFFER' && !data.offerDetails)
      ctx.addIssue({ code: 'custom', path: ['offerDetails'], message: 'Confirm the offered property details' });
    if (data.intent !== 'OFFER' && data.offerDetails)
      ctx.addIssue({ code: 'custom', path: ['offerDetails'], message: 'Only offered property records can contain inventory details' });
    if (data.intent === 'UNKNOWN' && !data.title?.trim() && !data.notes?.trim())
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Preserve the unclear source or add a review note' });
    if (data.minBudget != null && data.maxBudget != null && data.minBudget > data.maxBudget)
      ctx.addIssue({ code: 'custom', path: ['maxBudget'], message: 'Maximum must be at least minimum' });
    if ((data.minArea != null || data.maxArea != null) && !data.areaUnit) ctx.addIssue({ code: 'custom', path: ['areaUnit'], message: 'Area unit required' });
  });
export type BrokerRequirementInput = z.infer<typeof brokerRequirementSchema>;

/** An available-property post remains a Requirement until a separate reviewed conversion. */
export function offeredRequirement(input: InventoryInput): BrokerRequirementInput {
  const data = inventoryInputSchema.parse(input);
  const amount = data.purpose === 'SALE' ? data.totalSalePrice : (data.monthlyRent ?? data.rent);
  const title = [
    data.details?.sourceLayout || (data.bhk ? `${data.bhk} ${data.roomKind || 'BHK'}` : data.propertyType),
    data.details?.projectName,
    data.houseNo,
    data.unitLabel || data.floor,
    data.sector || data.address,
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200);
  return brokerRequirementSchema.parse({
    intent: 'OFFER',
    title: title || 'Property details need review',
    offerDetails: data,
    contactName: data.ownerName,
    contactPhone: data.ownerPhone,
    purpose: data.purpose,
    category: data.category,
    propertyTypes: data.propertyType ? [data.propertyType] : [],
    localityNames: data.sector ? [data.sector] : [],
    minBudget: amount,
    maxBudget: amount,
    bedrooms: data.bhk ? [data.bhk] : [],
    roomKind: data.roomKind,
    furnishing: data.furnishing,
    minArea: data.area,
    maxArea: data.area,
    areaUnit: data.areaUnit,
    notes: data.notes,
  });
}
export interface LedgerItem extends Omit<InventoryInput, 'contacts' | 'directoryMonth'> {
  detailAccess?: 'OWN' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'REVOKED' | 'EXPIRED' | 'LOCKED';
  detailAccessExpiresAt?: string | null;
  canEdit?: boolean;
  directoryMonth?: string | null;
  localityId?: string | null;
  publishedListingId?: string | null;
  publishedListing?: {
    id: string;
    slug: string;
    title: string;
    status: string;
    purpose: string;
    reviewRequiredRole: string | null;
    rejectionReason: string | null;
    updatedAt: string;
  } | null;
  isPublished?: boolean;
  id: string;
  organizationId: string;
  organization?: { id: string; name: string; slug: string };
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
  deletedAt?: string | null;
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
export function ledgerMatch(requirement: Omit<BrokerRequirementInput, 'intent'> & { intent?: BrokerRequirementInput['intent'] }, item: InventoryInput) {
  if (requirement.intent && requirement.intent !== 'DEMAND') return null;
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
  for (const key of ['clientMutationId', 'date', 'organizationId', 'directoryMonth', 'expectedRevision', 'status', 'availability', 'verificationStatus'])
    if (result[key] == null) delete result[key];
  for (const key of ['bhk', 'area', 'monthlyRent', 'rent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'])
    if (key in result) result[key] = result[key] === '' || result[key] == null ? null : Number(result[key]);
  if (typeof result.directionsUrl === 'string') result.directionsUrl = normalizeInventoryDirections(result.directionsUrl);
  if ('monthlyRent' in result) delete result.rent; // monthlyRent is the canonical editor field.
  if (result.details != null) result.details = preparePropertyDetails(result.details);
  else delete result.details;
  if (Array.isArray(result.contacts))
    result.contacts = result.contacts.map((contact) => ({
      name: contact?.name ?? null,
      phone: contact?.phone ?? null,
      role: contact?.role ?? 'UNKNOWN',
      note: contact?.note ?? null,
    }));
  return result;
}

export function inventoryAccessRefreshInterval(items: readonly LedgerItem[]): number | false {
  const deadlines = items.flatMap((item) => (item.detailAccessExpiresAt ? [Date.parse(item.detailAccessExpiresAt)] : []));
  if (!deadlines.length) return false;
  return Math.max(1000, Math.min(30_000, Math.min(...deadlines) - Date.now()));
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

/** Public property media may be shared. Private records and signed API paths stay inside BrokerIQ. */
export function shareablePropertyPhotoUrls(urls: readonly string[] = []): string[] {
  const links = new Set<string>();
  for (const value of urls) {
    try {
      const url = new URL(value);
      const path = decodeURIComponent(url.pathname);
      if (url.protocol !== 'https:' || url.username || url.password || /[%\\\u0000-\u001f]/.test(path)) continue;
      if (/\/(?:imports|inventory|private|authenticated|kyc|scan|chat|inspection)(?:\/|$)|\/media\/(?!f\/listing\/)/i.test(path)) continue;
      url.hash = '';
      links.add(url.href);
    } catch {
      // Ignore malformed legacy values.
    }
  }
  return [...links];
}

export function propertyPhotoDraft(message: string, urls: readonly string[] = [], maxLength = 2000): string {
  const links: string[] = [];
  for (const url of shareablePropertyPhotoUrls(urls)) {
    const section = `\n\nProperty photos:\n${[...links, url].join('\n')}`;
    if (message.length + section.length <= maxLength) links.push(url);
  }
  return links.length ? `${message}\n\nProperty photos:\n${links.join('\n')}` : message;
}

/** One readable gallery link is used for new messages across every property-sharing entry point. */
export function propertyGalleryDraft(message: string, url: string): string {
  const link = new URL(url);
  if (!['https:', 'http:'].includes(link.protocol) || link.username || link.password || !/^\/photos\/[a-f0-9]{48}$/.test(link.pathname))
    throw new Error('Invalid property gallery link');
  const reference = link.pathname.slice(-8).toUpperCase();
  return `${message}\n\nView all property photos · Ref ${reference}:\n${link.href}`;
}
