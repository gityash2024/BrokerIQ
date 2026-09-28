import { z } from 'zod';

/**
 * Consent-based data sharing (location + phonebook contacts). The data is visible to the
 * BrokerIQ Super Admin only — never to brokers, agents or other users — and is deleted
 * as soon as a user withdraws consent. Bump the version whenever the disclosure changes.
 */
export const PRIVACY_POLICY_VERSION = '2026-09-v1';
export const CONSENT_KINDS = ['LOCATION', 'CONTACTS'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const consentSchema = z.object({
  kind: z.enum(CONSENT_KINDS),
  granted: z.boolean(),
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

export const locationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional().nullable(),
  platform: z.enum(['android', 'ios', 'web']).default('web'),
});

export const contactsSyncSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().max(120).optional().nullable(),
        phones: z.array(z.string().max(30)).max(10).default([]),
        emails: z.array(z.string().max(120)).max(5).default([]),
      }),
    )
    .max(2000),
});

/** The disclosure shown before asking (honest about purpose and who sees the data). */
export const DATA_CONSENT_TEXT = {
  title: 'आपकी जानकारी, आपकी मर्ज़ी',
  intro: 'BrokerIQ एक registered rental brokerage platform है। आगे बढ़ने से पहले साफ़ बता रहे हैं कि हम क्या माँग रहे हैं और क्यों।',
  location: {
    title: 'आपकी location',
    what: 'App खोलने पर आपकी approximate location (दिन में एक बार)।',
    why: 'आपके आस-पास की सही rent properties और localities दिखाने के लिए।',
  },
  contacts: {
    title: 'आपके phone contacts',
    what: 'Phonebook के नाम, mobile नंबर और email।',
    why: 'BrokerIQ की internal team आपके जान-पहचान वालों तक हमारी rental services पहुँचा सके (leads)।',
  },
  who: 'यह data सिर्फ़ BrokerIQ admin देख सकता है — कोई broker, agent या दूसरा user कभी नहीं। हम आपका data बेचते नहीं।',
  security: 'Data encrypted रहता है। Profile → Privacy में जाकर कभी भी बंद करें — बंद करते ही वह data delete हो जाता है।',
  optional: 'यह पूरी तरह आपकी मर्ज़ी है — मना करने पर भी BrokerIQ पूरी तरह चलेगा।',
  allow: 'चुनी हुई चीज़ें Allow करें',
  notNow: 'अभी नहीं',
} as const;
