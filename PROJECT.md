# Project: BrokerIQ — Commercial Real-Estate SaaS Platform

## Architecture Overview
BrokerIQ is an enterprise-grade, multi-tenant SaaS CRM and automation platform tailored for Indian property brokers. It uses a high-performance Turborepo monorepo with pnpm workspaces comprising:
- `apps/api`: NestJS REST API with Prisma ORM, BullMQ queueing, Redis caching, Socket.io WebSockets, and AES-256-GCM encrypted credentials.
- `apps/mobile`: React Native + Expo mobile application utilizing Expo Router, NativeWind (Tailwind), React Native Reanimated, TanStack Query, and bilingual (EN/HI) localization.
- `apps/admin`: Next.js Super Admin portal with Tailwind CSS, role-gated administration, credential management, live provider testing, and platform analytics.
- `packages/shared`: Shared TypeScript types, Zod validation schemas, domain enums, regex validators, role permission matrices, and INR currency utilities.
- Infrastructure: Docker Compose orchestration (PostgreSQL 16, Redis 7, API, Admin) with health checks, Nginx reverse proxy, and environment variable configuration.

```
                              ┌────────────────────────────────────────┐
                              │           Nginx Reverse Proxy          │
                              │           (Port 80 -> Internal)        │
                              └───────┬───────────────────┬────────────┘
                                      │                   │
                     ┌────────────────▼────────┐ ┌────────▼──────────────┐
                     │   Next.js Admin Panel   │ │   React Native Expo   │
                     │       (apps/admin)      │ │      (apps/mobile)    │
                     └────────────────┬────────┘ └────────┬──────────────┘
                                      │                   │
                                      │  REST & Socket.io │
                                      ▼                   ▼
                     ┌─────────────────────────────────────────────────┐
                     │             NestJS REST API (apps/api)          │
                     │  - Multi-Tenant Row-Level Isolation Guards      │
                     │  - JWT Auth with Refresh Rotation & OTP         │
                     │  - 21 Scaffolded Business & Infrastructure Mod. │
                     │  - AES-256-GCM Encrypted Credential Vault       │
                     └───────────────┬───────────────────┬─────────────┘
                                     │                   │
                    ┌────────────────▼─────────┐ ┌───────▼───────────────┐
                    │ PostgreSQL 16 + Prisma   │ │ Redis 7 + BullMQ      │
                    │ (33 Models, Multi-Tenant)│ │ (Queues, Tokens, OTP) │
                    └──────────────────────────┘ └───────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Turborepo & pnpm Monorepo Setup | Turborepo pipeline, pnpm-workspace.yaml, package.json, TypeScript strict root configs | M1 | survey_backend |
| 2 | Shared Package (`@brokeriq/shared`) | Zod schemas, TypeScript types, 23 enums, constants, regex validators, INR currency helpers | M1 | survey_backend |
| 3 | Docker Compose & Containerization | Multi-container setup (api, admin, postgres, redis) with healthchecks and volumes | M1 | survey_backend |
| 4 | Nginx Reverse Proxy | Routing for `/api`, `/socket.io/`, and admin web interface | M1 | survey_backend |
| 5 | Environment Configuration Templates | `.env.example` across root, api, admin, and mobile with documented keys | M1 | survey_backend |
| 6 | Prisma Database Schema Core | 33 models across SaaS Core, CRM, Communication, Integrations, Automation, AI, Platform | M2 | survey_backend |
| 7 | Row-Level Multi-Tenancy Isolation | Mandatory `organizationId` foreign key and composite indices on all business entities | M2 | survey_backend |
| 8 | Soft Delete Architecture | `deletedAt DateTime?` on Customer, Lead, Property, FollowUp, SiteVisit | M2 | survey_backend |
| 9 | UTC Timestamps & Currency Format | `TIMESTAMPTZ` and `currency String @default("INR")` across all financial/temporal entities | M2 | survey_backend |
| 10 | Prisma Database Seed Script | Super Admin, Founder org, commercial plans, broker user, sample leads, properties, visits | M2 | survey_backend |
| 11 | JWT Auth & Refresh Token Rotation | Access tokens (15m) + refresh tokens (7d) with Redis token family rotation & breach detection | M3 | survey_backend |
| 12 | Dual Login Flow (Email & Phone/OTP) | Bcrypt email login and Redis-backed 6-digit OTP login with rate limiting | M3 | survey_backend |
| 13 | Role-Based Access Control (RBAC) | `SUPER_ADMIN`, `BROKER_ADMIN`, `BROKER_STAFF` roles with decorators and execution guards | M3 | survey_backend |
| 14 | Multi-Tenant Request Guard & Unit Test | Contextual tenant resolver rejecting cross-organization data access with automated test | M3 | survey_backend |
| 15 | 3-Tier Configuration Resolver | Priority resolution: (1) Tenant DB -> (2) Global Admin DB -> (3) Env Default | M3 | survey_backend |
| 16 | Security Middleware Suite | Helmet security headers, CORS origin whitelist, Throttler rate limiting | M3 | survey_backend |
| 17 | Swagger/OpenAPI Documentation | Complete interactive API documentation at `/api/docs` | M3 | survey_backend |
| 18 | Organizations & Users Modules | CRUD, suspend, reactivate, member management, profile, role assignment | M3 | survey_backend |
| 19 | Plans & Subscriptions Modules | Plans CRUD (FOUNDER, STARTER, PRO, BUSINESS), feature limits, subscription lifecycle | M3 | survey_backend |
| 20 | Customers & Leads Pipeline Modules | 9-stage pipeline (NEW to WON/LOST), stage transitions, assignment, organization scoping | M3 | survey_backend |
| 21 | Properties & Matching Engine Module | Properties CRUD, Housing.com sync, 6-factor matching (location, budget, BHK, type, area, furnishing) | M4 | survey_integrations |
| 22 | Follow-ups & Site Visits Modules | Scheduling, confirmation, completion, rescheduling, overdue detection | M4 | survey_integrations |
| 23 | Payment Provider Abstraction & Razorpay | `PaymentProvider` interface with Razorpay and Manual providers, webhooks, invoice generation | M4 | survey_integrations |
| 24 | AI Provider Abstraction & Groq | `AIProvider` interface with Groq implementation, PII sanitization layer, usage metering | M4 | survey_integrations |
| 25 | WhatsApp Meta Business Integration | WhatsApp Cloud API integration, templates, message tracking, automation triggers | M4 | survey_integrations |
| 26 | Housing.com Integration Engine | Webhook & polling lead ingestion, credential management, connection testing | M4 | survey_integrations |
| 27 | Automation & BullMQ Job Engine | Configurable automation rules, BullMQ job scheduler, delays, business hour enforcement | M4 | survey_integrations |
| 28 | Analytics & Reporting Module | Broker analytics (leads, conversion, response time) and Super Admin platform KPIs | M4 | survey_integrations |
| 29 | FCM Push Notifications & S3 Storage | Push notification delivery and DigitalOcean Spaces S3-compatible media storage | M4 | survey_integrations |
| 30 | Credential Vault & AES-256-GCM | Encrypted storage of third-party credentials, secret masking, connection testing, audit logs | M4 | survey_integrations |
| 31 | Audit Logging & Health Check Module | Audit log recorder for critical operations and system health endpoints (DB, Redis, Queue) | M4 | survey_integrations |
| 32 | WebSocket Gateway (Socket.io) | Real-time gateway for instant WhatsApp message delivery and broker push notifications | M4 | survey_integrations |
| 33 | React Native Mobile Navigation | Expo Router file-based routing with 5 tabs (Dashboard, Leads, Properties, Follow-ups, More) | M5 | survey_frontend_docs |
| 34 | Mobile Design System & Deep Teal Theme | Deep Teal (`#0F766E`), Emerald (`#059669`), Inter typography, 21 reusable UI components | M5 | survey_frontend_docs |
| 35 | Mobile State, Animation & i18n | TanStack Query, React Hook Form + Zod, Reanimated 150-300ms motion, English/Hindi i18n | M5 | survey_frontend_docs |
| 36 | Mobile Auth Flow & Dashboard Screens | Login (Email + OTP), token refresh, 8-metric Dashboard, quick actions, Subscription meters | M5 | survey_frontend_docs |
| 37 | Next.js Super Admin Authentication | SUPER_ADMIN-only email/password JWT login with route-level security guards | M6 | survey_frontend_docs |
| 38 | Admin Dashboard & Organization Mgmt | KPI metric cards, system alerts, organization CRUD, suspend/reactivate, trial extension | M6 | survey_frontend_docs |
| 39 | Admin Plan & Subscription Management | CRUD for all 4 plans, feature limits, pricing tiers, manual subscription billing | M6 | survey_frontend_docs |
| 40 | Admin Credential Center & System Settings| Masked credential vault, live connection testing, feature flags, system settings | M6 | survey_frontend_docs |
| 41 | Admin Platform Analytics & Audit Logs | Multi-tenant analytics, searchable audit log viewer, live service health monitors | M6 | survey_frontend_docs |
| 42 | Root Technical Documentation (11 Docs) | 11 comprehensive files at root (>= 200 lines each) covering architecture, schemas, guides | M7 | survey_frontend_docs |
| 43 | Dual Track E2E Test Suite | Requirement-driven test suite spanning Tiers 1-4 with test runner and TEST_READY.md | M7 | survey_frontend_docs |
| 44 | Acceptance Verification & Integrity Audit | Automated verification of all 33 criteria, build/test passes, and forensic auditor sign-off | Final | survey_frontend_docs |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Monorepo Foundation & Infrastructure | Features 1, 2, 3, 4, 5 (Turborepo, pnpm workspaces, shared package, Docker Compose, Nginx, .env) | none | PLANNED |
| M2 | PostgreSQL Database Schema & Seed | Features 6, 7, 8, 9, 10 (Prisma schema with 33 models, organizationId tenant isolation, soft delete, seed) | M1 | PLANNED |
| M3 | Auth, RBAC & Core Backend Modules | Features 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 (JWT rotation, OTP, RBAC, tenant guard + unit test, config resolver, Swagger, Core CRUD) | M2 | PLANNED |
| M4 | Backend Integrations, AI & Real-Time | Features 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 (Properties matching, Payments, AI Groq, WhatsApp, Housing, BullMQ, AES-256-GCM, Sockets) | M3 | PLANNED |
| M5 | React Native Mobile App Shell | Features 33, 34, 35, 36 (Expo Router, NativeWind, Deep Teal/Emerald theme, 21 components, TanStack Query, i18n, Auth, Dashboard) | M1, M3 | PLANNED |
| M6 | Next.js Super Admin Panel Shell | Features 37, 38, 39, 40, 41 (Next.js, Tailwind, Super Admin auth, Dashboard, Orgs, Plans, Credential Center, Settings, Health) | M1, M3 | PLANNED |
| M7 | Root Documentation & E2E Testing Suite| Features 42, 43 (11 markdown docs >= 200 lines, E2E test suite Tiers 1-4, TEST_READY.md) | M1 | PLANNED |
| Final | Final Integration & Acceptance Verification | Feature 44 (Pass all 33 acceptance criteria, Reviewer APPROVE, Challenger verified, Forensic Auditor CLEAN) | M1-M7 | PLANNED |

## Interface Contracts

### 1. Backend API (`apps/api`) ↔ Shared Package (`@brokeriq/shared`)
- **Imports**: Types, Zod validation schemas, Enums (`Role`, `LeadStage`, `PropertyType`, `PaymentStatus`, etc.), Constants.
- **Contract**: API validates incoming request bodies using Zod schemas imported from `@brokeriq/shared`.

### 2. Frontend Clients (`apps/mobile`, `apps/admin`) ↔ Backend API (`apps/api`)
- **Authentication**: `Authorization: Bearer <access_token>`, `X-Refresh-Token: <refresh_token>` or cookie.
- **Tenant Scope**: Injected automatically by JWT claims (`organizationId`, `userId`, `role`).
- **Standard API Envelope**:
  ```typescript
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
    meta?: {
      page?: number;
      limit?: number;
      total?: number;
    };
  }
  ```

### 3. Payment Provider Interface (`PaymentProvider`)
```typescript
interface PaymentProvider {
  createOrder(amount: number, currency: string, receipt: string, notes?: Record<string, string>): Promise<PaymentOrderResult>;
  verifyPayment(paymentId: string, orderId: string, signature: string): Promise<boolean>;
  processWebhook(payload: any, signature: string): Promise<WebhookResult>;
}
```

### 4. AI Provider Interface (`AIProvider`)
```typescript
interface AIProvider {
  generateReplySuggestion(conversationHistory: Array<{ role: string; content: string }>): Promise<string>;
  extractLeadFeatures(rawText: string): Promise<LeadExtractedFeatures>;
  summarizeConversation(messages: Array<{ role: string; content: string }>): Promise<string>;
}
```

### 5. Credential Encryption Engine (`EncryptionService`)
- Algorithm: `aes-256-gcm`.
- Format: `iv:authTag:ciphertext` encoded in hex or base64.
- Masking contract: API responses mask secrets (`••••••••••••` + last 4 characters).

## Code Layout
```
/Users/yashjangid/Desktop/BrokerIQ/
├── package.json                   # Root package.json with pnpm workspaces & turbo
├── pnpm-workspace.yaml            # Monorepo workspaces definition
├── turbo.json                     # Turborepo task pipeline configuration
├── docker-compose.yml             # Docker services (api, admin, postgres, redis)
├── nginx/
│   └── nginx.conf                 # Reverse proxy configuration
├── .env.example                   # Root environment configuration
├── packages/
│   └── shared/                    # Shared library (@brokeriq/shared)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types/
│           ├── schemas/
│           ├── enums/
│           └── constants/
├── apps/
│   ├── api/                       # NestJS API application
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Complete PostgreSQL schema (33 models)
│   │   │   └── seed.ts            # Development data seeder
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── common/            # Guards, decorators, filters, interceptors
│   │       └── modules/           # All 21 feature modules
│   ├── mobile/                    # React Native Expo application
│   │   ├── package.json
│   │   ├── app.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js     # NativeWind configuration (Deep Teal theme)
│   │   ├── .env.example
│   │   └── app/                   # Expo Router screens
│   │       ├── _layout.tsx
│   │       ├── (auth)/
│   │       └── (tabs)/
│   └── admin/                     # Next.js Super Admin application
│       ├── package.json
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── .env.example
│       └── src/
│           └── app/               # Next.js App Router pages
├── tests/                         # E2E test suite (Tiers 1-4)
│   ├── runner.sh
│   └── tier1..4/
├── ARCHITECTURE.md                # System architecture documentation
├── DESIGN_SYSTEM.md               # Design system & tokens documentation
├── DATABASE_SCHEMA.md             # Prisma database schema documentation
├── SAAS_ARCHITECTURE.md           # Multi-tenancy & subscriptions documentation
├── BILLING_ARCHITECTURE.md        # Payment provider & billing documentation
├── AI_ARCHITECTURE.md             # AI provider & sanitization documentation
├── SECURITY.md                    # Auth, encryption, & tenant isolation docs
├── DEPLOYMENT.md                  # Deployment & containerization documentation
├── INTEGRATIONS.md                # Third-party integrations documentation
├── API.md                         # REST API specification documentation
└── PROJECT_PROGRESS.md            # Live implementation progress tracker
```
