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
- **Zero-Cache Build Policy**: Every time an APK or release build is made, ALWAYS purge all build caches first (`rm -rf apps/mobile/.expo apps/mobile/android/.gradle apps/mobile/android/app/build && rm -rf "$TMPDIR"/metro-* 2>/dev/null || true`), bump version/build number, run `./gradlew clean --no-daemon && ./gradlew assembleRelease --no-daemon --no-build-cache`, compute the SHA-256 hash, update the landing page and server environment, upload to production, and verify HTTP 200.
- **Role & Module Policy**: When adding or updating modules, ensure permissions are explicitly added to `PLATFORM_MODULES`, `defaultModulePolicies()`, and route resolution in `packages/shared/src/modules.ts`. Never assume agent access works without adding `BROKER_AGENT` to the module policy. Double-check visibility in Web sidebar, Web dashboard, Mobile bottom tabs, Mobile dashboard, and Mobile settings across all user roles (`BROKER_ADMIN`, `BROKER_AGENT`, `SUPER_ADMIN`).

## Commands
- `pnpm install` · `pnpm -r typecheck` · `pnpm --filter @brokeriq/api test:e2e` (needs `DATABASE_URL`)
- API dev: `pnpm --filter @brokeriq/api dev` · Web dev: `pnpm --filter @brokeriq/web dev` · Mobile: `pnpm --filter @brokeriq/mobile start`
