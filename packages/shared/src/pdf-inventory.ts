import { z } from 'zod';

export const PDF_INVENTORY_MAX_BYTES = 32 * 1024 * 1024;
const optionalText = z.string().trim().max(300).nullable().optional();
const optionalNumber = z.number().finite().nonnegative().max(1_000_000_000).nullable().optional();

export const pdfInventoryFields = z.object({
  locality: optionalText,
  sector: optionalText,
  address: optionalText,
  propertyType: optionalText,
  areaSqft: optionalNumber,
  floor: optionalText,
  configuration: optionalText,
  furnishing: optionalText,
  monthlyRent: optionalNumber,
  availability: z.enum(['AVAILABLE', 'RENTED', 'UNKNOWN']).optional(),
  ownerName: optionalText,
  contacts: z.array(z.string().regex(/^\+91[6-9]\d{9}$/)).max(8).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export const pdfInventoryUpdate = pdfInventoryFields.partial().extend({
  expectedUpdatedAt: z.iso.datetime(),
  reviewed: z.boolean().optional(),
});
export const pdfInventoryFilters = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  batchId: z.string().max(64).optional(),
  search: z.string().trim().max(150).optional(),
  locality: optionalText,
  sector: optionalText,
  propertyType: optionalText,
  floor: optionalText,
  configuration: optionalText,
  furnishing: optionalText,
  availability: pdfInventoryFields.shape.availability,
  review: z.enum(['SAVED', 'NEEDS_REVIEW', 'DUPLICATE']).optional(),
  minArea: z.coerce.number().min(0).optional(),
  maxArea: z.coerce.number().min(0).optional(),
  minRent: z.coerce.number().min(0).optional(),
  maxRent: z.coerce.number().min(0).optional(),
});
export type PdfInventoryFields = z.infer<typeof pdfInventoryFields>;
export type PdfInventoryUpdate = z.infer<typeof pdfInventoryUpdate>;
export type PdfInventoryFilters = z.infer<typeof pdfInventoryFilters>;
export type PdfInventoryRow = PdfInventoryFields & {
  id: string;
  batchId: string;
  pageNo: number;
  rowNo: number;
  rawText: string;
  review: 'SAVED' | 'NEEDS_REVIEW' | 'DUPLICATE';
  updatedAt: string;
};
export type PdfInventoryBatch = {
  id: string;
  fileName: string | null;
  status: string;
  lastError: string | null;
  createdAt: string;
  metadata: { pageCount?: number; listingPages?: number[]; reviewPages?: number[] } | null;
};

export const pdfInventoryFilterFields = [
  ['search', 'Search address or owner'], ['locality', 'Locality'], ['sector', 'Sector'],
  ['propertyType', 'Property type'], ['floor', 'Floor'], ['configuration', 'BHK / RK'],
  ['furnishing', 'Furnishing'], ['minArea', 'Minimum area'], ['maxArea', 'Maximum area'],
  ['minRent', 'Minimum rent'], ['maxRent', 'Maximum rent'],
] as const;
export const pdfInventoryEditableFields = [
  ['locality', 'Locality'], ['sector', 'Sector'], ['address', 'Society / address'],
  ['propertyType', 'Property type'], ['areaSqft', 'Area in sq ft'], ['floor', 'Floor'],
  ['configuration', 'BHK / RK'], ['furnishing', 'Furnishing'], ['monthlyRent', 'Monthly rent'],
  ['ownerName', 'Owner'], ['notes', 'Notes'],
] as const;
