import type {
  Furnishing,
  LeadSource,
  LeadStage,
  ListingStatus,
  PossessionStatus,
  PropertyType,
  PropertyCategory,
  ListingPurpose,
  VisitStatus,
  Facing,
  LeadTemperature,
} from './enums';

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: 'Apartment',
  BUILDER_FLOOR: 'Builder Floor',
  INDEPENDENT_HOUSE: 'Independent House',
  VILLA: 'Villa',
  PENTHOUSE: 'Penthouse',
  STUDIO: 'Studio',
  SERVICE_APARTMENT: 'Service Apartment',
  PG: 'PG / Co-living',
  RESIDENTIAL_PLOT: 'Residential Plot',
  COMMERCIAL_PLOT: 'Commercial Plot',
  OFFICE: 'Office Space',
  COWORKING: 'Co-working',
  SHOP: 'Shop',
  SHOWROOM: 'Showroom',
  WAREHOUSE: 'Warehouse',
  INDUSTRIAL: 'Industrial',
};

export const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  PLOT: 'Plots & Land',
};

export const PURPOSE_LABELS: Record<ListingPurpose, string> = { SALE: 'Buy', RENT: 'Rent' };

export const FURNISHING_LABELS: Record<Furnishing, string> = {
  UNFURNISHED: 'Unfurnished',
  SEMI_FURNISHED: 'Semi-furnished',
  FULLY_FURNISHED: 'Fully furnished',
};

export const POSSESSION_LABELS: Record<PossessionStatus, string> = {
  READY_TO_MOVE: 'Ready to move',
  UNDER_CONSTRUCTION: 'Under construction',
};

export const FACING_LABELS: Record<Facing, string> = {
  NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West',
  NORTH_EAST: 'North-East', NORTH_WEST: 'North-West', SOUTH_EAST: 'South-East', SOUTH_WEST: 'South-West',
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'In review',
  ACTIVE: 'Live',
  REJECTED: 'Rejected',
  SOLD: 'Sold',
  RENTED: 'Rented out',
  EXPIRED: 'Expired',
  ARCHIVED: 'Archived',
};

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  SITE_VISIT: 'Site visit',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export const LEAD_STAGE_COLORS: Record<LeadStage, string> = {
  NEW: '#6366F1',
  CONTACTED: '#0EA5E9',
  INTERESTED: '#14B8A6',
  SITE_VISIT: '#F59E0B',
  NEGOTIATION: '#A855F7',
  WON: '#22C55E',
  LOST: '#94A3B8',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: 'BrokerIQ',
  MICROSITE: 'My microsite',
  HOUSING: 'Housing.com',
  ACRES99: '99acres',
  MAGICBRICKS: 'MagicBricks',
  NOBROKER: 'NoBroker',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  WEBHOOK: 'Webhook',
  CSV_IMPORT: 'CSV import',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  CALL: 'Phone call',
  MANUAL: 'Manual',
};

export const LEAD_SOURCE_COLORS: Record<LeadSource, string> = {
  WEBSITE: '#4F46E5',
  MICROSITE: '#7C3AED',
  HOUSING: '#6D28D9',
  ACRES99: '#0369A1',
  MAGICBRICKS: '#DC2626',
  NOBROKER: '#E11D48',
  FACEBOOK: '#1877F2',
  INSTAGRAM: '#DB2777',
  WHATSAPP: '#16A34A',
  WEBHOOK: '#475569',
  CSV_IMPORT: '#64748B',
  WALK_IN: '#CA8A04',
  REFERRAL: '#0D9488',
  CALL: '#0891B2',
  MANUAL: '#64748B',
};

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperature, string> = { HOT: 'Hot', WARM: 'Warm', COLD: 'Cold' };

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};
