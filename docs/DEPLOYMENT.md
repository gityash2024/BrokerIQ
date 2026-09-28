# 🚀 Deployment guide — Railway (API + Postgres) · Vercel (website) · EAS (Android app)

Launch cost ₹0 से शुरू: Railway trial, Vercel Hobby, और Expo EAS free tier। सारी third-party keys बाद में **Super Admin → Credentials center** से भरी जाती हैं (देखें [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md))।

```
Mobile app (Expo) ──┐
                    ├──►  API  (NestJS, Railway)  ──►  PostgreSQL (Railway)
Website (Vercel) ───┘           │
                                ├── Cloudinary / R2 (photos)      ├── Groq / Gemini (AI)
                                ├── Brevo / Gmail SMTP (OTP)      ├── Razorpay (payments)
                                └── WhatsApp Cloud API, IMAP (portal leads), Expo push
```

---

## 0. ✅ Live setup: DigitalOcean self-host (web + API + DB + media एक server पर)

Production अब DigitalOcean droplet पर चलता है: `https://brokeriq.mymultimeds.com` (website) और `https://brokeriqapi.mymultimeds.com` (API)। Photos/documents Cloudinary की जगह server की disk पर **compressed + encrypted** रहते हैं (API env `MEDIA_ROOT`)। पूरी जानकारी, backups और restore: [deploy/digitalocean/README.md](../deploy/digitalocean/README.md)।

नीचे के Railway / Vercel steps सिर्फ़ विकल्प के तौर पर रखे गए हैं।

---

## 1. API + Postgres on Railway

1. https://railway.com पर GitHub से login करें → **New Project → Deploy PostgreSQL**।
2. उसी project में **+ New → GitHub Repo → `BrokerIQ`** चुनें (Railway GitHub app को repo access दें)।
3. Service **Settings**:
   - **Root directory:** खाली छोड़ें (repo root)। Railway `apps/api/railway.json` पढ़कर `apps/api/Dockerfile` से build करेगा।
     अगर Railway config file न पढ़े, तो **Settings → Config-as-code → Railway config file** = `apps/api/railway.json` डालें।
   - **Branch:** जिस branch से deploy करना है (जैसे `main`)।
4. **Variables** tab में ये डालें:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` का output |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` का दूसरा output |
| `ENCRYPTION_MASTER_KEY` | `openssl rand -hex 32` — ⚠️ launch के बाद **कभी मत बदलें** (encrypted credentials इसी पर निर्भर हैं) |
| `SUPER_ADMIN_EMAIL` | आपका admin email |
| `SUPER_ADMIN_PASSWORD` | मज़बूत password (8+ अक्षर) |
| `PUBLIC_API_URL` | Railway domain, जैसे `https://brokeriq-api.up.railway.app` |
| `PUBLIC_WEB_URL` | Vercel/website domain, जैसे `https://brokeriq.in` |
| `CORS_ORIGINS` | website URL(s), comma-separated |

5. **Settings → Networking → Generate domain** → यही `PUBLIC_API_URL` है।
6. Deploy होने पर container अपने-आप चलाता है: `prisma migrate deploy` → seed (99 Gurgaon localities, amenities, plans, templates, super admin) → API।
7. Check: `https://<api-domain>/api/health` → `{"status":"ok","db":"ok"}` और Swagger docs `https://<api-domain>/api/docs`।

**Webhook URLs** (Credentials/connectors pages पर copy-button के साथ दिखते हैं):
- Razorpay: `https://<api-domain>/api/billing/razorpay/webhook`
- WhatsApp: `https://<api-domain>/api/webhooks/whatsapp/<firm-key>`
- Portal/website leads: `https://<api-domain>/api/webhooks/leads/<firm-key>`

> 💡 पूरा ₹0 चाहिए (Railway trial के बाद): API को Render free web service पर (same Dockerfile) और database को Neon free पर चलाएँ। सिर्फ़ `DATABASE_URL` बदलना है।

## 2. Website on Vercel

1. https://vercel.com → **Add New → Project → Import `BrokerIQ`**।
2. **Root Directory:** `apps/web`। Framework अपने-आप Next.js आएगा। `apps/web/vercel.json` पहले monorepo का `shared` package build करता है।
3. **Environment variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | API domain **बिना** `/api` के, जैसे `https://brokeriq-api.up.railway.app` |
| `NEXT_PUBLIC_SITE_URL` | website का final URL, जैसे `https://brokeriq.in` |

4. Deploy → अपना domain जोड़ें (Settings → Domains) → Railway में `PUBLIC_WEB_URL` और `CORS_ORIGINS` उसी domain पर update करें।
5. `https://<site>/login` पर `SUPER_ADMIN_EMAIL` से login करें → `/admin` → **Credentials center** में keys भरें।

> ⚠️ Vercel Hobby plan commercial use के लिए नहीं है। Revenue शुरू होने पर Vercel Pro लें, या Cloudflare Pages / Railway पर `next start` चलाएँ।

## 3. Android app (Expo EAS)

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas init                      # EAS project बनाता है; मिला projectId env EAS_PROJECT_ID में रखें
# eas.json में EXPO_PUBLIC_API_URL = https://<api-domain>/api   (ध्यान दें: यहाँ /api के साथ)
eas build -p android --profile preview      # installable APK (testing)
eas build -p android --profile production   # Play Store के लिए AAB
eas submit -p android                       # Play Console upload (Google Play developer account ज़रूरी)
```

- **Push notifications:** Android के लिए Firebase project बनाकर `google-services.json` EAS credentials में जोड़ें (`eas credentials`)। Expo push token API को अपने-आप भेजा जाता है।
- **Force update:** Super Admin → App config → Mobile app versions में `minVersion` बढ़ाएँ। पुराने app पर "Update करें" screen आएगी।
- **Google login (app):** Credentials center → Google Sign-In में Android client ID भरें (SHA-1 `eas credentials` से मिलता है)।

## 4. Launch checklist

- [ ] `/api/health` green, `/api/docs` खुलता है
- [ ] Super Admin login → Credentials center: SMTP ✅, Cloudinary ✅, Groq ✅ (Test connection)
- [ ] App config: site name, support phone/WhatsApp, company GSTIN (invoices के लिए)
- [ ] Homepage builder: sections order/on-off, sponsored banner
- [ ] Pages: Terms और Privacy लिखकर **Published** करें (seed में draft हैं)
- [ ] Razorpay live keys + webhook → plans/boost payment test
- [ ] एक test broker account: onboarding → connectors (IMAP / webhook) → test lead आती है
- [ ] Android preview APK install करके login, search, post property, broker leads check करें

## 5. Local development

```bash
docker compose up -d                        # Postgres 16
cp apps/api/.env.example apps/api/.env      # DATABASE_URL वगैरह
pnpm install
pnpm --filter @brokeriq/shared build
pnpm --filter @brokeriq/api exec prisma migrate deploy
pnpm --filter @brokeriq/api seed
pnpm --filter @brokeriq/api dev             # http://localhost:3000/api
pnpm --filter @brokeriq/web dev             # http://localhost:3001
pnpm --filter @brokeriq/mobile start        # Expo (EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000/api)
```
