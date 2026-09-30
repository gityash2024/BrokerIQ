# 🚀 Deployment guide — DigitalOcean self-host (web + API + DB + media) · Android app

Production एक DigitalOcean droplet पर चलता है, सब कुछ `/opt/brokeriq` folder के अंदर:

| Part | URL / जगह |
| --- | --- |
| Website (Next.js) | `https://brokeriq.mymultimeds.com` — pm2 `brokeriq-web` |
| API (NestJS) | `https://brokeriqapi.mymultimeds.com/api` — pm2 `brokeriq-api` |
| Database | PostgreSQL 14 cluster `brokeriq` (port 5433) |
| Photos/documents | Server disk, compressed + encrypted (`MEDIA_ROOT`) — Cloudinary की ज़रूरत नहीं |
| Cron | `/etc/cron.d/brokeriq` — रोज़ का encrypted backup + हर 2 मिनट watchdog |

Server setup, backups और restore की पूरी जानकारी: [deploy/digitalocean/README.md](../deploy/digitalocean/README.md)।

## 1. Deploy (web + API एक साथ)

```bash
ssh root@<server> /opt/brokeriq/bin/deploy.sh
```

- `feat/production` branch का latest commit लेता है (branch बदलनी हो: `BRANCH=<name> /opt/brokeriq/bin/deploy.sh`)।
- `pnpm install --frozen-lockfile` → shared build → Prisma migrations + idempotent seed → API/web build → pm2 reload → health check।
- Seed सिर्फ़ master data और defaults डालता है; admin के बदले हुए settings/pages कभी overwrite नहीं होते।

## 2. Monitoring

- **Admin → System health:** DB, jobs, integrations, **Errors** (API 5xx, website और app crashes, grouped) और **Cost & usage** (AI calls per provider, emails, WhatsApp, disk)।
- नई error, website down, DB धीमा, disk 85%+ या watchdog restart → Super Admins को in-app + email alert।
- Sentry optional: Credentials → Sentry में DSN डालें, errors वहाँ भी जाएँगे (SDK की ज़रूरत नहीं)।
- API docs (`/api/docs`) production में बंद हैं; ज़रूरत हो तो `secrets/api.env` में `SWAGGER_ENABLED=true`।

## 3. Android app

Release build local machine पर Gradle से बनता है (EAS की ज़रूरत नहीं) — steps और Play Store checklist: [docs/PLAY_STORE.md](./PLAY_STORE.md)।

- **Force update:** Super Admin → App config → Mobile app versions में `minVersion` बढ़ाएँ।
- **Push notifications:** Credentials → Expo push (optional access token)।

## 4. Launch checklist

- [ ] `/api/health` green; `/api/docs` बंद (404)
- [ ] Credentials: **OpenRouter** (free AI) ✅, SMTP (जैसे Brevo free) ✅, Google Sign-In (optional) — हर एक पर "Test"
- [ ] App config: site name, support email/phone/WhatsApp; **Free mode ON**; AI daily cap
- [ ] Pages: Privacy और Terms published (`/p/privacy`, `/p/terms`) — legal review के बाद ज़रूरत हो तो edit करें
- [ ] Feature flags: जो features launch पर नहीं चाहिए, OFF करें (sale listings default OFF)
- [ ] Broker invites: पहले brokers के लिए invite codes बनाएँ
- [ ] एक test broker: onboarding → listing → Housing/email connector → test lead
- [ ] Android release APK install करके login, search, post property, broker leads check करें

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
pnpm lint && pnpm -r typecheck              # code checks
pnpm --filter @brokeriq/api test:e2e        # API tests (DATABASE_URL = test DB)
```
