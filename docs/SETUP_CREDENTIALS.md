# 🔑 Credentials setup guide (सब free tier)

> यह file `scripts/gen-credentials-doc.mjs` से **integration registry** (`packages/shared/src/integrations/registry.ts`) से अपने-आप बनती है।
> यही steps website पर **Super Admin → Credentials center** और **Broker → Lead connectors** में भी दिखते हैं।

**नियम:**
- कोई भी key code या git में नहीं जाती। सब Super Admin panel से भरें। Database में AES-256-GCM से encrypted save होती हैं।
- `<YOUR-API-URL>` की जगह अपना API URL लिखें (जैसे `https://brokeriq-api.up.railway.app`)।
- हर integration भरने के बाद **Test connection** दबाएँ।
- कोई integration नहीं भरा है, तो app साफ़ error दिखाता है: "Super Admin → Settings → … में जोड़ें"।

## Launch के लिए priority

| # | Integration | क्यों |
|---|---|---|
| 1 | Email (SMTP) | Email OTP login, alerts, invites |
| 2 | Cloudinary (या S3/R2) | Property photos, KYC, logos |
| 3 | Groq (+ Gemini fallback) | AI book scanner, descriptions, lead insights |
| 4 | Razorpay | Revenue: broker plans, listing boosts |
| 5 | Google Sign-In | एक-click login |
| 6 | MapTiler | बेहतर maps (बिना key के OpenStreetMap चलता है) |
| 7 | WhatsApp (platform) | Brokers के connect होने तक shared number |
| 8 | Expo push / Sentry | Push notifications / error monitoring |

---

## A. Platform integrations (Super Admin → Credentials center)

### Email (SMTP)

Login OTP, notifications, lead alerts और receipts भेजने के लिए email server.

- **Free tier:** Brevo: 300 emails/day free · Gmail: ~500/day free
- **किस काम आता है:** Email OTP login, Lead alerts, Team invites, Receipts
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://help.brevo.com/hc/en-us/articles/7924908994450

**Steps:**

1. https://www.brevo.com पर free account बनाइए (credit card नहीं चाहिए)।
2. ऊपर दाईं ओर नाम पर क्लिक करें → "SMTP & API" → "SMTP" tab खोलें।
3. "Generate a new SMTP key" दबाएँ, नाम "BrokerIQ" दें और key copy कर लें (यही Password है)।
4. इसी page पर दिख रहा "SMTP Server" (smtp-relay.brevo.com), "Port" (587) और "Login" नीचे भरें।
5. "Senders, Domains & Dedicated IPs" → "Senders" में अपना From email जोड़कर verify करें।
6. विकल्प (Gmail): Google Account → Security → 2-Step Verification ON → "App passwords" → नया password बनाएँ; Host smtp.gmail.com, Port 465, Secure = ON।
7. Save करके "Test connection" दबाएँ — आपकी email पर test mail आना चाहिए।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| SMTP host | `host` | हाँ | — |
| Port | `port` | हाँ | — |
| Secure (SSL, port 465) | `secure` | — | — |
| Username / Login | `user` | हाँ | — |
| Password / SMTP key | `pass` | हाँ | 🔒 encrypted |
| From email | `fromEmail` | हाँ | — |
| From name | `fromName` | — | — |

Env fallback (optional): `INTEGRATION_SMTP_<FIELD>` (जैसे `INTEGRATION_SMTP_HOST`)

---

### Cloudinary (Images & Files)

Property photos, videos, brochures, KYC documents का upload और fast CDN.

- **Free tier:** 25 credits/month free (~25GB storage या bandwidth)
- **किस काम आता है:** Property photos, Post property, KYC upload, Broker logo, Listing-book scanner
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://cloudinary.com/documentation/how_to_integrate_cloudinary

**Steps:**

1. https://cloudinary.com/users/register_free पर free account बनाइए।
2. Login के बाद Dashboard (Programmable Media) खोलें।
3. "Product Environment Credentials" में Cloud name, API Key और API Secret दिखेंगे (Settings → API Keys में भी)।
4. तीनों नीचे भरें, folder name चाहें तो बदलें, Save → "Test connection"।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Cloud name | `cloudName` | हाँ | public (app/web को मिलता है) |
| API key | `apiKey` | हाँ | — |
| API secret | `apiSecret` | हाँ | 🔒 encrypted |
| Folder | `folder` | — | — |

Env fallback (optional): `INTEGRATION_CLOUDINARY_<FIELD>` (जैसे `INTEGRATION_CLOUDINARY_CLOUDNAME`)

---

### S3-compatible storage (R2 / Spaces / AWS)

Cloudinary का विकल्प — Cloudflare R2 (10GB free), DigitalOcean Spaces या AWS S3.

- **Free tier:** Cloudflare R2: 10GB storage free, egress free
- **किस काम आता है:** Media uploads (Cloudinary न हो तब)
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://developers.cloudflare.com/r2/api/s3/tokens/

**Steps:**

1. Cloudflare dashboard → R2 → "Create bucket" (नाम: brokeriq-media)।
2. Bucket → Settings → "Public access" → r2.dev subdomain enable करें; वह URL "Public base URL" में डालें।
3. R2 overview → "Manage R2 API Tokens" → "Create API token" → permission "Object Read & Write"।
4. Access Key ID, Secret Access Key और Endpoint (https://<account-id>.r2.cloudflarestorage.com) नीचे भरें; Region = auto।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Endpoint | `endpoint` | हाँ | — |
| Region | `region` | — | — |
| Bucket | `bucket` | हाँ | — |
| Access key ID | `accessKeyId` | हाँ | — |
| Secret access key | `secretAccessKey` | हाँ | 🔒 encrypted |
| Public base URL | `publicBaseUrl` | हाँ | public (app/web को मिलता है) |

Env fallback (optional): `INTEGRATION_S3_<FIELD>` (जैसे `INTEGRATION_S3_ENDPOINT`)

---

### Groq AI

Listing-book scanner (photo → listings), lead summary, reply suggestions, property description writer.

- **Free tier:** Free tier with generous daily limits
- **किस काम आता है:** AI scanner, Lead summary, Reply suggestions, Description writer, Lead scoring
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://console.groq.com/docs/quickstart

**Steps:**

1. https://console.groq.com पर Google/email से login करें।
2. बाएँ menu में "API Keys" → "Create API Key" → नाम BrokerIQ → key copy करें (दोबारा नहीं दिखेगी)।
3. Key नीचे paste करें। Models default ठीक हैं; Groq के "Models" page से नए model नाम बदल सकते हैं।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| API key | `apiKey` | हाँ | 🔒 encrypted |
| Text model | `textModel` | — | — |
| Vision model (scanner) | `visionModel` | — | — |

Env fallback (optional): `INTEGRATION_GROQ_<FIELD>` (जैसे `INTEGRATION_GROQ_APIKEY`)

---

### Google Gemini AI

Groq का backup AI provider (vision + text).

- **Free tier:** Google AI Studio free tier
- **किस काम आता है:** AI features (Groq न हो तब)
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://ai.google.dev/gemini-api/docs/api-key

**Steps:**

1. https://aistudio.google.com खोलें और Google account से login करें।
2. "Get API key" → "Create API key" → project चुनें → key copy करें।
3. Key नीचे paste करें, Save → Test।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| API key | `apiKey` | हाँ | 🔒 encrypted |
| Model | `model` | — | — |

Env fallback (optional): `INTEGRATION_GEMINI_<FIELD>` (जैसे `INTEGRATION_GEMINI_APIKEY`)

---

### Razorpay

Broker subscriptions, listing boosts और invoices के payments.

- **Free tier:** कोई monthly fee नहीं — सिर्फ per-transaction charge
- **किस काम आता है:** Broker subscription checkout, Listing boosts
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/

**Steps:**

1. https://dashboard.razorpay.com पर account बनाइए (शुरुआत Test mode में)।
2. Account & Settings → "API Keys" → "Generate Key" → Key ID और Key Secret copy करें।
3. Account & Settings → "Webhooks" → "Add New Webhook" → URL: <YOUR-API-URL>/api/billing/razorpay/webhook
4. Webhook का Secret खुद बनाइए (कोई भी लंबा password) और events चुनें: payment.captured, payment.failed, order.paid।
5. KYC पूरा होने के बाद Live mode की keys से यही दोबारा भरें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Key ID | `keyId` | हाँ | public (app/web को मिलता है) |
| Key secret | `keySecret` | हाँ | 🔒 encrypted |
| Webhook secret | `webhookSecret` | हाँ | 🔒 encrypted |

Env fallback (optional): `INTEGRATION_RAZORPAY_<FIELD>` (जैसे `INTEGRATION_RAZORPAY_KEYID`)

---

### Google Sign-In

Website और app पर "Continue with Google" login.

- **Free tier:** पूरी तरह free
- **किस काम आता है:** Google login (web + app)
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

**Steps:**

1. https://console.cloud.google.com खोलें → ऊपर project dropdown → "New Project" (नाम: BrokerIQ)।
2. "APIs & Services" → "OAuth consent screen" → External चुनें → App name, support email, logo भरें → Save → "Publish app"।
3. "Credentials" → "Create credentials" → "OAuth client ID" → Application type "Web application"।
4. "Authorized JavaScript origins" में अपनी website का URL डालें (जैसे https://brokeriq.vercel.app और http://localhost:3001)।
5. Create करने पर जो "Client ID" मिले उसे नीचे "Web client ID" में paste करें।
6. Android app के लिए: फिर से "OAuth client ID" → type "Android" → Package name com.brokeriq.app और SHA-1 (eas credentials से) → Client ID नीचे "Android client ID" में डालें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Web client ID | `webClientId` | हाँ | public (app/web को मिलता है) |
| Android client ID | `androidClientId` | — | public (app/web को मिलता है) |
| iOS client ID | `iosClientId` | — | public (app/web को मिलता है) |

Env fallback (optional): `INTEGRATION_GOOGLE_OAUTH_<FIELD>` (जैसे `INTEGRATION_GOOGLE_OAUTH_WEBCLIENTID`)

---

### MapTiler (Maps)

Website और app के sundar maps (बिना key के OpenStreetMap default tiles चलते हैं)।

- **Free tier:** 100,000 map loads/month free
- **किस काम आता है:** Map search, Locality maps, Property location
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://docs.maptiler.com/cloud/api/authentication-key/

**Steps:**

1. https://cloud.maptiler.com/auth/widget?next=/ पर free account बनाइए।
2. Account → "API keys" → default key copy करें (चाहें तो allowed origins में अपनी website जोड़ें)।
3. Key नीचे paste करें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| API key | `apiKey` | हाँ | public (app/web को मिलता है) |
| Map style | `style` | — | public (app/web को मिलता है) |

Env fallback (optional): `INTEGRATION_MAPTILER_<FIELD>` (जैसे `INTEGRATION_MAPTILER_APIKEY`)

---

### WhatsApp Cloud API (Platform number)

BrokerIQ का अपना WhatsApp number — जिन brokers ने अपना number नहीं जोड़ा उनके लिए fallback और platform alerts.

- **Free tier:** User के message के 24 घंटे के अंदर replies free; template messages Meta के rate से
- **किस काम आता है:** Platform WhatsApp alerts, Fallback for brokers
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

**Steps:**

1. https://developers.facebook.com → "My Apps" → "Create App" → use case "Other" → type "Business"।
2. App dashboard में "WhatsApp" product add करें → "API Setup" खोलें।
3. "Phone number ID" और "WhatsApp Business Account ID" copy करके नीचे भरें।
4. "Add phone number" से अपना business number जोड़ें और OTP से verify करें (वह number WhatsApp app पर active नहीं होना चाहिए)।
5. Permanent token: business.facebook.com → Business Settings → Users → "System users" → Add (Admin) → "Assign assets" में app और WhatsApp account (Full control) → "Generate new token" → permissions whatsapp_business_messaging + whatsapp_business_management → Expiry "Never"।
6. App settings → Basic → "App Secret" copy करें।
7. WhatsApp → Configuration → Webhook: Callback URL <YOUR-API-URL>/api/webhooks/whatsapp/platform और Verify token नीचे वाला → "messages" field subscribe करें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Phone number ID | `phoneNumberId` | हाँ | — |
| WhatsApp Business Account ID | `businessAccountId` | हाँ | — |
| Permanent access token | `accessToken` | हाँ | 🔒 encrypted |
| App secret | `appSecret` | — | 🔒 encrypted |
| Webhook verify token | `verifyToken` | हाँ | — |
| Display phone number | `displayPhone` | — | public (app/web को मिलता है) |

Env fallback (optional): `INTEGRATION_WHATSAPP_PLATFORM_<FIELD>` (जैसे `INTEGRATION_WHATSAPP_PLATFORM_PHONENUMBERID`)

---

### Push notifications (Expo)

Mobile app पर नई lead, reminders और messages की push notifications.

- **Free tier:** Free
- **किस काम आता है:** Mobile push notifications
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://docs.expo.dev/push-notifications/fcm-credentials/

**Steps:**

1. https://expo.dev पर free account बनाइए और mobile app को eas init से project से जोड़ें।
2. Firebase console (console.firebase.google.com) → project बनाइए → Android app (package com.brokeriq.app) जोड़ें → google-services.json download करके apps/mobile में रखें।
3. Firebase → Project settings → Service accounts → "Generate new private key" → यह JSON "eas credentials" → Android → FCM V1 में upload करें।
4. expo.dev → Account settings → Access tokens → "Create token" → नीचे paste करें (Enhanced push security के लिए; वैकल्पिक)।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Expo access token (optional) | `accessToken` | — | 🔒 encrypted |

Env fallback (optional): `INTEGRATION_EXPO_PUSH_<FIELD>` (जैसे `INTEGRATION_EXPO_PUSH_ACCESSTOKEN`)

---

### Sentry (Error monitoring)

Production errors की तुरंत जानकारी।

- **Free tier:** 5,000 errors/month free
- **किस काम आता है:** Error tracking
- **कहाँ भरें:** Website → `/admin/settings/integrations`
- **Official docs:** https://docs.sentry.io/concepts/key-terms/dsn-explainer/

**Steps:**

1. https://sentry.io पर free account बनाइए → "Create project" → Node.js।
2. Settings → Projects → project → "Client Keys (DSN)" → DSN copy करके नीचे भरें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| DSN | `dsn` | हाँ | — |

Env fallback (optional): `INTEGRATION_SENTRY_<FIELD>` (जैसे `INTEGRATION_SENTRY_DSN`)


---

## B. Broker integrations (हर broker firm अपना भरेगी → Broker → Lead connectors)

### My WhatsApp Business number

आपके अपने WhatsApp Business number से leads को automatic messages, team inbox और templates.

- **Free tier:** User के message के 24 घंटे के अंदर replies free; template messages Meta के rate से
- **किस काम आता है:** Auto WhatsApp replies to new leads, Team WhatsApp inbox, Templates & drip campaigns
- **कहाँ भरें:** Website → `/broker/connectors` (firm admin)
- **Official docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

**Steps:**

1. https://developers.facebook.com → "My Apps" → "Create App" → type "Business" → WhatsApp product add करें।
2. "API Setup" में "Add phone number" से अपना business number जोड़ें और verify करें।
3. "Phone number ID" और "WhatsApp Business Account ID" नीचे भरें।
4. Permanent token: business.facebook.com → Business Settings → Users → System users → Add (Admin) → Assign assets (App + WhatsApp account, Full control) → Generate token (whatsapp_business_messaging, whatsapp_business_management, Expiry: Never)।
5. App settings → Basic → "App Secret" नीचे भरें।
6. Save करने के बाद इस page पर दिख रहा Webhook URL और Verify token, Meta में WhatsApp → Configuration → Webhook में डालें और "messages" subscribe करें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Phone number ID | `phoneNumberId` | हाँ | — |
| WhatsApp Business Account ID | `businessAccountId` | हाँ | — |
| Permanent access token | `accessToken` | हाँ | 🔒 encrypted |
| App secret | `appSecret` | — | 🔒 encrypted |
| Display phone number | `displayPhone` | — | — |

Env fallback (optional): `INTEGRATION_WHATSAPP_<FIELD>` (जैसे `INTEGRATION_WHATSAPP_PHONENUMBERID`)

---

### Portal leads via Email (Housing · 99acres · MagicBricks)

Housing.com, 99acres, MagicBricks, NoBroker की lead emails आपके inbox से अपने-आप पढ़कर leads बनाता है (हर 2 मिनट)।

- **Free tier:** Free
- **किस काम आता है:** Housing.com leads, 99acres leads, MagicBricks leads, NoBroker leads
- **कहाँ भरें:** Website → `/broker/connectors` (firm admin)
- **Official docs:** https://support.google.com/mail/answer/185833

**Steps:**

1. जिस email पर Housing / 99acres / MagicBricks की lead emails आती हैं, वही इस्तेमाल करें (portal की profile में यही email हो)।
2. Gmail: Settings (⚙) → "See all settings" → "Forwarding and POP/IMAP" → "Enable IMAP" → Save।
3. Google Account → Security → 2-Step Verification ON करें → "App passwords" → नया password (नाम BrokerIQ) बनाएँ।
4. नीचे Host imap.gmail.com, Port 993, Email और 16-अक्षर वाला App password भरें।
5. कौन-से portals पढ़ने हैं वो चुनें → Save → "Test connection" → "Sync now"।
6. Outlook/Zoho के लिए उनका IMAP host (outlook.office365.com / imap.zoho.in) इस्तेमाल करें।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| IMAP host | `host` | हाँ | — |
| Port | `port` | हाँ | — |
| SSL | `secure` | — | — |
| Email | `user` | हाँ | — |
| App password | `pass` | हाँ | 🔒 encrypted |
| Portals | `portals` | — | — |

Env fallback (optional): `INTEGRATION_EMAIL_INBOX_<FIELD>` (जैसे `INTEGRATION_EMAIL_INBOX_HOST`)

---

### Facebook & Instagram Lead Ads

आपके Facebook/Instagram lead-form ads की leads तुरंत BrokerIQ में।

- **Free tier:** Free
- **किस काम आता है:** Facebook/Instagram lead ads
- **कहाँ भरें:** Website → `/broker/connectors` (firm admin)
- **Official docs:** https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving

**Steps:**

1. developers.facebook.com पर Business type app बनाइए (WhatsApp वाला app भी चलेगा)।
2. App में "Webhooks" product जोड़ें → object "Page" चुनें → Callback URL और Verify token इस page पर Save के बाद दिखेंगे → field "leadgen" subscribe करें।
3. Graph API Explorer (developers.facebook.com/tools/explorer) में अपना app चुनें → "Get Page Access Token" → permissions: pages_show_list, pages_read_engagement, pages_manage_metadata, leads_retrieval।
4. Token को Access Token Debugger में "Extend" करके long-lived token बनाइए और नीचे भरें, साथ में Page ID भी।
5. Save करते ही BrokerIQ आपकी page को app से subscribe कर देगा।

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
| Facebook Page ID | `pageId` | हाँ | — |
| Page access token (long-lived) | `pageAccessToken` | हाँ | 🔒 encrypted |
| App secret | `appSecret` | — | 🔒 encrypted |

Env fallback (optional): `INTEGRATION_META_LEADS_<FIELD>` (जैसे `INTEGRATION_META_LEADS_PAGEID`)

