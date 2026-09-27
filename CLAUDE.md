# BrokerIQ — Claude instructions

## भाषा (permanent)
- User को **हमेशा हिंदी में जवाब देना है** (Devanagari; technical शब्द English में रह सकते हैं)।

## Repo map
- `apps/api` — NestJS 11 + Prisma 6 + PostgreSQL. Global prefix `/api`. All routes are JWT-protected unless marked `@Public()`.
- `apps/web` — Next.js (App Router): public marketplace site, `/account` (user), `/broker` (broker CRM), `/admin` (super admin).
- `apps/mobile` — Expo (expo-router) app with User mode and Broker mode.
- `packages/shared` — Zod schemas, enums, API types, integration registry (credential fields + how-to steps), error codes. Build it before API (`pnpm --filter @brokeriq/shared build`).

## Rules
- No mock / demo data anywhere. Only real master data (Gurgaon localities, taxonomies, plans) is seeded.
- Credentials never go in code: they live in Super Admin → Settings (encrypted `SystemSetting`) or broker-level `OrgSetting`, resolved via `ConfigResolver` (org → platform → env).
- When a required integration is missing, throw `IntegrationNotConfiguredException`; clients render the `INTEGRATION_NOT_CONFIGURED` error with a link to the settings page.
- Commit and push after completing each module.

## Commands
- `pnpm install` · `pnpm -r typecheck` · `pnpm --filter @brokeriq/api test:e2e` (needs `DATABASE_URL`)
- API dev: `pnpm --filter @brokeriq/api dev` · Web dev: `pnpm --filter @brokeriq/web dev` · Mobile: `pnpm --filter @brokeriq/mobile start`
