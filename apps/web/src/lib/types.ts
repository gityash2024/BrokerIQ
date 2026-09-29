import type { LeadSource, LeadStage, ListingPurpose, PropertyType } from '@brokeriq/shared';

export interface LocalityLite {
  id: string;
  name: string;
  slug: string;
  zone?: string | null;
}

export interface ListingCard {
  id: string;
  refNo: number;
  slug: string;
  purpose: ListingPurpose;
  category: string;
  propertyType: PropertyType;
  status: string;
  title: string;
  price: number;
  pricePerSqft: number | null;
  maintenance?: number | null;
  securityDeposit?: number | null;
  brokerageType?: string | null;
  brokerageAmount?: number | null;
  coBroking?: boolean;
  priceNegotiable?: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  carpetArea: number | null;
  builtUpArea: number | null;
  superArea: number | null;
  plotArea: number | null;
  furnishing: string | null;
  possession: string | null;
  floor: number | null;
  totalFloors: number | null;
  societyName: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  postedByType: 'OWNER' | 'BROKER' | 'BUILDER';
  isVerified: boolean;
  isFeatured: boolean;
  views: number;
  enquiryCount: number;
  publishedAt: string | null;
  createdAt: string;
  locality: LocalityLite;
  project: { id: string; name: string; slug: string } | null;
  organization: { id: string; name: string; slug: string; logoUrl: string | null; verification: string; rating: number; responseMinutes?: number | null } | null;
  _count?: { media: number };
  rejectionReason?: string | null;
  moderationFlags?: string[];
  expiresAt?: string | null;
  shortlistCount?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  sourceDetail: string | null;
  stage: LeadStage;
  temperature: 'HOT' | 'WARM' | 'COLD' | null;
  score: number;
  tags: string[];
  notes: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  repeatCount: number;
  assignedTo: { id: string; name: string; avatarUrl: string | null } | null;
  listing: { id: string; title: string; slug: string } | null;
  requirement: any;
}

export const areaOf = (l: Pick<ListingCard, 'carpetArea' | 'builtUpArea' | 'superArea' | 'plotArea'>) => l.superArea ?? l.builtUpArea ?? l.carpetArea ?? l.plotArea;
