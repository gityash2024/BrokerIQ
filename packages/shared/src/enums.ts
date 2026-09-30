/**
 * Domain enums shared by API, web and mobile.
 * Values are kept identical to the Prisma enums in apps/api/prisma/schema.prisma.
 */

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as [T[keyof T], ...T[keyof T][]];

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MODERATOR: 'MODERATOR',
  SUPPORT: 'SUPPORT',
  BROKER_ADMIN: 'BROKER_ADMIN',
  BROKER_AGENT: 'BROKER_AGENT',
  USER: 'USER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
/** BrokerIQ's own team (admin panel access). Super Admin can do everything; others get a subset. */
export const STAFF_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'SUPPORT'] as const;
export const isStaff = (role?: string | null) => !!role && (STAFF_ROLES as readonly string[]).includes(role);

/** Limits BrokerIQ can put on a user or a broker firm without blocking the whole account. */
export const USER_RESTRICTIONS = {
  post: 'Listing डालना',
  chat: 'Chat / messages',
  enquire: 'Enquiry भेजना',
  review: 'Review लिखना',
  ai: 'AI features',
} as const;
export const ORG_RESTRICTIONS = {
  post: 'Listing डालना',
  cobroking: 'Co-broking',
  campaigns: 'WhatsApp campaigns',
  connectors: 'Lead connectors',
  ai: 'AI features',
} as const;
export type UserRestriction = keyof typeof USER_RESTRICTIONS;
export type OrgRestriction = keyof typeof ORG_RESTRICTIONS;
export const ROLES = values(Role);
export const BROKER_ROLES: Role[] = [Role.BROKER_ADMIN, Role.BROKER_AGENT];

export const UserStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', DELETED: 'DELETED' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const OrgStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;
export type OrgStatus = (typeof OrgStatus)[keyof typeof OrgStatus];

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const ListingPurpose = { SALE: 'SALE', RENT: 'RENT' } as const;
export type ListingPurpose = (typeof ListingPurpose)[keyof typeof ListingPurpose];
export const LISTING_PURPOSES = values(ListingPurpose);

export const PropertyCategory = { RESIDENTIAL: 'RESIDENTIAL', COMMERCIAL: 'COMMERCIAL', PLOT: 'PLOT' } as const;
export type PropertyCategory = (typeof PropertyCategory)[keyof typeof PropertyCategory];
export const PROPERTY_CATEGORIES = values(PropertyCategory);

export const PropertyType = {
  APARTMENT: 'APARTMENT',
  BUILDER_FLOOR: 'BUILDER_FLOOR',
  INDEPENDENT_HOUSE: 'INDEPENDENT_HOUSE',
  VILLA: 'VILLA',
  PENTHOUSE: 'PENTHOUSE',
  STUDIO: 'STUDIO',
  SERVICE_APARTMENT: 'SERVICE_APARTMENT',
  PG: 'PG',
  RESIDENTIAL_PLOT: 'RESIDENTIAL_PLOT',
  COMMERCIAL_PLOT: 'COMMERCIAL_PLOT',
  OFFICE: 'OFFICE',
  COWORKING: 'COWORKING',
  SHOP: 'SHOP',
  SHOWROOM: 'SHOWROOM',
  WAREHOUSE: 'WAREHOUSE',
  INDUSTRIAL: 'INDUSTRIAL',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];
export const PROPERTY_TYPES = values(PropertyType);

export const PROPERTY_TYPE_CATEGORY: Record<PropertyType, PropertyCategory> = {
  APARTMENT: 'RESIDENTIAL',
  BUILDER_FLOOR: 'RESIDENTIAL',
  INDEPENDENT_HOUSE: 'RESIDENTIAL',
  VILLA: 'RESIDENTIAL',
  PENTHOUSE: 'RESIDENTIAL',
  STUDIO: 'RESIDENTIAL',
  SERVICE_APARTMENT: 'RESIDENTIAL',
  PG: 'RESIDENTIAL',
  RESIDENTIAL_PLOT: 'PLOT',
  COMMERCIAL_PLOT: 'PLOT',
  OFFICE: 'COMMERCIAL',
  COWORKING: 'COMMERCIAL',
  SHOP: 'COMMERCIAL',
  SHOWROOM: 'COMMERCIAL',
  WAREHOUSE: 'COMMERCIAL',
  INDUSTRIAL: 'COMMERCIAL',
};

/** BrokerIQ is a rental & brokerage marketplace for Gurgaon, Haryana. Sale listings stay off unless Super Admin enables "sale_listings". */
export const MARKET_CITY = 'Gurgaon';
export const MARKET_STATE = 'Haryana';
/** Property types that make sense to rent (plots / industrial land are sale-only). */
export const RENTABLE_TYPES = PROPERTY_TYPES.filter((t) => !['RESIDENTIAL_PLOT', 'COMMERCIAL_PLOT', 'INDUSTRIAL'].includes(t)) as PropertyType[];

/** Brokerage charged by the broker on a rental deal. */
export const BrokerageType = { NONE: 'NONE', DAYS_15: 'DAYS_15', MONTH_1: 'MONTH_1', FIXED: 'FIXED' } as const;
export type BrokerageType = (typeof BrokerageType)[keyof typeof BrokerageType];
export const BROKERAGE_TYPES = values(BrokerageType);

export const Furnishing = { UNFURNISHED: 'UNFURNISHED', SEMI_FURNISHED: 'SEMI_FURNISHED', FULLY_FURNISHED: 'FULLY_FURNISHED' } as const;
export type Furnishing = (typeof Furnishing)[keyof typeof Furnishing];
export const FURNISHINGS = values(Furnishing);

export const PossessionStatus = { READY_TO_MOVE: 'READY_TO_MOVE', UNDER_CONSTRUCTION: 'UNDER_CONSTRUCTION' } as const;
export type PossessionStatus = (typeof PossessionStatus)[keyof typeof PossessionStatus];
export const POSSESSION_STATUSES = values(PossessionStatus);

export const ListingStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SOLD: 'SOLD',
  RENTED: 'RENTED',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
  BLOCKED: 'BLOCKED',
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];
export const LISTING_STATUSES = values(ListingStatus);

export const PostedByType = { OWNER: 'OWNER', BROKER: 'BROKER', BUILDER: 'BUILDER' } as const;
export type PostedByType = (typeof PostedByType)[keyof typeof PostedByType];

export const Facing = {
  NORTH: 'NORTH',
  SOUTH: 'SOUTH',
  EAST: 'EAST',
  WEST: 'WEST',
  NORTH_EAST: 'NORTH_EAST',
  NORTH_WEST: 'NORTH_WEST',
  SOUTH_EAST: 'SOUTH_EAST',
  SOUTH_WEST: 'SOUTH_WEST',
} as const;
export type Facing = (typeof Facing)[keyof typeof Facing];
export const FACINGS = values(Facing);

export const LeadStage = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  INTERESTED: 'INTERESTED',
  SITE_VISIT: 'SITE_VISIT',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];
export const LEAD_STAGES = values(LeadStage);
export const OPEN_LEAD_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION'];

export const LeadSource = {
  WEBSITE: 'WEBSITE',
  MICROSITE: 'MICROSITE',
  HOUSING: 'HOUSING',
  ACRES99: 'ACRES99',
  MAGICBRICKS: 'MAGICBRICKS',
  NOBROKER: 'NOBROKER',
  FACEBOOK: 'FACEBOOK',
  INSTAGRAM: 'INSTAGRAM',
  WHATSAPP: 'WHATSAPP',
  WEBHOOK: 'WEBHOOK',
  CSV_IMPORT: 'CSV_IMPORT',
  WALK_IN: 'WALK_IN',
  REFERRAL: 'REFERRAL',
  CALL: 'CALL',
  MANUAL: 'MANUAL',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];
export const LEAD_SOURCES = values(LeadSource);

export const LeadTemperature = { HOT: 'HOT', WARM: 'WARM', COLD: 'COLD' } as const;
export type LeadTemperature = (typeof LeadTemperature)[keyof typeof LeadTemperature];

export const ActivityType = {
  NOTE: 'NOTE',
  CALL: 'CALL',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  STAGE_CHANGE: 'STAGE_CHANGE',
  ASSIGNMENT: 'ASSIGNMENT',
  SITE_VISIT: 'SITE_VISIT',
  FOLLOW_UP: 'FOLLOW_UP',
  PROPERTY_SHARED: 'PROPERTY_SHARED',
  ENQUIRY: 'ENQUIRY',
  AUTOMATION: 'AUTOMATION',
  SYSTEM: 'SYSTEM',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const CallOutcome = {
  CONNECTED: 'CONNECTED',
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  SWITCHED_OFF: 'SWITCHED_OFF',
  WRONG_NUMBER: 'WRONG_NUMBER',
  CALLBACK: 'CALLBACK',
} as const;
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];

export const FollowUpType = { CALL: 'CALL', WHATSAPP: 'WHATSAPP', MEETING: 'MEETING', EMAIL: 'EMAIL', OTHER: 'OTHER' } as const;
export type FollowUpType = (typeof FollowUpType)[keyof typeof FollowUpType];
export const FollowUpStatus = { PENDING: 'PENDING', DONE: 'DONE', MISSED: 'MISSED', CANCELLED: 'CANCELLED' } as const;
export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];

export const VisitStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus];

export const DealStatus = { OPEN: 'OPEN', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED' } as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const EnquiryStatus = { NEW: 'NEW', RESPONDED: 'RESPONDED', CLOSED: 'CLOSED' } as const;
export type EnquiryStatus = (typeof EnquiryStatus)[keyof typeof EnquiryStatus];

export const MessageDirection = { INBOUND: 'INBOUND', OUTBOUND: 'OUTBOUND' } as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];
export const MessageStatus = { QUEUED: 'QUEUED', SENT: 'SENT', DELIVERED: 'DELIVERED', READ: 'READ', FAILED: 'FAILED', RECEIVED: 'RECEIVED' } as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const ConnectorType = {
  EMAIL_INBOX: 'EMAIL_INBOX',
  WEBHOOK: 'WEBHOOK',
  META_LEAD_ADS: 'META_LEAD_ADS',
  WHATSAPP: 'WHATSAPP',
} as const;
export type ConnectorType = (typeof ConnectorType)[keyof typeof ConnectorType];

export const AutomationTrigger = {
  LEAD_CREATED: 'LEAD_CREATED',
  STAGE_CHANGED: 'STAGE_CHANGED',
  NO_ACTIVITY: 'NO_ACTIVITY',
  VISIT_SCHEDULED: 'VISIT_SCHEDULED',
  VISIT_REMINDER: 'VISIT_REMINDER',
} as const;
export type AutomationTrigger = (typeof AutomationTrigger)[keyof typeof AutomationTrigger];

export const AutomationActionType = {
  SEND_WHATSAPP_TEXT: 'SEND_WHATSAPP_TEXT',
  SEND_WHATSAPP_TEMPLATE: 'SEND_WHATSAPP_TEMPLATE',
  SEND_EMAIL: 'SEND_EMAIL',
  ASSIGN_ROUND_ROBIN: 'ASSIGN_ROUND_ROBIN',
  ASSIGN_TO: 'ASSIGN_TO',
  CREATE_FOLLOW_UP: 'CREATE_FOLLOW_UP',
  ADD_TAG: 'ADD_TAG',
  SET_STAGE: 'SET_STAGE',
  NOTIFY_TEAM: 'NOTIFY_TEAM',
} as const;
export type AutomationActionType = (typeof AutomationActionType)[keyof typeof AutomationActionType];

export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentStatus = { CREATED: 'CREATED', PAID: 'PAID', FAILED: 'FAILED', REFUNDED: 'REFUNDED' } as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const KycDocType = {
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  RERA_CERTIFICATE: 'RERA_CERTIFICATE',
  GST_CERTIFICATE: 'GST_CERTIFICATE',
  OWNERSHIP_PROOF: 'OWNERSHIP_PROOF',
  ELECTRICITY_BILL: 'ELECTRICITY_BILL',
  OTHER: 'OTHER',
} as const;
export type KycDocType = (typeof KycDocType)[keyof typeof KycDocType];

export const ReportReason = {
  FAKE: 'FAKE',
  WRONG_PRICE: 'WRONG_PRICE',
  ALREADY_SOLD: 'ALREADY_SOLD',
  BROKER_AS_OWNER: 'BROKER_AS_OWNER',
  SPAM: 'SPAM',
  OTHER: 'OTHER',
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const NotificationKind = {
  NEW_LEAD: 'NEW_LEAD',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  FOLLOW_UP_DUE: 'FOLLOW_UP_DUE',
  VISIT_REMINDER: 'VISIT_REMINDER',
  NEW_MESSAGE: 'NEW_MESSAGE',
  ENQUIRY: 'ENQUIRY',
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  KYC_UPDATE: 'KYC_UPDATE',
  SAVED_SEARCH_MATCH: 'SAVED_SEARCH_MATCH',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

export const HomepageSectionType = {
  HERO: 'HERO',
  LOCALITIES: 'LOCALITIES',
  FEATURED_LISTINGS: 'FEATURED_LISTINGS',
  FEATURED_PROJECTS: 'FEATURED_PROJECTS',
  TOP_BROKERS: 'TOP_BROKERS',
  MAP_EXPLORER: 'MAP_EXPLORER',
  TOOLS: 'TOOLS',
  WHY_US: 'WHY_US',
  TESTIMONIALS: 'TESTIMONIALS',
  APP_DOWNLOAD: 'APP_DOWNLOAD',
  BLOG: 'BLOG',
  CTA_BANNER: 'CTA_BANNER',
} as const;
export type HomepageSectionType = (typeof HomepageSectionType)[keyof typeof HomepageSectionType];
