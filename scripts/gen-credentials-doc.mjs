// Generates docs/SETUP_CREDENTIALS.md from the integration registry (single source of truth).
// Usage: pnpm --filter @brokeriq/shared build && node scripts/gen-credentials-doc.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { INTEGRATIONS } = require('../packages/shared/dist/index.js');

const API = '<YOUR-API-URL>';
const PRIORITY = ['smtp', 'cloudinary', 's3', 'groq', 'gemini', 'razorpay', 'google_oauth', 'maptiler', 'whatsapp_platform', 'expo_push', 'sentry'];
const platform = INTEGRATIONS.filter((i) => i.scope === 'platform').sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
const org = INTEGRATIONS.filter((i) => i.scope === 'organization');

const section = (i, where) => {
  const fields = i.fields
    .map((f) => `| ${f.label} | \`${f.key}\` | ${f.required ? 'हाँ' : '—'} | ${f.secret ? '🔒 encrypted' : f.public ? 'public (app/web को मिलता है)' : '—'} |`)
    .join('\n');
  const steps = i.steps.map((s, n) => `${n + 1}. ${s.replaceAll('{API_URL}', API)}`).join('\n');
  return `### ${i.name}

${i.description}

- **Free tier:** ${i.freeTier}
- **किस काम आता है:** ${i.usedFor.join(', ')}
- **कहाँ भरें:** ${where}
- **Official docs:** ${i.docsUrl}

**Steps:**

${steps}

| Field | Key | ज़रूरी | Storage |
|---|---|---|---|
${fields}

Env fallback (optional): \`INTEGRATION_${i.key.toUpperCase()}_<FIELD>\` (जैसे \`INTEGRATION_${i.key.toUpperCase()}_${i.fields[0].key.toUpperCase()}\`)
`;
};

const md = `# 🔑 Credentials setup guide (सब free tier)

> यह file \`scripts/gen-credentials-doc.mjs\` से **integration registry** (\`packages/shared/src/integrations/registry.ts\`) से अपने-आप बनती है।
> यही steps website पर **Super Admin → Credentials center** और **Broker → Lead connectors** में भी दिखते हैं।

**नियम:**
- कोई भी key code या git में नहीं जाती। सब Super Admin panel से भरें। Database में AES-256-GCM से encrypted save होती हैं।
- \`${API}\` की जगह अपना API URL लिखें (जैसे \`https://brokeriq-api.up.railway.app\`)।
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

${platform.map((i) => section(i, 'Website → `/admin/settings/integrations`')).join('\n---\n\n')}

---

## B. Broker integrations (हर broker firm अपना भरेगी → Broker → Lead connectors)

${org.map((i) => section(i, 'Website → `/broker/connectors` (firm admin)')).join('\n---\n\n')}
`;

writeFileSync(new URL('../docs/SETUP_CREDENTIALS.md', import.meta.url), md);
console.log(`docs/SETUP_CREDENTIALS.md written (${platform.length} platform + ${org.length} broker integrations)`);
