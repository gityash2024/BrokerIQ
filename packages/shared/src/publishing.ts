import { z } from 'zod';
import { listingInputSchema } from './schemas';
import { PROPERTY_TYPES, RENTABLE_TYPES } from './enums';
/** Public fields are supplied deliberately; source/contact/notes are never copied from the ledger. */
export const inventoryPublishSchema = listingInputSchema
  .pick({
    title: true,
    description: true,
    localityId: true,
    propertyType: true,
    price: true,
    address: true,
    bedrooms: true,
    bathrooms: true,
    balconies: true,
    carpetArea: true,
    floor: true,
    totalFloors: true,
    furnishing: true,
    securityDeposit: true,
    amenities: true,
    contactName: true,
    contactPhone: true,
    photos: true,
  })
  .extend({
    purpose: z.enum(['RENT', 'SALE']).optional(),
    propertyType: z.enum(PROPERTY_TYPES),
    title: z.string().trim().min(8).max(140),
    contactPhone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Choose a valid public contact (+91)'),
    confirmedAvailable: z.literal(true),
    publicPreviewAccepted: z.literal(true),
    expectedRevision: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.purpose !== 'SALE' && !RENTABLE_TYPES.includes(value.propertyType))
      ctx.addIssue({ code: 'custom', path: ['propertyType'], message: 'Choose a rentable property type or publish for sale' });
  })
  .strict();
export type InventoryPublishInput = z.infer<typeof inventoryPublishSchema>;

/** Common policy for Inventory and legacy public-listing submission paths. */
export function publicationDecision(role: string, verification: string | undefined, submit = true) {
  const direct = role === 'SUPER_ADMIN' || (role === 'BROKER_ADMIN' && verification === 'VERIFIED');
  return {
    status: !submit ? ('DRAFT' as const) : direct ? ('ACTIVE' as const) : ('PENDING_REVIEW' as const),
    reviewRequiredRole:
      !submit || direct ? null : role === 'BROKER_AGENT' && verification === 'VERIFIED' ? ('BROKER_ADMIN' as const) : ('SUPER_ADMIN' as const),
  };
}
