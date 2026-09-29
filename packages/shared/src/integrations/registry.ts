/**
 * Integration registry — single source of truth for every third-party credential.
 * The Super Admin "Credentials Center" and the broker "Connectors" pages render
 * their forms and how-to guides directly from this file, and the API validates
 * saved values against it.
 */

export type IntegrationScope = 'platform' | 'organization';
export type IntegrationCategory = 'auth' | 'email' | 'storage' | 'ai' | 'payments' | 'messaging' | 'leads' | 'maps' | 'push' | 'monitoring';
export type IntegrationFieldType = 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea' | 'url' | 'email';

export interface IntegrationField {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required?: boolean;
  /** Encrypted at rest and never returned to the client in plain text */
  secret?: boolean;
  /** Safe to expose to web/mobile clients via /public/config */
  public?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  default?: string | number | boolean;
}

export interface IntegrationDef {
  key: string;
  name: string;
  category: IntegrationCategory;
  scope: IntegrationScope;
  description: string;
  /** What the free tier gives you */
  freeTier: string;
  docsUrl: string;
  /** Step-by-step (Hindi) guide to obtain the credentials */
  steps: string[];
  fields: IntegrationField[];
  /** Features that stop working without this integration */
  usedFor: string[];
  testable: boolean;
  /** Integrations that can replace each other share a group (e.g. storage) */
  group?: string;
}

const API = '{API_URL}';

export const INTEGRATIONS: IntegrationDef[] = [
  // ---------------------------------------------------------------- Email
  {
    key: 'smtp',
    name: 'Email (SMTP)',
    category: 'email',
    scope: 'platform',
    description: 'Login OTP, notifications, lead alerts और receipts भेजने के लिए email server.',
    freeTier: 'Brevo: 300 emails/day free · Gmail: ~500/day free',
    docsUrl: 'https://help.brevo.com/hc/en-us/articles/7924908994450',
    steps: [
      'https://www.brevo.com पर free account बनाइए (credit card नहीं चाहिए)।',
      'ऊपर दाईं ओर नाम पर क्लिक करें → "SMTP & API" → "SMTP" tab खोलें।',
      '"Generate a new SMTP key" दबाएँ, नाम "BrokerIQ" दें और key copy कर लें (यही Password है)।',
      'इसी page पर दिख रहा "SMTP Server" (smtp-relay.brevo.com), "Port" (587) और "Login" नीचे भरें।',
      '"Senders, Domains & Dedicated IPs" → "Senders" में अपना From email जोड़कर verify करें।',
      'विकल्प (Gmail): Google Account → Security → 2-Step Verification ON → "App passwords" → नया password बनाएँ; Host smtp.gmail.com, Port 465, Secure = ON।',
      'Save करके "Test connection" दबाएँ — आपकी email पर test mail आना चाहिए।',
    ],
    fields: [
      { key: 'host', label: 'SMTP host', type: 'text', required: true, placeholder: 'smtp-relay.brevo.com' },
      { key: 'port', label: 'Port', type: 'number', required: true, default: 587 },
      { key: 'secure', label: 'Secure (SSL, port 465)', type: 'boolean', default: false },
      { key: 'user', label: 'Username / Login', type: 'text', required: true },
      { key: 'pass', label: 'Password / SMTP key', type: 'password', required: true, secret: true },
      { key: 'fromEmail', label: 'From email', type: 'email', required: true, placeholder: 'no-reply@yourdomain.com' },
      { key: 'fromName', label: 'From name', type: 'text', default: 'BrokerIQ' },
    ],
    usedFor: ['Email OTP login', 'Lead alerts', 'Team invites', 'Receipts'],
    testable: true,
  },
  // ---------------------------------------------------------------- Auth
  {
    key: 'google_oauth',
    name: 'Google Sign-In',
    category: 'auth',
    scope: 'platform',
    description: 'Website और app पर "Continue with Google" login.',
    freeTier: 'पूरी तरह free',
    docsUrl: 'https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid',
    steps: [
      'https://console.cloud.google.com खोलें → ऊपर project dropdown → "New Project" (नाम: BrokerIQ)।',
      '"APIs & Services" → "OAuth consent screen" → External चुनें → App name, support email, logo भरें → Save → "Publish app"।',
      '"Credentials" → "Create credentials" → "OAuth client ID" → Application type "Web application"।',
      '"Authorized JavaScript origins" में अपनी website का URL डालें (जैसे https://brokeriq.vercel.app और http://localhost:3001)।',
      'Create करने पर जो "Client ID" मिले उसे नीचे "Web client ID" में paste करें।',
      'Android app के लिए: फिर से "OAuth client ID" → type "Android" → Package name com.brokeriq.app और SHA-1 (eas credentials से) → Client ID नीचे "Android client ID" में डालें।',
    ],
    fields: [
      { key: 'webClientId', label: 'Web client ID', type: 'text', required: true, public: true, placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'androidClientId', label: 'Android client ID', type: 'text', public: true },
      { key: 'iosClientId', label: 'iOS client ID', type: 'text', public: true },
    ],
    usedFor: ['Google login (web + app)'],
    testable: false,
  },
  // ---------------------------------------------------------------- Storage
  {
    key: 'cloudinary',
    name: 'Cloudinary (Images & Files)',
    category: 'storage',
    scope: 'platform',
    group: 'storage',
    description: 'Property photos, videos, brochures, KYC documents का upload और fast CDN. (Self-hosted server पर MEDIA_ROOT set हो तो files server की अपनी disk पर compressed + encrypted रहती हैं — तब यह ज़रूरी नहीं।)',
    freeTier: '25 credits/month free (~25GB storage या bandwidth)',
    docsUrl: 'https://cloudinary.com/documentation/how_to_integrate_cloudinary',
    steps: [
      'https://cloudinary.com/users/register_free पर free account बनाइए।',
      'Login के बाद Dashboard (Programmable Media) खोलें।',
      '"Product Environment Credentials" में Cloud name, API Key और API Secret दिखेंगे (Settings → API Keys में भी)।',
      'तीनों नीचे भरें, folder name चाहें तो बदलें, Save → "Test connection"।',
    ],
    fields: [
      { key: 'cloudName', label: 'Cloud name', type: 'text', required: true, public: true },
      { key: 'apiKey', label: 'API key', type: 'text', required: true },
      { key: 'apiSecret', label: 'API secret', type: 'password', required: true, secret: true },
      { key: 'folder', label: 'Folder', type: 'text', default: 'brokeriq' },
    ],
    usedFor: ['Property photos', 'Post property', 'KYC upload', 'Broker logo', 'Listing-book scanner'],
    testable: true,
  },
  {
    key: 's3',
    name: 'S3-compatible storage (R2 / Spaces / AWS)',
    category: 'storage',
    scope: 'platform',
    group: 'storage',
    description: 'Cloudinary का विकल्प — Cloudflare R2 (10GB free), DigitalOcean Spaces या AWS S3.',
    freeTier: 'Cloudflare R2: 10GB storage free, egress free',
    docsUrl: 'https://developers.cloudflare.com/r2/api/s3/tokens/',
    steps: [
      'Cloudflare dashboard → R2 → "Create bucket" (नाम: brokeriq-media)।',
      'Bucket → Settings → "Public access" → r2.dev subdomain enable करें; वह URL "Public base URL" में डालें।',
      'R2 overview → "Manage R2 API Tokens" → "Create API token" → permission "Object Read & Write"।',
      'Access Key ID, Secret Access Key और Endpoint (https://<account-id>.r2.cloudflarestorage.com) नीचे भरें; Region = auto।',
    ],
    fields: [
      { key: 'endpoint', label: 'Endpoint', type: 'url', required: true },
      { key: 'region', label: 'Region', type: 'text', default: 'auto' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true },
      { key: 'accessKeyId', label: 'Access key ID', type: 'text', required: true },
      { key: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true, secret: true },
      { key: 'publicBaseUrl', label: 'Public base URL', type: 'url', required: true, public: true },
    ],
    usedFor: ['Media uploads (Cloudinary न हो तब)'],
    testable: true,
  },
  // ---------------------------------------------------------------- AI
  {
    key: 'groq',
    name: 'Groq AI',
    category: 'ai',
    scope: 'platform',
    group: 'ai',
    description: 'Listing-book scanner (photo → listings), lead summary, reply suggestions, property description writer.',
    freeTier: 'Free tier with generous daily limits',
    docsUrl: 'https://console.groq.com/docs/quickstart',
    steps: [
      'https://console.groq.com पर Google/email से login करें।',
      'बाएँ menu में "API Keys" → "Create API Key" → नाम BrokerIQ → key copy करें (दोबारा नहीं दिखेगी)।',
      'Key नीचे paste करें। Models default ठीक हैं; Groq के "Models" page से नए model नाम बदल सकते हैं।',
    ],
    fields: [
      { key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true, placeholder: 'gsk_...' },
      { key: 'textModel', label: 'Text model', type: 'text', default: 'llama-3.3-70b-versatile' },
      { key: 'visionModel', label: 'Vision model (scanner)', type: 'text', default: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    ],
    usedFor: ['AI scanner', 'Lead summary', 'Reply suggestions', 'Description writer', 'Lead scoring'],
    testable: true,
  },
  {
    key: 'gemini',
    name: 'Google Gemini AI',
    category: 'ai',
    scope: 'platform',
    group: 'ai',
    description: 'Groq का backup AI provider (vision + text).',
    freeTier: 'Google AI Studio free tier',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    steps: [
      'https://aistudio.google.com खोलें और Google account से login करें।',
      '"Get API key" → "Create API key" → project चुनें → key copy करें।',
      'Key नीचे paste करें, Save → Test।',
    ],
    fields: [
      { key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true },
      { key: 'model', label: 'Model', type: 'text', default: 'gemini-2.5-flash' },
    ],
    usedFor: ['AI features (Groq न हो तब)'],
    testable: true,
  },
  // ---------------------------------------------------------------- Payments
  {
    key: 'razorpay',
    name: 'Razorpay',
    category: 'payments',
    scope: 'platform',
    description: 'Broker subscriptions, listing boosts और invoices के payments.',
    freeTier: 'कोई monthly fee नहीं — सिर्फ per-transaction charge',
    docsUrl: 'https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/',
    steps: [
      'https://dashboard.razorpay.com पर account बनाइए (शुरुआत Test mode में)।',
      'Account & Settings → "API Keys" → "Generate Key" → Key ID और Key Secret copy करें।',
      'Account & Settings → "Webhooks" → "Add New Webhook" → URL: ' + API + '/api/billing/razorpay/webhook',
      'Webhook का Secret खुद बनाइए (कोई भी लंबा password) और events चुनें: payment.captured, payment.failed, order.paid।',
      'KYC पूरा होने के बाद Live mode की keys से यही दोबारा भरें।',
    ],
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text', required: true, public: true, placeholder: 'rzp_test_...' },
      { key: 'keySecret', label: 'Key secret', type: 'password', required: true, secret: true },
      { key: 'webhookSecret', label: 'Webhook secret', type: 'password', required: true, secret: true },
    ],
    usedFor: ['Broker subscription checkout', 'Listing boosts'],
    testable: true,
  },
  // ---------------------------------------------------------------- Messaging
  {
    key: 'whatsapp_platform',
    name: 'WhatsApp Cloud API (Platform number)',
    category: 'messaging',
    scope: 'platform',
    description: 'BrokerIQ का अपना WhatsApp number — जिन brokers ने अपना number नहीं जोड़ा उनके लिए fallback और platform alerts.',
    freeTier: 'User के message के 24 घंटे के अंदर replies free; template messages Meta के rate से',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    steps: [
      'https://developers.facebook.com → "My Apps" → "Create App" → use case "Other" → type "Business"।',
      'App dashboard में "WhatsApp" product add करें → "API Setup" खोलें।',
      '"Phone number ID" और "WhatsApp Business Account ID" copy करके नीचे भरें।',
      '"Add phone number" से अपना business number जोड़ें और OTP से verify करें (वह number WhatsApp app पर active नहीं होना चाहिए)।',
      'Permanent token: business.facebook.com → Business Settings → Users → "System users" → Add (Admin) → "Assign assets" में app और WhatsApp account (Full control) → "Generate new token" → permissions whatsapp_business_messaging + whatsapp_business_management → Expiry "Never"।',
      'App settings → Basic → "App Secret" copy करें।',
      'WhatsApp → Configuration → Webhook: Callback URL ' + API + '/api/webhooks/whatsapp/platform और Verify token नीचे वाला → "messages" field subscribe करें।',
    ],
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID', type: 'text', required: true },
      { key: 'businessAccountId', label: 'WhatsApp Business Account ID', type: 'text', required: true },
      { key: 'accessToken', label: 'Permanent access token', type: 'password', required: true, secret: true },
      { key: 'appSecret', label: 'App secret', type: 'password', secret: true, help: 'Webhook signature verify करने के लिए' },
      { key: 'verifyToken', label: 'Webhook verify token', type: 'text', required: true, help: 'कोई भी random string — यही Meta में डालनी है' },
      { key: 'displayPhone', label: 'Display phone number', type: 'text', public: true, placeholder: '+91 98xxxxxxx' },
    ],
    usedFor: ['Platform WhatsApp alerts', 'Fallback for brokers'],
    testable: true,
  },
  {
    key: 'whatsapp',
    name: 'My WhatsApp Business number',
    category: 'messaging',
    scope: 'organization',
    description: 'आपके अपने WhatsApp Business number से leads को automatic messages, team inbox और templates.',
    freeTier: 'User के message के 24 घंटे के अंदर replies free; template messages Meta के rate से',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    steps: [
      'https://developers.facebook.com → "My Apps" → "Create App" → type "Business" → WhatsApp product add करें।',
      '"API Setup" में "Add phone number" से अपना business number जोड़ें और verify करें।',
      '"Phone number ID" और "WhatsApp Business Account ID" नीचे भरें।',
      'Permanent token: business.facebook.com → Business Settings → Users → System users → Add (Admin) → Assign assets (App + WhatsApp account, Full control) → Generate token (whatsapp_business_messaging, whatsapp_business_management, Expiry: Never)।',
      'App settings → Basic → "App Secret" नीचे भरें।',
      'Save करने के बाद इस page पर दिख रहा Webhook URL और Verify token, Meta में WhatsApp → Configuration → Webhook में डालें और "messages" subscribe करें।',
    ],
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID', type: 'text', required: true },
      { key: 'businessAccountId', label: 'WhatsApp Business Account ID', type: 'text', required: true },
      { key: 'accessToken', label: 'Permanent access token', type: 'password', required: true, secret: true },
      { key: 'appSecret', label: 'App secret', type: 'password', secret: true },
      { key: 'displayPhone', label: 'Display phone number', type: 'text', placeholder: '+91 98xxxxxxx' },
    ],
    usedFor: ['Auto WhatsApp replies to new leads', 'Team WhatsApp inbox', 'Templates & drip campaigns'],
    testable: true,
  },
  // ---------------------------------------------------------------- Lead sources (broker)
  {
    key: 'email_inbox',
    name: 'Portal leads via Email (Housing · 99acres · MagicBricks)',
    category: 'leads',
    scope: 'organization',
    description: 'Housing.com, 99acres, MagicBricks, NoBroker की lead emails आपके inbox से अपने-आप पढ़कर leads बनाता है (हर 2 मिनट)।',
    freeTier: 'Free',
    docsUrl: 'https://support.google.com/mail/answer/185833',
    steps: [
      'जिस email पर Housing / 99acres / MagicBricks की lead emails आती हैं, वही इस्तेमाल करें (portal की profile में यही email हो)।',
      'Gmail: Settings (⚙) → "See all settings" → "Forwarding and POP/IMAP" → "Enable IMAP" → Save।',
      'Google Account → Security → 2-Step Verification ON करें → "App passwords" → नया password (नाम BrokerIQ) बनाएँ।',
      'नीचे Host imap.gmail.com, Port 993, Email और 16-अक्षर वाला App password भरें।',
      'कौन-से portals पढ़ने हैं वो चुनें → Save → "Test connection" → "Sync now"।',
      'Outlook/Zoho के लिए उनका IMAP host (outlook.office365.com / imap.zoho.in) इस्तेमाल करें।',
    ],
    fields: [
      { key: 'host', label: 'IMAP host', type: 'text', required: true, default: 'imap.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', required: true, default: 993 },
      { key: 'secure', label: 'SSL', type: 'boolean', default: true },
      { key: 'user', label: 'Email', type: 'email', required: true },
      { key: 'pass', label: 'App password', type: 'password', required: true, secret: true },
      { key: 'portals', label: 'Portals', type: 'text', default: 'HOUSING,ACRES99,MAGICBRICKS,NOBROKER', help: 'Comma separated' },
    ],
    usedFor: ['Housing.com leads', '99acres leads', 'MagicBricks leads', 'NoBroker leads'],
    testable: true,
  },
  {
    key: 'housing_api',
    name: 'Housing.com Lead API (direct)',
    category: 'leads',
    scope: 'organization',
    description: 'Housing.com के CRM Lead API से आपकी leads सीधे BrokerIQ में (हर 5 मिनट)। Email की ज़रूरत नहीं।',
    freeTier: 'Housing के paid broker/builder accounts के साथ मिलता है',
    docsUrl: 'https://housing.com',
    steps: [
      'Housing.com पर अपने account manager / support से "CRM Lead API integration" माँगें। वे आपको Profile ID और Encryption Key देंगे।',
      'Profile ID और Encryption Key नीचे भरें। Key यहाँ encrypted रहती है — इसे किसी और के साथ share न करें।',
      'Account type चुनें: Broker (flats / PG listings) या Builder (projects)।',
      'Save → "Test connection" → "अभी sync करें"। उसके बाद हर 5 मिनट में नई leads अपने-आप आएँगी।',
      'नई lead को तुरंत WhatsApp पर जवाब भेजने के लिए Automations में "Welcome WhatsApp" rule चालू रखें।',
    ],
    fields: [
      { key: 'profileId', label: 'Profile ID', type: 'text', required: true, help: 'Housing से मिली unique ID' },
      { key: 'encryptionKey', label: 'Encryption Key', type: 'password', required: true, secret: true },
      {
        key: 'accountType',
        label: 'Account type',
        type: 'select',
        default: 'broker',
        options: [
          { label: 'Broker (flats / PG)', value: 'broker' },
          { label: 'Builder (projects)', value: 'builder' },
        ],
      },
      { key: 'listingIds', label: 'Flat / project IDs (optional)', type: 'text', help: 'सिर्फ़ इन listings की leads चाहिए तो comma से अलग IDs डालें' },
    ],
    usedFor: ['Housing.com leads (direct API)'],
    testable: true,
  },
  {
    key: 'meta_leads',
    name: 'Facebook & Instagram Lead Ads',
    category: 'leads',
    scope: 'organization',
    description: 'आपके Facebook/Instagram lead-form ads की leads तुरंत BrokerIQ में।',
    freeTier: 'Free',
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving',
    steps: [
      'developers.facebook.com पर Business type app बनाइए (WhatsApp वाला app भी चलेगा)।',
      'App में "Webhooks" product जोड़ें → object "Page" चुनें → Callback URL और Verify token इस page पर Save के बाद दिखेंगे → field "leadgen" subscribe करें।',
      'Graph API Explorer (developers.facebook.com/tools/explorer) में अपना app चुनें → "Get Page Access Token" → permissions: pages_show_list, pages_read_engagement, pages_manage_metadata, leads_retrieval।',
      'Token को Access Token Debugger में "Extend" करके long-lived token बनाइए और नीचे भरें, साथ में Page ID भी।',
      'Save करते ही BrokerIQ आपकी page को app से subscribe कर देगा।',
    ],
    fields: [
      { key: 'pageId', label: 'Facebook Page ID', type: 'text', required: true },
      { key: 'pageAccessToken', label: 'Page access token (long-lived)', type: 'password', required: true, secret: true },
      { key: 'appSecret', label: 'App secret', type: 'password', secret: true },
    ],
    usedFor: ['Facebook/Instagram lead ads'],
    testable: true,
  },
  // ---------------------------------------------------------------- Maps / Push / Monitoring
  {
    key: 'maptiler',
    name: 'MapTiler (Maps)',
    category: 'maps',
    scope: 'platform',
    description: 'Website और app के sundar maps (बिना key के OpenStreetMap default tiles चलते हैं)।',
    freeTier: '100,000 map loads/month free',
    docsUrl: 'https://docs.maptiler.com/cloud/api/authentication-key/',
    steps: [
      'https://cloud.maptiler.com/auth/widget?next=/ पर free account बनाइए।',
      'Account → "API keys" → default key copy करें (चाहें तो allowed origins में अपनी website जोड़ें)।',
      'Key नीचे paste करें।',
    ],
    fields: [
      { key: 'apiKey', label: 'API key', type: 'text', required: true, public: true },
      { key: 'style', label: 'Map style', type: 'text', default: 'streets-v2', public: true },
    ],
    usedFor: ['Map search', 'Locality maps', 'Property location'],
    testable: false,
  },
  {
    key: 'expo_push',
    name: 'Push notifications (Expo)',
    category: 'push',
    scope: 'platform',
    description: 'Mobile app पर नई lead, reminders और messages की push notifications.',
    freeTier: 'Free',
    docsUrl: 'https://docs.expo.dev/push-notifications/fcm-credentials/',
    steps: [
      'https://expo.dev पर free account बनाइए और mobile app को eas init से project से जोड़ें।',
      'Firebase console (console.firebase.google.com) → project बनाइए → Android app (package com.brokeriq.app) जोड़ें → google-services.json download करके apps/mobile में रखें।',
      'Firebase → Project settings → Service accounts → "Generate new private key" → यह JSON "eas credentials" → Android → FCM V1 में upload करें।',
      'expo.dev → Account settings → Access tokens → "Create token" → नीचे paste करें (Enhanced push security के लिए; वैकल्पिक)।',
    ],
    fields: [{ key: 'accessToken', label: 'Expo access token (optional)', type: 'password', secret: true }],
    usedFor: ['Mobile push notifications'],
    testable: false,
  },
  {
    key: 'sentry',
    name: 'Sentry (Error monitoring)',
    category: 'monitoring',
    scope: 'platform',
    description: 'Production errors की तुरंत जानकारी।',
    freeTier: '5,000 errors/month free',
    docsUrl: 'https://docs.sentry.io/concepts/key-terms/dsn-explainer/',
    steps: [
      'https://sentry.io पर free account बनाइए → "Create project" → Node.js।',
      'Settings → Projects → project → "Client Keys (DSN)" → DSN copy करके नीचे भरें।',
    ],
    fields: [{ key: 'dsn', label: 'DSN', type: 'url', required: true }],
    usedFor: ['Error tracking'],
    testable: false,
  },
];

export const INTEGRATION_MAP: Record<string, IntegrationDef> = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i]));

export function getIntegration(key: string): IntegrationDef | undefined {
  return INTEGRATION_MAP[key];
}

export function settingsPathFor(def: Pick<IntegrationDef, 'key' | 'scope'>): string {
  return def.scope === 'platform' ? `/admin/settings/integrations?key=${def.key}` : `/broker/connectors?key=${def.key}`;
}

/** Fill {API_URL} placeholders in steps */
export function renderSteps(def: IntegrationDef, apiUrl: string): string[] {
  return def.steps.map((s) => s.split(API).join(apiUrl.replace(/\/$/, '')));
}
