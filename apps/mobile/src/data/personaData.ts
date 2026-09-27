/**
 * Multi-Persona Master Data & Definitions
 * Provides presets for 5 Core Personas and Initial Mock Data for Seeker, Owner, and Broker Modes.
 */

import { Role } from '@brokeriq/shared';

export type PersonaNavigationMode = 'SEEKER' | 'OWNER' | 'BROKER';

export interface PersonaConfig {
  id: string;
  role: Role | string;
  mode: PersonaNavigationMode;
  title: string;
  name: string;
  email: string;
  phone: string;
  portalRoute: string;
  organizationName: string;
  city: string;
  avatar: string;
  accentColor: string;
  description: string;
  badgeText: string;
  reraNumber?: string;
}

export const DEMO_PERSONAS: Record<string, PersonaConfig> = {
  SUPER_ADMIN: {
    id: 'persona-super-admin',
    role: Role.SUPER_ADMIN,
    mode: 'BROKER',
    title: 'Super Admin',
    name: 'Aarav Mehta',
    email: 'admin@brokeriq.in',
    phone: '+919811002233',
    portalRoute: '/admin',
    organizationName: 'BrokerIQ Platform HQ',
    city: 'Gurgaon & Mumbai',
    avatar: 'AM',
    accentColor: '#6366F1', // Indigo
    badgeText: 'Super Admin',
    description: 'Platform control, listing moderation, KYC approvals & telemetry',
  },
  AGENCY_MANAGER: {
    id: 'persona-agency-manager',
    role: Role.BROKER_ADMIN,
    mode: 'BROKER',
    title: 'Agency Manager',
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@founder-realty.in',
    phone: '+919810234567',
    portalRoute: '/agency',
    organizationName: 'Founder Realty India',
    city: 'Mumbai South & BKC',
    avatar: 'RS',
    accentColor: '#D97706', // Amber
    badgeText: 'Agency Manager',
    description: 'Agency seats (8/10), lead allocation engine & agency CRM pipeline',
    reraNumber: 'A51900028491',
  },
  BROKER_AGENT: {
    id: 'persona-broker-agent',
    role: Role.BROKER_AGENT,
    mode: 'BROKER',
    title: 'Broker Agent',
    name: 'Amit Verma',
    email: 'amit.verma@founder-realty.in',
    phone: '+919810987654',
    portalRoute: '/agent',
    organizationName: 'Founder Realty India',
    city: 'Worli & Lower Parel',
    avatar: 'AV',
    accentColor: '#0D9488', // Teal
    badgeText: 'Broker Agent',
    description: 'Field CRM, my leads, listing book scanner & client follow-ups',
    reraNumber: 'A51900049210',
  },
  PROPERTY_OWNER: {
    id: 'persona-property-owner',
    role: Role.PROPERTY_OWNER,
    mode: 'OWNER',
    title: 'Property Owner',
    name: 'Deepak Gupta',
    email: 'deepak.owner@brokeriq.in',
    phone: '+919899248292',
    portalRoute: '/owner',
    organizationName: 'SS Omnia Commercial Assets',
    city: 'Sector 86, Gurgaon',
    avatar: 'DG',
    accentColor: '#0284C7', // Sky Blue
    badgeText: 'Property Owner',
    description: '3-step listing creation, direct buyer inquiries & verified trust badges',
  },
  SEEKER: {
    id: 'persona-seeker',
    role: Role.SEEKER,
    mode: 'SEEKER',
    title: 'Seeker / Buyer',
    name: 'Vikram Malhotra',
    email: 'vikram.seeker@brokeriq.in',
    phone: '+919820011223',
    portalRoute: '/portal',
    organizationName: 'Verified HNW Seeker',
    city: 'Mumbai & Dwarka Expressway',
    avatar: 'VM',
    accentColor: '#EC4899', // Rose Pink
    badgeText: 'Seeker / Buyer',
    description: 'Marketplace discovery, saved wishlist, sector intelligence & contacted log',
  },
};

export interface SavedPropertyItem {
  id: string;
  title: string;
  project: string;
  sector: string;
  unitNumber: string;
  carpetAreaSqFt: number;
  priceDisplay: string;
  pricePerSqFt: number | string;
  rentalYieldPct?: number;
  category: string;
  status: string;
  contactName: string;
  contactPhone: string;
  imageUrl: string;
  savedAt: string;
}

export interface InquiryItem {
  id: string;
  propertyId: string;
  propertyTitle: string;
  sector: string;
  unitNumber: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerBudget: string;
  ownerName: string;
  ownerPhone: string;
  status: 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'NEGOTIATION';
  createdAt: string;
  message: string;
  lastInteraction: string;
}

export interface OwnerListingItem {
  id: string;
  project: string;
  sector: string;
  unitNumber: string;
  floor: string;
  carpetAreaSqFt: number;
  priceDisplay: string;
  pricePerSqFt: number | string;
  status: string;
  tenancy: string;
  viewsCount: number;
  inquiriesCount: number;
  isBoosted: boolean;
  verified: boolean;
  postedDate: string;
}

export interface VerificationBadgeItem {
  id: string;
  title: string;
  subtitle: string;
  status: 'VERIFIED' | 'PENDING' | 'REQUIRED';
  documentNumber?: string;
  verifiedDate?: string;
}

export const INITIAL_SAVED_PROPERTIES: SavedPropertyItem[] = [
  {
    id: 'sec86-ssomnia-g80',
    title: 'SS Omnia - Prime Corner Retail Shop',
    project: 'SS Omnia',
    sector: 'Sector-86',
    unitNumber: 'G-80',
    carpetAreaSqFt: 449,
    priceDisplay: '₹1.12 Cr',
    pricePerSqFt: 24944,
    rentalYieldPct: 8.8,
    category: 'Retail Shop',
    status: 'Ready Shop',
    contactName: 'Deepak Gupta',
    contactPhone: '+919899248292',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    savedAt: 'Yesterday',
  },
  {
    id: 'sec88a-signum-52',
    title: 'Signature Signum-88A - Food Court Anchor',
    project: 'Signature Signum-88A',
    sector: 'Sector-88A',
    unitNumber: 'Shop No-52',
    carpetAreaSqFt: 534,
    priceDisplay: '₹1.38 Cr',
    pricePerSqFt: 25842,
    rentalYieldPct: 9.1,
    category: 'Pre-Leased Rented',
    status: 'Rented @ ₹100/sq.ft to Vishal Mega Mart',
    contactName: 'Ashwani Verma',
    contactPhone: '+916260245484',
    imageUrl: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&auto=format&fit=crop&q=80',
    savedAt: '2 days ago',
  },
  {
    id: 'prop-mumbai-1',
    title: 'Lodha World One - Luxury High-Rise Residence',
    project: 'Lodha World One',
    sector: 'Lower Parel, Mumbai',
    unitNumber: 'Tower B - 4201',
    carpetAreaSqFt: 3150,
    priceDisplay: '₹14.5 Cr',
    pricePerSqFt: 46031,
    category: 'Luxury Residence',
    status: 'Ready to Move',
    contactName: 'Amit Verma',
    contactPhone: '+919810987654',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
    savedAt: '5 days ago',
  },
];

export const INITIAL_INQUIRIES: InquiryItem[] = [
  {
    id: 'inq-101',
    propertyId: 'sec86-ssomnia-g80',
    propertyTitle: 'SS Omnia - Unit G-80',
    sector: 'Sector-86, Gurgaon',
    unitNumber: 'G-80',
    buyerName: 'Vikram Malhotra',
    buyerPhone: '+919820011223',
    buyerEmail: 'vikram.seeker@brokeriq.in',
    buyerBudget: '₹1.1 Cr - ₹1.25 Cr',
    ownerName: 'Deepak Gupta',
    ownerPhone: '+919899248292',
    status: 'NEGOTIATION',
    createdAt: 'Today, 11:30 AM',
    message: 'Interested in G-80 commercial retail corner. Requested lease deed copy and rental verification.',
    lastInteraction: 'Owner replied: Lease draft shared over WhatsApp',
  },
  {
    id: 'inq-102',
    propertyId: 'sec88a-signum-52',
    propertyTitle: 'Signature Signum-88A - Food Court Anchor',
    sector: 'Sector-88A, Gurgaon',
    unitNumber: 'Shop No-52',
    buyerName: 'Pooja Agarwal',
    buyerPhone: '+919818822331',
    buyerEmail: 'pooja.investor@gmail.com',
    buyerBudget: '₹1.40 Cr',
    ownerName: 'Deepak Gupta',
    ownerPhone: '+919899248292',
    status: 'SCHEDULED',
    createdAt: 'Yesterday, 4:15 PM',
    message: 'Looking for 9%+ ROI pre-leased assets on Dwarka Expressway corridor.',
    lastInteraction: 'Site visit scheduled for tomorrow at 2:00 PM',
  },
  {
    id: 'inq-103',
    propertyId: 'sec89-orris-309',
    propertyTitle: 'Orris Market 89 - SCO Commercial Plot',
    sector: 'Sector-89, Gurgaon',
    unitNumber: 'SCO-309',
    buyerName: 'Rohan Mehra',
    buyerPhone: '+919871144220',
    buyerBudget: '₹2.8 Cr',
    ownerName: 'Deepak Gupta',
    ownerPhone: '+919899248292',
    status: 'NEW',
    createdAt: '2 days ago',
    message: 'Inquired about basement + GF + 3 floors construction permissions and frontage width.',
    lastInteraction: 'New inquiry waiting for owner callback',
  },
];

export const INITIAL_OWNER_LISTINGS: OwnerListingItem[] = [
  {
    id: 'own-list-1',
    project: 'SS Omnia',
    sector: 'Sector-86',
    unitNumber: 'G-80',
    floor: 'Ground Floor (GF)',
    carpetAreaSqFt: 449,
    priceDisplay: '₹1.12 Cr',
    pricePerSqFt: 24944,
    status: 'Ready Shop',
    tenancy: 'Pre-Leased @ ₹75k/mo',
    viewsCount: 342,
    inquiriesCount: 14,
    isBoosted: true,
    verified: true,
    postedDate: '12 Sep 2026',
  },
  {
    id: 'own-list-2',
    project: 'Signature Signum-88A',
    sector: 'Sector-88A',
    unitNumber: 'Shop No-52',
    floor: 'First Floor (FF)',
    carpetAreaSqFt: 534,
    priceDisplay: '₹1.38 Cr',
    pricePerSqFt: 25842,
    status: 'Rented to Vishal Mega Mart',
    tenancy: 'Rented @ ₹100/sq.ft (9.1% Yield)',
    viewsCount: 521,
    inquiriesCount: 26,
    isBoosted: false,
    verified: true,
    postedDate: '04 Sep 2026',
  },
  {
    id: 'own-list-3',
    project: 'Sapphire Ninety',
    sector: 'Sector-90',
    unitNumber: 'SF-18',
    floor: 'Second Floor (SF)',
    carpetAreaSqFt: 380,
    priceDisplay: '₹72 Lakh',
    pricePerSqFt: 18947,
    status: 'Under Construction',
    tenancy: 'Vacant / Self-Use',
    viewsCount: 189,
    inquiriesCount: 8,
    isBoosted: false,
    verified: false,
    postedDate: '18 Sep 2026',
  },
];

export const INITIAL_VERIFICATION_BADGES: VerificationBadgeItem[] = [
  {
    id: 'badge-phone',
    title: 'Mobile Phone OTP Verified',
    subtitle: 'Primary contact (+91 9899248292) securely authenticated',
    status: 'VERIFIED',
    documentNumber: '+91 98992 48292',
    verifiedDate: '10 Aug 2026',
  },
  {
    id: 'badge-aadhaar',
    title: 'Aadhaar / DigiLocker KYC',
    subtitle: 'Government ID verified via UIDAI DigiLocker API',
    status: 'VERIFIED',
    documentNumber: 'XXXX-XXXX-4819',
    verifiedDate: '12 Aug 2026',
  },
  {
    id: 'badge-pan',
    title: 'PAN Card Verification',
    subtitle: 'Income Tax Department PAN record linked to KYC',
    status: 'VERIFIED',
    documentNumber: 'AAAPG****D',
    verifiedDate: '12 Aug 2026',
  },
  {
    id: 'badge-registry',
    title: 'Property Registry & Conveyance Deed',
    subtitle: 'Ownership record verified with Gurgaon Tehsil Registry',
    status: 'VERIFIED',
    documentNumber: 'HR-GGM-REG-86-9921',
    verifiedDate: '24 Aug 2026',
  },
  {
    id: 'badge-utility',
    title: 'Latest Electricity / Utility Bill',
    subtitle: 'DHBVN Electricity bill within last 60 days',
    status: 'PENDING',
    documentNumber: 'DHBVN CA #827192',
  },
  {
    id: 'badge-rera',
    title: 'RERA Project Registration Compliance',
    subtitle: 'Cross-checked with Haryana RERA database',
    status: 'VERIFIED',
    documentNumber: 'HRERA-GGM-86-2026-041',
    verifiedDate: '01 Sep 2026',
  },
];
