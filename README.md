# BrokerIQ

Broker-first workspace for Gurugram real-estate firms. NestJS API, Next.js web panel, Expo Android app, and a landing package served by the same web process.

## Launch navigation

Today · Inventory (including Area Directory) · Leads & Requirements · Inbox · Automation & Housing.

Super Admin: Overview · Broker Firms · Modules & Permissions · Integrations · System. Historical consumer and future-feature code is preserved behind module policies. Public signup is closed; new brokers require an invitation or an administrator-created account.

| Directory | Purpose |
| --- | --- |
| `apps/api` | NestJS 11, Prisma 6, PostgreSQL; `/api` |
| `apps/web` | Next.js 16; `/broker`, `/admin`, landing `/` |
| `apps/mobile` | Expo 57, native broker workflows and encrypted SQLite drafts |
| `apps/landing` | Reusable product website, served by web |
| `packages/shared` | Validated contracts, module registry, property/filter fields, translations |
| `deploy/digitalocean` | BrokerIQ-only deploy, checkpoint, backup and rollback tools |

## Development

```bash
pnpm install
pnpm --filter @brokeriq/shared build
pnpm --filter @brokeriq/api dev
pnpm --filter @brokeriq/web dev
pnpm --filter @brokeriq/mobile start
pnpm -r typecheck
```

Database migrations and seeds require an explicitly selected database. Never run tests against business data. Broker-first e2e runs need `BROKER_FIRST=true`; historical full-platform regressions use `BROKER_FIRST=false`. Web launch journeys use `apps/web/playwright.launch.config.ts` and refuse a database without the isolated test prefix.

## Data and integrations

No demo business data is seeded. Credentials are encrypted in platform/firm settings and resolved firm → platform → environment. Missing integrations return `INTEGRATION_NOT_CONFIGURED`. Launch AI uses free OpenRouter models only, with local OCR/manual review when unavailable. Provider messaging fees remain external.

Inventory stores units, contacts, prices and area units separately. Unknown values remain null; source review does not confirm current availability. Original register evidence and extraction datasets stay in private storage, outside Git. Directory records retain source identity and coordinate provenance; coverage is not exhaustive.

Current verification and remaining launch gates: [release progress](docs/RELEASE_PROGRESS.md). Directory sources and boundaries: [source documentation](docs/DIRECTORY_SOURCES.md). Deployment: [deployment guide](docs/DEPLOYMENT.md).
