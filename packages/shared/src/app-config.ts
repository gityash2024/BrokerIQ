import { z } from 'zod';

/**
 * Non-secret, admin-editable runtime configuration (Super Admin → Settings → App Config).
 * Served publicly at GET /api/public/config.
 */
export const appConfigSchema = z.object({
  siteName: z.string().min(1).default('BrokerIQ'),
  tagline: z.string().default('Gurgaon का भरोसेमंद property साथी'),
  city: z.string().default('Gurgaon'),
  siteUrl: z.string().default(''),
  supportEmail: z.string().default(''),
  supportPhone: z.string().default(''),
  supportWhatsApp: z.string().default(''),
  officeAddress: z.string().default(''),
  logoUrl: z.string().default(''),
  primaryColor: z.string().default('#4F46E5'),
  accentColor: z.string().default('#F59E0B'),
  social: z
    .object({
      facebook: z.string().default(''),
      instagram: z.string().default(''),
      linkedin: z.string().default(''),
      youtube: z.string().default(''),
      x: z.string().default(''),
    })
    .default({ facebook: '', instagram: '', linkedin: '', youtube: '', x: '' }),
  playStoreUrl: z.string().default(''),
  appStoreUrl: z.string().default(''),
  announcement: z
    .object({ enabled: z.boolean().default(false), text: z.string().default(''), link: z.string().default(''), tone: z.enum(['info', 'promo', 'warning']).default('info') })
    .default({ enabled: false, text: '', link: '', tone: 'info' }),
  maintenance: z.object({ enabled: z.boolean().default(false), message: z.string().default('') }).default({ enabled: false, message: '' }),
  mobile: z
    .object({ minVersion: z.string().default('1.0.0'), latestVersion: z.string().default('1.0.0'), forceUpdateMessage: z.string().default('') })
    .default({ minVersion: '1.0.0', latestVersion: '1.0.0', forceUpdateMessage: '' }),
  listing: z
    .object({
      requireModeration: z.boolean().default(true),
      expiryDays: z.number().int().min(7).default(90),
      maxPhotos: z.number().int().min(1).max(50).default(25),
      contactRevealRequiresLogin: z.boolean().default(true),
    })
    .default({ requireModeration: true, expiryDays: 90, maxPhotos: 25, contactRevealRequiresLogin: true }),
  auth: z
    // allowBrokerSignup = open signup. When off, new broker firms join only with a valid invite code.
    .object({ allowPasswordLogin: z.boolean().default(true), allowEmailOtp: z.boolean().default(true), allowGoogle: z.boolean().default(true), allowBrokerSignup: z.boolean().default(false) })
    .default({ allowPasswordLogin: true, allowEmailOtp: true, allowGoogle: true, allowBrokerSignup: false }),
  /** Approved WhatsApp template names (platform number) for messages sent outside the 24h window. Empty = skip WhatsApp. */
  whatsappTemplates: z
    .object({ requirementMatch: z.string().default(''), weeklyReport: z.string().default(''), visitReminder: z.string().default(''), searchAlert: z.string().default(''), language: z.string().default('hi') })
    .default({ requirementMatch: '', weeklyReport: '', visitReminder: '', searchAlert: '', language: 'hi' }),
  /** Brokers inviting other brokers: each firm gets a personal code; joiners get this plan free. */
  brokerReferrals: z
    .object({ enabled: z.boolean().default(true), planCode: z.string().default('BUSINESS'), months: z.number().int().min(0).max(60).default(12), maxUsesPerBroker: z.number().int().min(1).max(1000).default(25) })
    .default({ enabled: true, planCode: 'BUSINESS', months: 12, maxUsesPerBroker: 25 }),
  seo: z
    .object({
      defaultTitle: z.string().default('BrokerIQ — Flats, Houses & PG for Rent in Gurgaon'),
      defaultDescription: z
        .string()
        .default('Verified furnished flats, builder floors, PG and offices for rent in Gurgaon, Haryana. Compare rents by locality and connect with trusted local brokers.'),
      ogImage: z.string().default(''),
    })
    .default({
      defaultTitle: 'BrokerIQ — Flats, Houses & PG for Rent in Gurgaon',
      defaultDescription:
        'Verified furnished flats, builder floors, PG and offices for rent in Gurgaon, Haryana. Compare rents by locality and connect with trusted local brokers.',
      ogImage: '',
    }),
  monetization: z
    .object({ boostPricePerWeek: z.number().min(0).default(499), gstPercent: z.number().min(0).max(28).default(18), invoicePrefix: z.string().default('BIQ'), companyName: z.string().default(''), companyAddress: z.string().default(''), companyGstin: z.string().default('') })
    .default({ boostPricePerWeek: 499, gstPercent: 18, invoicePrefix: 'BIQ', companyName: '', companyAddress: '', companyGstin: '' }),
  finance: z
    .object({ defaultInterestRate: z.number().default(8.5), stampDutyMalePct: z.number().default(7), stampDutyFemalePct: z.number().default(5), stampDutyJointPct: z.number().default(6), registrationFeeMax: z.number().default(50000) })
    .default({ defaultInterestRate: 8.5, stampDutyMalePct: 7, stampDutyFemalePct: 5, stampDutyJointPct: 6, registrationFeeMax: 50000 }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const DEFAULT_APP_CONFIG: AppConfig = appConfigSchema.parse({});

export const FeatureFlagKey = {
  AI_SCANNER: 'ai_scanner',
  AI_ASSIST: 'ai_assist',
  WHATSAPP_AUTOMATION: 'whatsapp_automation',
  BROKER_MICROSITES: 'broker_microsites',
  REVIEWS: 'reviews',
  PROJECTS: 'projects',
  BOOSTS: 'boosts',
  CHAT: 'chat',
} as const;
export type FeatureFlagKey = (typeof FeatureFlagKey)[keyof typeof FeatureFlagKey];

/** Public config payload (what clients receive) */
export interface PublicConfig {
  app: AppConfig;
  flags: Record<string, boolean>;
  /** Public (non-secret) integration values, e.g. maptiler key, google client ids, razorpay key id */
  integrations: Record<string, Record<string, unknown> & { configured: boolean }>;
  apiVersion: string;
}

/** Pre-rental-pivot SEO defaults, swapped for the rental copy when an install still carries them. */
export const LEGACY_SEO_DEFAULTS = {
  title: 'BrokerIQ — Buy, Rent & Invest in Gurgaon Property',
  description: 'Verified flats, builder floors, villas, offices and plots for sale & rent in Gurgaon. Compare localities, prices and connect with trusted brokers.',
};
