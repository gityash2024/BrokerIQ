import { z } from 'zod';
import { listingInputSchema } from './schemas';
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
    title: z.string().trim().min(8).max(140),
    contactPhone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Choose a valid public contact (+91)'),
    confirmedAvailable: z.literal(true),
    publicPreviewAccepted: z.literal(true),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export type InventoryPublishInput = z.infer<typeof inventoryPublishSchema>;
