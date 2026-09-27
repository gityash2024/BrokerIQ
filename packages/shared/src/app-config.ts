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
    .object({ allowPasswordLogin: z.boolean().default(true), allowEmailOtp: z.boolean().default(true), allowGoogle: z.boolean().default(true), allowBrokerSignup: z.boolean().default(true) })
    .default({ allowPasswordLogin: true, allowEmailOtp: true, allowGoogle: true, allowBrokerSignup: true }),
  seo: z
    .object({
      defaultTitle: z.string().default('BrokerIQ — Buy, Rent & Invest in Gurgaon Property'),
      defaultDescription: z
        .string()
        .default('Verified flats, builder floors, villas, offices and plots for sale & rent in Gurgaon. Compare localities, prices and connect with trusted brokers.'),
      ogImage: z.string().default(''),
    })
    .default({
      defaultTitle: 'BrokerIQ — Buy, Rent & Invest in Gurgaon Property',
      defaultDescription:
        'Verified flats, builder floors, villas, offices and plots for sale & rent in Gurgaon. Compare localities, prices and connect with trusted brokers.',
      ogImage: '',
    }),
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
