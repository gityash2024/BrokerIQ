import { z } from 'zod';
import { FurnishingStatus, ListingType, PropertyStatus, PropertyType } from '../enums';
import { REGEX_PATTERNS } from '../constants';

export const createPropertySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().optional().nullable(),
  propertyType: z.nativeEnum(PropertyType),
  listingType: z.nativeEnum(ListingType),
  price: z.number().positive('Price must be greater than zero'),
  pricePerSqFt: z.number().positive().optional().nullable(),
  areaSqFt: z.number().positive('Area in sq.ft. must be positive'),
  carpetAreaSqFt: z.number().positive().optional().nullable(),
  bhk: z.number().int().min(0).max(20).optional().nullable(),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  balconies: z.number().int().min(0).optional().nullable(),
  furnishing: z.nativeEnum(FurnishingStatus).default(FurnishingStatus.UNFURNISHED),
  facing: z.string().optional().nullable(),
  floorNumber: z.number().int().optional().nullable(),
  totalFloors: z.number().int().optional().nullable(),
  parking: z.number().int().min(0).default(0),
  ageOfProperty: z.number().int().min(0).optional().nullable(),
  address: z.string().min(5, 'Address is required'),
  locality: z.string().min(2, 'Locality is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(REGEX_PATTERNS.INDIAN_PINCODE, 'Invalid 6-digit Indian PIN code'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  videos: z.array(z.string().url()).default([]),
  ownerId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
});

export const updatePropertySchema = createPropertySchema.partial().extend({
  status: z.nativeEnum(PropertyStatus).optional(),
});

export const propertyFilterSchema = z.object({
  propertyType: z.nativeEnum(PropertyType).optional(),
  listingType: z.nativeEnum(ListingType).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  furnishing: z.nativeEnum(FurnishingStatus).optional(),
  bhk: z.coerce.number().int().optional(),
  locality: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minArea: z.coerce.number().positive().optional(),
  maxArea: z.coerce.number().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreatePropertyDto = z.infer<typeof createPropertySchema>;
export type UpdatePropertyDto = z.infer<typeof updatePropertySchema>;
export type PropertyFilterDto = z.infer<typeof propertyFilterSchema>;
