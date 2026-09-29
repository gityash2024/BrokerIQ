import { z } from 'zod';
import {
  ActivityType,
  AutomationActionType,
  AutomationTrigger,
  CallOutcome,
  Facing,
  FollowUpType,
  Furnishing,
  KycDocType,
  LEAD_SOURCES,
  LEAD_STAGES,
  LISTING_PURPOSES,
  LeadTemperature,
  PROPERTY_TYPES,
  PossessionStatus,
  RENTABLE_TYPES,
  BrokerageType,
  ReportReason,
  VisitStatus,
} from '../enums';

const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.values(o) as [T[keyof T], ...T[keyof T][]]);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{10,16}$/, 'Valid phone number डालें');
export const emailSchema = z.string().trim().toLowerCase().email('Valid email डालें');
export const passwordSchema = z.string().min(8, 'Password कम से कम 8 अक्षर का हो').max(72);

// ------------------------------------------------------------------ Auth
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  accountType: z.enum(['USER', 'BROKER']).default('USER'),
  firmName: z.string().trim().min(2).max(120).optional(),
  inviteCode: z.string().trim().max(40).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const otpRequestSchema = z.object({ email: emailSchema, purpose: z.enum(['LOGIN', 'VERIFY_EMAIL', 'RESET_PASSWORD']).default('LOGIN') });
export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(80).optional(),
  accountType: z.enum(['USER', 'BROKER']).optional(),
  inviteCode: z.string().trim().max(40).optional(),
});
export const googleLoginSchema = z.object({ idToken: z.string().min(10), accountType: z.enum(['USER', 'BROKER']).optional(), inviteCode: z.string().trim().max(40).optional() });
export const refreshSchema = z.object({ refreshToken: z.string().min(10) });
export const resetPasswordSchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().optional(), newPassword: passwordSchema });
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  locale: z.enum(['en', 'hi']).optional(),
});
export const pushTokenSchema = z.object({ token: z.string().min(5), platform: z.enum(['ios', 'android', 'web']) });

// ------------------------------------------------------------------ Organization / broker
export const brokerOnboardingSchema = z.object({
  firmName: z.string().trim().min(2).max(120),
  reraNumber: z.string().trim().max(60).optional().nullable(),
  gstNumber: z.string().trim().max(20).optional().nullable(),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  localityIds: z.array(z.string()).max(30).default([]),
  logoUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  experienceYears: z.number().int().min(0).max(80).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  inviteCode: z.string().trim().max(40).optional(),
});
export type BrokerOnboardingInput = z.infer<typeof brokerOnboardingSchema>;

export const inviteMemberSchema = z.object({ email: emailSchema, name: z.string().trim().min(2).max(80), role: z.enum(['BROKER_ADMIN', 'BROKER_AGENT']).default('BROKER_AGENT') });

// ------------------------------------------------------------------ Listings
export const listingInputSchema = z.object({
  // Rental marketplace: only RENT listings of rentable property types are accepted.
  purpose: z.enum(LISTING_PURPOSES).refine((p) => p === 'RENT', 'BrokerIQ पर अभी सिर्फ़ rent listings होती हैं').default('RENT'),
  propertyType: z.enum(PROPERTY_TYPES).refine((t) => RENTABLE_TYPES.includes(t), 'यह property type rent के लिए उपलब्ध नहीं है'),
  title: z.string().trim().min(8).max(140).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  localityId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  societyName: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  price: z.number().positive(),
  maintenance: z.number().min(0).optional().nullable(),
  brokerageType: enumOf(BrokerageType).optional().nullable(),
  brokerageAmount: z.number().min(0).optional().nullable(),
  // Co-broking: other BrokerIQ brokers may request to work this listing for a commission split.
  coBroking: z.boolean().optional(),
  coBrokingSharePct: z.number().min(0).max(100).optional().nullable(),
  securityDeposit: z.number().min(0).optional().nullable(),
  priceNegotiable: z.boolean().default(false),
  bedrooms: z.number().int().min(0).max(20).optional().nullable(),
  bathrooms: z.number().int().min(0).max(20).optional().nullable(),
  balconies: z.number().int().min(0).max(20).optional().nullable(),
  carpetArea: z.number().positive().optional().nullable(),
  builtUpArea: z.number().positive().optional().nullable(),
  superArea: z.number().positive().optional().nullable(),
  plotArea: z.number().positive().optional().nullable(),
  floor: z.number().int().min(-3).max(200).optional().nullable(),
  totalFloors: z.number().int().min(0).max(200).optional().nullable(),
  furnishing: enumOf(Furnishing).optional().nullable(),
  possession: enumOf(PossessionStatus).optional().nullable(),
  possessionDate: z.string().optional().nullable(),
  ageYears: z.number().int().min(0).max(100).optional().nullable(),
  facing: enumOf(Facing).optional().nullable(),
  parking: z.number().int().min(0).max(50).optional().nullable(),
  availableFrom: z.string().optional().nullable(),
  preferredTenants: z.array(z.string()).max(6).default([]),
  amenities: z.array(z.string()).max(80).default([]),
  reraNumber: z.string().trim().max(60).optional().nullable(),
  photos: z.array(z.object({ url: z.string().url(), caption: z.string().max(80).optional().nullable(), publicId: z.string().optional().nullable() })).max(50).default([]),
  videoUrl: z.string().url().optional().nullable().or(z.literal('')),
  floorPlanUrl: z.string().url().optional().nullable().or(z.literal('')),
  contactName: z.string().trim().max(80).optional().nullable(),
  contactPhone: phoneSchema.optional().nullable(),
  submit: z.boolean().default(true),
});
export type ListingInput = z.infer<typeof listingInputSchema>;
/**
 * PATCH schema: every field optional and **no defaults** — `.partial()` alone would still inject
 * defaults (photos: [], submit: true …) and silently wipe data on partial updates.
 */
export const listingUpdateSchema = z.object(
  Object.fromEntries(
    Object.entries(listingInputSchema.shape).map(([k, v]) => [k, ((v as any)._zod?.def?.type === 'default' ? (v as any)._zod.def.innerType : v).optional()]),
  ) as { [K in keyof typeof listingInputSchema.shape]: z.ZodOptional<z.ZodTypeAny> },
);
export type ListingUpdateInput = Partial<ListingInput>;

export const listingSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  purpose: z.enum(LISTING_PURPOSES).optional(),
  category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PLOT']).optional(),
  types: z.string().optional(), // comma separated PropertyType
  localities: z.string().optional(), // comma separated slugs
  projectId: z.string().optional(),
  orgId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  bedrooms: z.string().optional(), // "2,3,4+"
  furnishing: z.string().optional(),
  possession: enumOf(PossessionStatus).optional(),
  postedBy: z.enum(['OWNER', 'BROKER', 'BUILDER']).optional(),
  verified: z.coerce.boolean().optional(),
  minArea: z.coerce.number().optional(),
  maxArea: z.coerce.number().optional(),
  amenities: z.string().optional(),
  bbox: z.string().optional(), // "minLng,minLat,maxLng,maxLat"
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'area_desc', 'psf_asc']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});
export type ListingSearchInput = z.infer<typeof listingSearchSchema>;

export const enquirySchema = z.object({
  listingId: z.string().optional(),
  projectId: z.string().optional(),
  organizationId: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional(),
  wantsVisit: z.boolean().default(false),
  visitDate: z.string().optional().nullable(),
  source: z.enum(['WEBSITE', 'MICROSITE', 'APP']).default('WEBSITE'),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

export const reportSchema = z.object({ listingId: z.string(), reason: enumOf(ReportReason), details: z.string().max(1000).optional() });
export const reviewSchema = z.object({ organizationId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1500).optional() });
export const savedSearchSchema = z.object({ name: z.string().trim().min(2).max(80), filters: z.record(z.string(), z.unknown()), alertsEnabled: z.boolean().default(true) });

// ------------------------------------------------------------------ CRM
export const leadRequirementSchema = z.object({
  purpose: z.enum(LISTING_PURPOSES).optional().nullable(),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).default([]),
  localityIds: z.array(z.string()).default([]),
  minBudget: z.number().min(0).optional().nullable(),
  maxBudget: z.number().min(0).optional().nullable(),
  bedrooms: z.array(z.number().int()).default([]),
  minArea: z.number().optional().nullable(),
  maxArea: z.number().optional().nullable(),
  furnishing: enumOf(Furnishing).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type LeadRequirementInput = z.infer<typeof leadRequirementSchema>;

/** A tenant's stated need, posted from the site / app ("अपनी ज़रूरत बताएँ"). */
export const tenantRequirementSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  bedrooms: z.array(z.number().int().min(0).max(10)).max(6).default([]),
  minBudget: z.number().min(0).optional().nullable(),
  maxBudget: z.number().min(1000).optional().nullable(),
  localityIds: z.array(z.string()).max(10).default([]),
  furnishing: enumOf(Furnishing).optional().nullable(),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).max(6).default([]),
  moveInBy: z.coerce.date().optional().nullable(),
  officeHub: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  shareWithBrokers: z.boolean().default(true),
});
export type TenantRequirementInput = z.infer<typeof tenantRequirementSchema>;

export const leadInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable().or(z.literal('')),
  source: z.enum(LEAD_SOURCES).default('MANUAL'),
  stage: z.enum(LEAD_STAGES).default('NEW'),
  temperature: enumOf(LeadTemperature).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  listingId: z.string().optional().nullable(),
  tags: z.array(z.string().max(30)).max(20).default([]),
  notes: z.string().max(4000).optional().nullable(),
  requirement: leadRequirementSchema.optional(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;
export const leadUpdateSchema = leadInputSchema.partial().extend({ lostReason: z.string().max(300).optional().nullable() });

export const leadStageSchema = z.object({ stage: z.enum(LEAD_STAGES), lostReason: z.string().max(300).optional().nullable() });
export const activityInputSchema = z.object({
  type: enumOf(ActivityType),
  content: z.string().max(4000).optional().nullable(),
  callOutcome: enumOf(CallOutcome).optional().nullable(),
  durationSec: z.number().int().min(0).optional().nullable(),
});
export const followUpInputSchema = z.object({
  leadId: z.string(),
  type: enumOf(FollowUpType).default('CALL'),
  dueAt: z.string(),
  note: z.string().max(1000).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});
export const visitInputSchema = z.object({
  leadId: z.string(),
  listingId: z.string().optional().nullable(),
  scheduledAt: z.string(),
  address: z.string().max(300).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});
export const visitUpdateSchema = z.object({
  status: enumOf(VisitStatus).optional(),
  scheduledAt: z.string().optional(),
  feedback: z.string().max(2000).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  checkInLat: z.number().optional().nullable(),
  checkInLng: z.number().optional().nullable(),
});
export const dealInputSchema = z.object({
  leadId: z.string(),
  listingId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(140),
  dealValue: z.number().positive(),
  commissionPct: z.number().min(0).max(100).optional().nullable(),
  commissionAmount: z.number().min(0).optional().nullable(),
  agentSharePct: z.number().min(0).max(100).optional().nullable(),
  closedAt: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  commissionReceived: z.number().min(0).optional().nullable(),
});

export const automationRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  isActive: z.boolean().default(true),
  trigger: enumOf(AutomationTrigger),
  conditions: z
    .object({
      sources: z.array(z.enum(LEAD_SOURCES)).default([]),
      stages: z.array(z.enum(LEAD_STAGES)).default([]),
      toStage: z.enum(LEAD_STAGES).optional().nullable(),
      noActivityHours: z.number().int().min(1).max(24 * 30).optional().nullable(),
    })
    .default({ sources: [], stages: [] }),
  actions: z
    .array(
      z.object({
        type: enumOf(AutomationActionType),
        delayMinutes: z.number().int().min(0).max(60 * 24 * 30).default(0),
        params: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(20),
  respectBusinessHours: z.boolean().default(true),
});
export type AutomationRuleInput = z.infer<typeof automationRuleSchema>;

export const kycSubmitSchema = z.object({ docType: enumOf(KycDocType), fileUrl: z.string().url(), docNumber: z.string().max(40).optional().nullable() });

export const whatsappSendSchema = z.object({
  leadId: z.string().optional(),
  conversationId: z.string().optional(),
  text: z.string().max(4096).optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().default('en'),
  templateParams: z.array(z.string()).default([]),
  mediaUrl: z.string().url().optional(),
  listingId: z.string().optional(),
});

// ------------------------------------------------------------------ Admin / CMS
export const homepageSectionSchema = z.object({
  type: z.string(),
  title: z.string().max(140).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  config: z.record(z.string(), z.unknown()).default({}),
});
export const pageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(160),
  content: z.string().max(100000),
  metaTitle: z.string().max(160).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  isPublished: z.boolean().default(true),
});
export const blogPostSchema = pageSchema.extend({
  excerpt: z.string().max(400).optional().nullable(),
  coverUrl: z.string().url().optional().nullable().or(z.literal('')),
  tags: z.array(z.string()).default([]),
});
export const faqSchema = z.object({ question: z.string().min(4).max(300), answer: z.string().min(2).max(4000), category: z.string().max(40).default('general'), sortOrder: z.number().int().default(0), isActive: z.boolean().default(true) });
export const localitySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  zone: z.string().max(80).optional().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  pincode: z.string().max(10).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  highlights: z.array(z.string()).default([]),
  coverUrl: z.string().url().optional().nullable().or(z.literal('')),
  avgPriceSale: z.number().optional().nullable(),
  avgRent2Bhk: z.number().optional().nullable(),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const projectSchema = z.object({
  name: z.string().min(2).max(140),
  builderName: z.string().min(2).max(120),
  localityId: z.string(),
  reraNumber: z.string().max(60).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  possession: enumOf(PossessionStatus).optional().nullable(),
  possessionDate: z.string().optional().nullable(),
  minPrice: z.number().optional().nullable(),
  maxPrice: z.number().optional().nullable(),
  configurations: z.array(z.object({ label: z.string(), area: z.number().optional().nullable(), price: z.number().optional().nullable() })).default([]),
  amenities: z.array(z.string()).default([]),
  photos: z.array(z.string().url()).default([]),
  brochureUrl: z.string().url().optional().nullable().or(z.literal('')),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  totalUnits: z.number().int().optional().nullable(),
  landArea: z.string().max(40).optional().nullable(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const planSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/),
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional().nullable(),
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0),
  limits: z.object({
    agents: z.number().int().min(1),
    activeListings: z.number().int().min(0),
    leadsPerMonth: z.number().int().min(0),
    aiCredits: z.number().int().min(0),
    automations: z.number().int().min(0),
    connectors: z.number().int().min(0),
  }),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  trialDays: z.number().int().min(0).default(0),
});
export const templateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.]+$/),
  channel: z.enum(['EMAIL', 'WHATSAPP', 'PUSH']),
  name: z.string().min(2).max(100),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(20000),
  isActive: z.boolean().default(true),
});
export const broadcastSchema = z.object({
  audience: z.enum(['ALL', 'USERS', 'BROKERS']),
  channel: z.enum(['PUSH', 'EMAIL', 'IN_APP']),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(2000),
  link: z.string().max(300).optional().nullable(),
});

// ------------------------------------------------------------------ Feedback
export const FEEDBACK_TYPES = ['BUG', 'FEATURE', 'IMPROVEMENT', 'COMPLAINT', 'GENERAL'] as const;
export const FEEDBACK_STATUSES = ['OPEN', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DECLINED'] as const;
export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES).default('GENERAL'),
  title: z.string().trim().min(4, 'Title कम से कम 4 अक्षर').max(140),
  description: z.string().trim().min(10, 'थोड़ा detail में लिखें').max(5000),
  screenshots: z.array(z.string().url()).max(5).default([]),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  platform: z.enum(['WEB', 'ANDROID', 'IOS']).default('WEB'),
  appVersion: z.string().max(20).optional().nullable(),
  pageUrl: z.string().max(300).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal('')),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export const feedbackAdminSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  isPublic: z.boolean().optional(),
  adminReply: z.string().max(3000).optional().nullable(),
  type: z.enum(FEEDBACK_TYPES).optional(),
  title: z.string().min(4).max(140).optional(),
  mergedIntoId: z.string().optional().nullable(),
});

// ------------------------------------------------------------------ AI assistant
export const assistantChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .min(1)
    .max(30),
  lang: z.string().max(5).default('en'),
  /** Where the user is (route) — helps the agent understand "this property" / "this lead". */
  context: z.object({ path: z.string().max(200).optional(), entityId: z.string().max(60).optional() }).optional(),
});
export const assistantConfirmSchema = z.object({ token: z.string().min(10).max(100), lang: z.string().max(5).default('en') });
export const transcribeSchema = z.object({ audio: z.string().min(100).max(11_000_000), mime: z.string().max(60).default('audio/m4a'), lang: z.string().max(5).optional() });
