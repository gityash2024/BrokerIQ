import type { Prisma } from '@prisma/client';

// Inventory-backed listings are discoverable only while their original unit is available.
export const PUBLIC_LISTING_ORIGIN = {
  OR: [{ inventoryOrigin: { is: null } }, { inventoryOrigin: { is: { availability: 'AVAILABLE', status: 'ACTIVE', deletedAt: null } } }],
} satisfies Prisma.ListingWhereInput;

export const SHAREABLE_LISTING = {
  ...PUBLIC_LISTING_ORIGIN,
  status: 'ACTIVE',
  deletedAt: null,
} satisfies Prisma.ListingWhereInput;
