# BrokerIQ — Gurgaon property brokerage hub

BrokerIQ is a production-ready property marketplace and broker CRM for Gurgaon. It has three panels: **User** (buyers, tenants and owners), **Broker** (a firm plus its agents) and **Super Admin**. It ships as a website and an Android/iOS app.

- **Marketplace (website + app):** buy, rent, commercial and plots search with a map, locality guides with price trends, projects, broker microsites, property detail (gallery, EMI, contact, enquiry, chat), post property for free, saved homes and alerts, calculators, and a feedback/roadmap board.
- **Broker CRM:** a unified lead inbox (Housing, 99acres, MagicBricks and NoBroker email alerts over IMAP, Facebook/Instagram lead ads, a universal webhook, website, app and WhatsApp). It also covers a drag-and-drop pipeline, follow-ups and site visits (GPS check-in), deals and commission, and a WhatsApp team inbox (Cloud API, 24h window, templates). A no-code automation builder handles welcome messages, round-robin assignment and drips. There is also an AI listing-book scanner, AI lead insights, team management, analytics, and plans and billing.
- **Super Admin:** a command center (MRR, growth, queues), a Credentials center with Hindi step-by-step guides and a test button, app config, feature flags, moderation, KYC, users and firms, and support. It also includes feedback management, broadcasts, plans, subscriptions, payments and coupons, a CMS (homepage builder, pages, blog, FAQs, templates), master data and an audit log, plus system health.
- **Revenue from day one:** broker subscriptions (Razorpay, GST invoices), paid listing boosts, and sponsored homepage banners and featured projects.

## Monorepo

| Path | What |
|---|---|
| `apps/api` | NestJS 11 + Prisma 6 + PostgreSQL. Global prefix `/api`, Swagger at `/api/docs` |
| `apps/web` | Next.js 16 (App Router): public site, `/account`, `/broker`, `/admin` |
| `apps/mobile` | Expo SDK 57 (expo-router): User mode and Broker mode |
| `packages/shared` | Zod schemas, enums/labels, API types, integration registry, utilities |
| `docs/` | [Deployment](docs/DEPLOYMENT.md) · [Credentials setup (Hindi)](docs/SETUP_CREDENTIALS.md) |

## Principles

- **No mock or demo data.** Only real master data is seeded: 99 Gurgaon localities, amenities, plans and templates.
- **Credentials are never in code.** They are saved from the admin panel (platform) or the broker panel (per firm) and stored with AES-256-GCM encryption. The resolution order is org, then platform, then env.
- **Missing integrations fail loudly.** The API returns `INTEGRATION_NOT_CONFIGURED` with the exact settings page, and the web and app show where to add it.
- **Zero-cost start.** Everything runs on free tiers: Brevo or Gmail SMTP OTP, Google login, Cloudinary or R2, Groq or Gemini, MapTiler or OSM, Expo push, Sentry, and a Postgres-backed job queue (no Redis).

## Quick start

```bash
docker compose up -d
cp apps/api/.env.example apps/api/.env
pnpm install && pnpm --filter @brokeriq/shared build
pnpm --filter @brokeriq/api exec prisma migrate deploy && pnpm --filter @brokeriq/api seed
pnpm --filter @brokeriq/api dev      # :3000
pnpm --filter @brokeriq/web dev      # :3001
pnpm --filter @brokeriq/mobile start
```

Log in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `apps/api/.env`, then open **/admin → Credentials center**.

## Checks

```bash
pnpm --filter @brokeriq/api typecheck && pnpm --filter @brokeriq/web typecheck && pnpm --filter @brokeriq/mobile typecheck
pnpm --filter @brokeriq/api test
DATABASE_URL=postgresql://.../brokeriq_test bash apps/api/test/setup-db.sh && pnpm --filter @brokeriq/api test:e2e
pnpm --filter @brokeriq/web build
cd apps/mobile && npx expo export --platform android
```

CI (`.github/workflows/ci.yml`) runs all of the above against a real Postgres on every push.
