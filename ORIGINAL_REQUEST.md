# Original User Request

## 2026-09-26T10:02:12Z

Build "BrokerIQ" — a production-ready, multi-tenant SaaS CRM and automation platform for real-estate property brokers in India. This is the complete foundation of a commercial product: monorepo, backend API, mobile app shell, admin panel shell, database schema, Docker setup, auth, and documentation. Not a prototype — the foundation of a real commercial SaaS product.

Working directory: /Users/yashjangid/Desktop/BrokerIQ
Integrity mode: development

## Requirements

### R1. Monorepo Foundation & Infrastructure

Set up a Turborepo monorepo with pnpm workspaces containing:
- `apps/api` — NestJS (Node.js, TypeScript) REST API backend
- `apps/mobile` — React Native + Expo + TypeScript mobile app using Expo Router
- `apps/admin` — Next.js + TypeScript admin panel
- `packages/shared` — Shared TypeScript types, Zod schemas, constants, enums

Docker Compose setup with containers for: API, Admin, PostgreSQL, Redis. Include health checks. All configuration via environment variables (never hardcoded). Provide `.env.example` files. Nginx reverse proxy configuration.

### R2. Complete PostgreSQL Database Schema (Prisma)

Design and implement a comprehensive Prisma schema covering ALL of these entity groups with full relations:

**SaaS Core**: Organization, OrganizationMember, User, Plan, PlanFeature, FeatureLimit, FeatureFlag, Subscription, Payment, Invoice, UsageCounter, Coupon

**CRM**: Customer, Lead (stages: NEW → CONTACTED → INTERESTED → FOLLOW_UP → SITE_VISIT → NEGOTIATION → WON → LOST → NOT_INTERESTED), Property, PropertyOwner, FollowUp, SiteVisit, Task, Activity

**Communication**: Conversation, Message, WhatsAppTemplate

**Integrations**: Integration, IntegrationLog, WebhookEvent

**Automation**: AutomationRule, AutomationExecution

**AI**: AIResult, AIUsage

**Platform**: Notification, AuditLog, SystemSetting

Every business entity MUST have `organizationId` for row-level tenant isolation. Use soft deletion where business history is important. Store all timestamps in UTC. Currency fields must include a currency code column. Include Prisma seed script with: Super Admin user, Founder organization, sample broker user, sample properties, leads, customers, follow-ups, site visits.

### R3. Authentication, Authorization & Multi-Tenancy

Implement JWT-based authentication with refresh token rotation supporting both email/password AND phone/OTP login methods. Three roles: SUPER_ADMIN, BROKER_ADMIN, BROKER_STAFF. Complete RBAC middleware. Multi-tenant guards ensuring Organization A can NEVER access Organization B's data. Rate limiting. Secure HTTP headers. CORS configuration. API throttling.

Configuration priority: (1) Tenant-specific DB setting → (2) Global admin setting → (3) Environment default.

### R4. Backend API Modules (NestJS — All Scaffolded)

Scaffold ALL backend modules with controllers, services, DTOs, and Swagger/OpenAPI documentation:

- **Auth**: Login, register, refresh, logout, OTP
- **Organizations**: CRUD, suspend, reactivate, member management
- **Users**: Profile, role management
- **Plans**: CRUD, feature limits, feature flags management
- **Subscriptions**: Create, cancel, pause, resume, renew, grace period, trial
- **Payments**: Razorpay integration (PaymentProvider abstraction supporting future Stripe), webhooks, manual billing, invoices
- **Customers**: CRUD with organization scoping
- **Leads**: Full pipeline (NEW→WON/LOST), stage transitions, assignment
- **Properties**: CRUD, manual + Housing.com sync, property matching (location, budget, BHK, type, area, furnishing)
- **Follow-ups**: Create, schedule, complete, reschedule, overdue tracking
- **Site Visits**: Schedule, confirm, complete, cancel, no-show, reschedule
- **WhatsApp**: Meta Business API integration, incoming/outgoing messages, templates, media, status tracking, automation rules
- **Housing.com**: Lead ingestion (webhook + polling), credential management, test connection
- **AI**: Provider abstraction (AIProvider interface), Groq implementation, privacy sanitization layer, usage tracking, feature extraction, conversation summary, reply suggestion
- **Automation**: Rule engine, BullMQ job scheduling, configurable delays, business hours
- **Analytics**: Broker analytics (leads, conversion, visits, response time) + Super Admin analytics (orgs, revenue, usage, health)
- **Notifications**: FCM push notifications
- **Storage**: DigitalOcean Spaces (S3-compatible) for media
- **Admin Settings**: System settings CRUD (General, Branding, AI, Payments, WhatsApp, Housing, Storage, Notifications, Security, Feature Flags)
- **Credential Center**: Encrypted credential storage (AES-256-GCM), test connection, audit logging
- **Audit Logs**: Record login, credential updates, subscription changes, plan changes, integration changes
- **Health**: System health endpoints (DB, Redis, Queue status)
- **WebSocket Gateway**: Socket.io for real-time WhatsApp conversations and notifications

### R5. React Native Mobile App Shell

Build the complete mobile app shell using Expo, Expo Router, TypeScript, NativeWind, and React Native Reanimated:

- **Tab Navigation**: Dashboard, Leads, Properties, Follow-ups, More
- **More Menu**: Customers, Site Visits, Tasks, WhatsApp, Analytics, Subscription, Settings
- **Design System**: Deep Teal/Emerald primary color. Inter font. Reusable components: Screen, Header, Card, LeadCard, PropertyCard, MetricCard, StatusBadge, Button, IconButton, Search, Input, Select, BottomSheet, FilterSheet, EmptyState, Skeleton, Timeline, WhatsAppComposer, AIInsight, SubscriptionCard, UsageProgress
- **Typography Hierarchy**: Display (32/700), Page Title (26/700), Section (20/600-700), Card (16/600), Body (15-16/400), Secondary (14), Caption (12)
- **State Management**: TanStack Query for server state, React Hook Form + Zod for forms
- **Animations**: Subtle 150-300ms using Reanimated. Button feedback, card press, bottom sheet motion, stage change, success confirmation
- **Loading/Empty/Error States**: Every screen has loading skeleton, empty state, error state, and success state
- **i18n**: English + Hindi support infrastructure
- **Auth Flow**: Login (email/password + phone/OTP), token management, auto-refresh
- **Dashboard Screen**: New Leads Today, Active Leads, Follow-ups Due, Overdue, Site Visits, Hot Leads, Unread WhatsApp, Deals Closed. Sections: Today's Follow-ups, Recent Leads, Upcoming Visits
- **Subscription Screen**: Current Plan, Status, Renewal Date, Usage meters, Upgrade/Renew actions

### R6. Next.js Admin Panel Shell

Build the Super Admin web panel with Next.js, TypeScript, Tailwind CSS:

- **Authentication**: Email/password login, JWT-based, SUPER_ADMIN only
- **Dashboard**: Total Organizations, Active/Trial/Paid/Cancelled Brokers, MRR/ARR, Total Leads, WhatsApp Usage, AI Usage, Housing Health, Failed Jobs, Recent Registrations/Payments, System Alerts
- **Organization Management**: Create, edit, suspend, reactivate, delete, assign plan, change limits, extend trial, set founder
- **Plan Management**: CRUD for plans (FOUNDER, STARTER, PRO, BUSINESS), feature limits, pricing, trial days
- **Subscription Management**: View all subscriptions, manual billing actions
- **Integration & Credential Center**: Configure AI providers, Payment providers, Housing.com, WhatsApp, Storage credentials. Show configured/not-configured status. Test connection buttons. Never display full secrets after saving
- **Feature Flags**: Enable/disable globally, per plan, per organization
- **System Settings**: General, Branding, AI, Payments, WhatsApp, Housing, Storage, Notifications, Security
- **Analytics**: Organizations, Revenue, Subscriptions, AI Usage, WhatsApp Usage, Lead Volumes, Platform Health
- **Audit Logs**: Searchable log viewer
- **System Health**: Database, Redis, Queue, Housing, WhatsApp, Payments, AI status indicators

### R7. Documentation

Create comprehensive documentation files at the project root:
- ARCHITECTURE.md — System architecture, module descriptions, data flow diagrams
- DESIGN_SYSTEM.md — Colors, typography, components, spacing, animation specs
- DATABASE_SCHEMA.md — All models, relations, indexes, constraints
- SAAS_ARCHITECTURE.md — Multi-tenancy, plans, subscriptions, feature flags, usage tracking
- BILLING_ARCHITECTURE.md — Payment providers, Razorpay flow, webhook handling, manual billing
- AI_ARCHITECTURE.md — Provider abstraction, privacy layer, usage limits, model strategy
- SECURITY.md — Auth, encryption, tenant isolation, audit, rate limiting
- DEPLOYMENT.md — Docker, DigitalOcean Droplet setup, environment configuration, backup strategy, future AWS migration path
- INTEGRATIONS.md — Housing.com, WhatsApp Business API, Groq AI, Razorpay, FCM
- API.md — REST API overview, authentication, pagination, error format
- PROJECT_PROGRESS.md — Implementation status tracker

## Acceptance Criteria

### Infrastructure
- [ ] `pnpm install` succeeds from root with no errors
- [ ] `docker compose up` starts all containers (api, admin, postgres, redis) and they pass health checks
- [ ] TypeScript compiles with `strict: true` across all packages with zero errors
- [ ] Shared package types are importable from api, mobile, and admin apps
- [ ] `.env.example` files exist for all apps with documented variables

### Database
- [ ] `npx prisma generate` succeeds with no errors
- [ ] `npx prisma migrate dev` creates all tables successfully
- [ ] `npx prisma db seed` populates development data
- [ ] Every business entity has an `organizationId` foreign key (verified by schema inspection)
- [ ] Soft delete (`deletedAt`) exists on Customer, Lead, Property, FollowUp, SiteVisit entities

### Backend API
- [ ] API starts and responds to health check endpoint with DB/Redis/Queue status
- [ ] Swagger UI is accessible at `/api/docs` with all endpoints documented
- [ ] JWT auth flow works: login → access token + refresh token → refresh → new tokens
- [ ] Multi-tenant guard prevents cross-organization data access (unit test)
- [ ] At least one module per major feature area has controller + service + DTOs scaffolded
- [ ] BullMQ queues are registered and workers start
- [ ] WebSocket gateway initializes for real-time features
- [ ] PaymentProvider interface exists with Razorpay and Manual implementations
- [ ] AIProvider interface exists with Groq implementation
- [ ] Encryption service encrypts/decrypts credentials using AES-256-GCM

### Mobile App
- [ ] `npx expo start` launches without errors
- [ ] Tab navigation renders all 5 primary tabs
- [ ] All design system components render correctly (Button, Card, Input, StatusBadge, Skeleton, EmptyState, BottomSheet at minimum)
- [ ] NativeWind styles apply correctly with the Deep Teal/Emerald theme
- [ ] Auth flow screens exist (Login, OTP)
- [ ] Dashboard screen renders with metric cards and sections (can use mock data)
- [ ] At least skeleton screens exist for Leads, Properties, Follow-ups, Subscription

### Admin Panel
- [ ] `pnpm dev` starts the admin panel on localhost
- [ ] Login page authenticates against the API
- [ ] Dashboard page renders with metric cards (can use mock data)
- [ ] Organization list page with create/edit actions exists
- [ ] Plan management page exists
- [ ] Sidebar navigation includes all major sections
- [ ] Responsive layout works on desktop and tablet viewports

### Documentation
- [ ] All 11 documentation files listed in R7 exist at the project root
- [ ] Each doc file is at least 200 lines and contains substantive content (not just placeholders)
- [ ] ARCHITECTURE.md includes a system architecture diagram (mermaid or text)
- [ ] DATABASE_SCHEMA.md documents all models with field descriptions

### Security
- [ ] No secrets or credentials are hardcoded in source code (grep verification)
- [ ] Passwords are hashed (bcrypt or argon2)
- [ ] JWT tokens have configurable expiration
- [ ] Rate limiting middleware is configured
- [ ] CORS is configured with allowed origins

## 2026-09-26T17:42:30Z

BrokerIQ is a multi-tenant SaaS CRM platform for Indian real-estate brokers. The complete backend (NestJS, 22 API modules, PostgreSQL with 33 models, seeded data) and admin panel shell (Next.js 16, 12 pages, 13 components) are already built and running locally. The admin panel currently shows hardcoded mock data and has basic UI. This project upgrades the admin panel to enterprise-grade quality: wire every page to the live API, replace all mocks with real data, add rich charts/analytics, and deliver polished enterprise UI/UX across all pages.

Working directory: /Users/yashjangid/Desktop/BrokerIQ
Integrity mode: development

## Existing System Context

- **API server**: NestJS running at `http://localhost:3000` with Swagger at `/api`
- **Admin panel**: Next.js 16 at `apps/admin/` running at `http://localhost:3001`
- **Database**: PostgreSQL with 33 tables, seeded with SuperAdmin, Founder org, 4 plans, 5 customers, 5 leads, 3 properties, etc.
- **Tailwind CSS v4**: Uses `@import "tailwindcss"` in globals.css with `@theme` block for BrokerIQ colors (primary: #0D9488 Deep Teal)
- **PostCSS**: Uses `@tailwindcss/postcss` plugin (NOT the old v3 `tailwindcss` plugin)
- **Key dependencies already installed**: `@tanstack/react-query`, `lucide-react`, `axios`, `zod`, `react-hook-form`
- **API client**: `apps/admin/src/lib/api.ts` — Axios instance pointing to `NEXT_PUBLIC_API_URL`
- **Auth**: Mock login at `apps/admin/src/app/login/page.tsx` — credentials: `admin@brokeriq.com` / `admin`
- **Seeded DB admin**: `admin@brokeriq.in` (hashed password in DB)
- **Design system**: Deep Teal primary (#0D9488), Inter font, rounded-2xl cards, gray-900 sidebar
- **DO NOT use `tailwind.config.ts`** — Tailwind v4 uses CSS-based config via `@theme` in globals.css
- **pnpm store**: Use default store location (do NOT pass `--store-dir`). If `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` to fix.

## Requirements

### R1. Wire All Admin Pages to Live API Data
Replace every instance of mock/hardcoded data across all 12 admin pages with real API calls to the NestJS backend at `http://localhost:3000`. Use TanStack React Query for data fetching with proper loading skeletons, error states, and empty states. Every list page must fetch from the corresponding API endpoint. Every detail page must fetch by ID. Every form must POST/PATCH to the API. The login page must authenticate against the real API auth endpoint.

### R2. Enterprise-Grade Admin Dashboard & Analytics
The dashboard must feel like a real SaaS admin control center — not a template. It needs real charts (install and use Recharts), activity feeds with timestamps, system health indicators that pulse, quick-action cards, and dense but readable information architecture. The analytics page needs date-range pickers, line/bar/pie charts for revenue trends, subscription distribution, lead volumes, and AI usage. Every metric card should show real computed data from the API.

### R3. Enterprise UI/UX Patterns Across All Pages
Every page needs: breadcrumb navigation, page-level actions (Create/Export buttons), confirmation modals for destructive actions (delete, suspend), toast notifications for success/error feedback, skeleton loading states during data fetch, proper empty states with call-to-action, responsive tables with sorting/filtering/pagination, and detail views with tabbed layouts where appropriate (e.g., Organization detail with Overview/Subscription/Usage/Activity tabs). The design must be information-dense, professional, and polished — matching products like Stripe Dashboard, Vercel Dashboard, or Linear.

### R4. Mobile App Runtime Verification
Ensure the React Native/Expo mobile app at `apps/mobile/` can start and render on the Android emulator. Run `npx expo start` and verify the app loads on the Pixel 8 emulator. Fix any runtime errors that prevent the app from rendering. The mobile app should show the login screen, and after login, display the dashboard with tabs for Leads, Properties, Follow-ups, and More.

## Acceptance Criteria

### API Integration
- [ ] Zero imports from `@/mocks` or `src/mocks/` remain in any admin page — verified by `grep -r "mocks" apps/admin/src/app/`
- [ ] Login page authenticates against `POST /auth/login` on the real API and stores the JWT token
- [ ] Dashboard metrics are fetched from API endpoints (organizations count, leads count, subscription stats, etc.)
- [ ] Organizations list page fetches from `GET /organizations` and displays real seeded data
- [ ] Organization detail page fetches by ID and shows real subscription/usage data
- [ ] Plans page fetches from `GET /plans` showing the 4 seeded plans (FOUNDER, STARTER, PRO, BUSINESS)
- [ ] Subscriptions page fetches from `GET /subscriptions` with real data
- [ ] Audit logs page fetches from `GET /audit` with real entries
- [ ] All CRUD operations (create, update, delete) call real API endpoints

### UI/UX Quality
- [ ] At least 3 different chart types rendered on dashboard/analytics pages using Recharts (line, bar, pie/donut)
- [ ] Every list page has: search input, sortable columns, pagination controls, and loading skeletons
- [ ] Confirmation modal appears before any destructive action (delete organization, cancel subscription)
- [ ] Toast notification appears after successful create/update/delete operations
- [ ] Breadcrumb navigation present on all non-root pages
- [ ] Organization detail page has at least 3 tabs (Overview, Subscription, Activity)
- [ ] System Health page shows real-time-style status indicators for each service
- [ ] `next build` passes with zero errors after all changes

### Mobile App
- [ ] `npx expo start` launches without crashing
- [ ] The app renders the login screen on the Android emulator
- [ ] After login, the tab navigation (Dashboard, Leads, Properties, Follow-ups, More) is visible and navigable



## 2026-09-27T07:38:01Z

Build an AI-powered physical listing book scanner and micro-market property directory for the BrokerIQ mobile app. This enables real-estate brokers to photograph or upload physical property listing registers (like the Gurgaon commercial register), automatically extract complete structured property and owner contact records, and explore a rich micro-market directory with nearby infrastructure data points, category filters, and 1-tap client outreach, seamlessly integrated with the local NestJS backend and verified on the Android emulator.

Working directory: /Users/yashjangid/Desktop/BrokerIQ
Integrity mode: development

## Requirements

### R1. Dedicated "Market Hub" Tab & Dual-View Navigation
Implement a dedicated tab ("Market Hub") in the mobile app bottom navigation bar (`apps/mobile/app/(tabs)/_layout.tsx`) with a top segmented view switcher:
- **Segment 1: "Scan Book"** — AI camera capture, image upload, OCR parser, and live tabular data extractor.
- **Segment 2: "Market Directory"** — Sector-based micro-market property directory and nearby area property finder.

### R2. AI Book Scanner & OCR Data Extractor
- Image ingestion: Support device camera capture, gallery file picker, and a 1-tap **"Load Sample Register Page"** button preloaded with the user's Gurgaon commercial register (September 2026 catalog) for flawless laptop emulator client demonstrations.
- Intelligent data extraction engine: Automatically parse printed listing lines into structured fields:
  - **Sector / Location** (e.g. Sector-86, Sector-88A, Sector-89, Sector-89A, Sector-90)
  - **Project / Complex** (e.g. SS Omnia, SS Highpoint, Signature Signum-88A, Orris Market, Sapphire Ninety, DLF Regal Garden, MRG Bazaar, AIPL Joy District, Adani Galleria)
  - **Unit / Shop Number** (e.g. G80, Shop No-52, SCO-309, A-515, K-12, SF-5)
  - **Carpet Area** in sq.ft (e.g. 449 sq.ft, 534 sq.ft, 850 sq.ft)
  - **Floor & Attributes** (Ground Floor GF, First Floor FF, Second Floor SF, Lower Ground LGF, Corner, Front Side, Double Height)
  - **Status & Tenancy** (Ready Shop, Under Construction U/C, Furnished Rented, Rented @ ₹100/sq.ft to Vishal Mega Mart)
  - **Owner / Broker Contact** (Contact Name e.g. Deepak, Ashwani, Vineet, Gaurav Kapoor; Phone Numbers e.g. 9899248292, 6260245484, 9911389167)
- Extraction Review Screen: Display parsed items in an interactive, editable preview list with confidence tags, validation checks, and 1-tap **"Import to My CRM Inventory"** or **"Publish to Market Directory"**.

### R3. Micro-Market Directory & Location Property Finder
- Comprehensive directory categorized by Sectors (Sector-86, 88A, 89, 89A, 90, 91, 92, 93) and Mumbai luxury corridors.
- **Nearby Infrastructure & Area Highlights**:
  - Key connectivity: Dwarka Expressway (500m), NH-48 / Delhi-Jaipur Highway, Proposed Metro Station, IGI Airport (25 mins).
  - Commercial & Social Anchors: Vishal Mega Mart, Genesis Hospital, Cyber City, IMT Manesar.
  - Sector Financial Intelligence: Average commercial rate/sq.ft, prevailing rental yields (7.5% – 9.2% ROI), and total active units.
- **Dynamic Category & Floor Filters**:
  - Category chips: Retail Shops, SCO Plots, Food Court Units, Pre-Leased Rented (ROI), Corporate Offices.
  - Floor filters: All Floors, Ground Floor (GF), First Floor (FF), Second Floor (SF), Corner Units.
  - Search by project name, unit, sector, or owner phone.
- **Direct 1-Tap Broker Outreach**:
  - Direct Phone dialer (`tel:<phone>`).
  - Pre-composed WhatsApp inquiry (`wa.me/<phone>?text=...`) referencing the exact unit and complex.

### R4. Local Backend Integration & Hybrid Sync
- Expose NestJS backend endpoints:
  - `GET /properties/market-directory` to fetch all catalog properties, sectors, and nearby points of interest.
  - `POST /properties/scan-extract` to process image/text data and return structured parsed JSON.
- Seed backend database and offline mobile cache with the complete 50+ property dataset from the user's catalog.
- Connect mobile app to backend using `http://10.0.2.2:3000` (Android emulator localhost alias) with automatic local fallback cache for robust offline laptop demos.

### R5. Release Build, Emulator Verification & Zero-Crash Validation
- Compile TypeScript with 0 errors (`pnpm --filter @brokeriq/mobile typecheck`).
- Assemble release APK: `apps/mobile/android/gradlew assembleRelease --no-daemon`.
- Copy output to `/Users/yashjangid/Desktop/BrokerIQ/BrokerIQ.apk`.
- Install APK on running Android emulator (`emulator-5554`), launch, test both the Scanner and Directory views, and capture screenshots.

## Acceptance Criteria

### Navigation & Layout
- [ ] Bottom navigation displays "Market Hub" tab with custom vector SVG icon alongside existing tabs.
- [ ] Segmented switcher at the top toggles between "Scan Book" and "Market Directory" without lag or reload.
- [ ] Safe-area insets respected on all screens without clipping header or navigation bars.

### Book Scanner & Extractor
- [ ] "Scan Book" view features image picker, camera trigger, and "Load Sample Register Page (Gurgaon Catalog)".
- [ ] Scanning triggers an animated scanning radar / laser effect and extracts all items accurately.
- [ ] Parsed table renders Sector, Complex, Unit, Area, Floor, Status, and Owner Contact.
- [ ] User can edit any parsed field directly before importing.
- [ ] 1-tap "Import to My Inventory" successfully persists items into the app's inventory.

### Market Directory & Property Finder
- [ ] Directory renders at least 5 sectors (86, 88A, 89, 89A, 90) with 40+ structured commercial listings.
- [ ] Each sector card displays nearby area highlights (Dwarka Expressway, Metro, Major Anchors).
- [ ] Category filters (All, Retail Shop, Pre-Leased Rented, SCO, Corner) correctly filter displayed units.
- [ ] Tapping "Call" initiates phone dialer with the owner's phone number.
- [ ] Tapping "WhatsApp" opens WhatsApp with pre-filled inquiry text for that specific unit.

### Backend Integration & Build
- [ ] NestJS backend exposes `GET /properties/market-directory` and returns seeded catalog data.
- [ ] Mobile app connects via `http://10.0.2.2:3000` with graceful offline fallback.
- [ ] `tsc --noEmit` passes with 0 errors across `@brokeriq/mobile` and `@brokeriq/api`.
- [ ] `BrokerIQ.apk` builds successfully and is placed at `/Users/yashjangid/Desktop/BrokerIQ/BrokerIQ.apk`.
- [ ] App is installed and verified running live on `emulator-5554` with zero crashes.

## 2026-09-27T10:23:02Z

Build an enterprise-grade multi-role property marketplace for BrokerIQ inspired by Housing.com, featuring unified identity, 5 distinct personas with dedicated web portals routed dynamically from `/login` in `apps/admin`, dynamic role-adaptive bottom navigation in `apps/mobile`, and full backend RBAC with 1-click demo testing.

Working directory: /Users/yashjangid/Desktop/BrokerIQ
Integrity mode: development

## Requirements

### R1. Unified Identity & 5 Core Personas (Backend & Shared)
Support 5 first-class personas with scoped permissions and token-based role switching:
1. **SUPER_ADMIN**: Platform control, listing moderation queue, seller KYC verification, fraud/abuse reports, audit logs, system telemetry.
2. **BROKER_ADMIN / AGENCY_MANAGER**: Agency organization management, team member invites & seat management, aggregate agency pipeline, lead assignment rules, agency billing.
3. **BROKER_AGENT**: Field CRM, personal assigned leads, client follow-up schedule, Market Hub physical listing book scanner, personal active inventory.
4. **PROPERTY_OWNER**: Individual seller/landlord, simplified 3-step listing wizard, direct buyer lead messages/calls, self-verification badge tracker, visibility boost credits.
5. **SEEKER / BUYER_TENANT**: Discovery search, budget/BHK/amenity filters, saved properties, contacted inquiry log, direct WhatsApp/Call seller outreach, EMI calculator.

### R2. Web Multi-Role Portal Routing & Enterprise UI/UX (`apps/admin`)
- **World-Class Modern UI/UX & Layout**: Built to the highest modern design standards (Housing.com + Linear + Stripe design language):
  - Premium Dark/Light aesthetic, glassmorphic cards (`border-gray-800/80 backdrop-blur`), gradient badges, crisp typography, and responsive grid layouts.
  - Interactive KPI cards, status badges, filter toolbars, lead stages, and actionable direct outreach buttons (Call, WhatsApp, Approve, Reject, Allocate).
- Single login entrypoint (`/login`) with **1-click quick-login chips** for all 5 personas with avatar badges that automatically authenticate and divert to the corresponding role portal:
  - `/admin/*`: Super Admin & Moderation Command Center (Moderation queues, KYC approvals, Tenant Organizations, Audit logs).
  - `/agency/*`: Broker Manager / Agency Admin Portal (Team agents list, lead allocation rules, agency-wide pipeline & inventory).
  - `/agent/*`: Broker Agent Portal (My Leads, My Listings, Market Scanner, Client Follow-ups).
  - `/owner/*`: Property Owner Portal (My Properties, Inbound Enquiries, Verification, Promotion Credits).
  - `/portal/*`: Seeker Discovery & Activity Portal (Search & Filters, Saved Properties, Inquiries Log, Market Trends).
- Persistent top-bar **Persona Switcher** dropdown in every portal layout with role badges, active status indicator, and 1-click instant switching between all 5 personas during client demonstrations.
- Role-based route guard / auth middleware redirecting unauthorized access to the user's primary portal.

### R3. Mobile Multi-Persona Dynamic Tab Navigation (`apps/mobile`)
- Dynamic role-adaptive bottom tab navigation that automatically reconfigures based on the active persona:
  - **Seeker Mode**: Tabs: `[Explore/Search, Saved, Inquiries, Market Hub, Profile]`
  - **Owner Mode**: Tabs: `[My Listings, Inquiries/Leads, Post Property, Verification, Profile]`
  - **Broker Mode**: Tabs: `[Dashboard, Leads, Market Hub, Inventory, Follow-ups, More]`
- 1-tap **Persona Switcher** in the mobile header/profile drawer with instant layout transition and zero session interruption.
- 1-tap **Demo Quick-Login** chips on the mobile login screen (`/login`) for each of the 5 personas.

### R4. Seed Data & 1-Click Client Demo Suite
- Pre-seed rich, realistic mock data for all 5 personas (commercial units from Gurgaon catalog, Mumbai luxury residences, realistic buyer leads, pending moderation items, verification badges).
- Both web portal (`http://localhost:3001` or `3000`) and mobile app work with local backend (`http://10.0.2.2:3000` / `http://localhost:3000`) and robust offline fallback caching.

### R5. Release Build, Emulator Verification & Zero-Crash Validation
- Compile TypeScript with 0 errors across `@brokeriq/api`, `@brokeriq/admin`, `@brokeriq/mobile`, and `@brokeriq/shared`.
- Verify web portals build cleanly (`pnpm --filter @brokeriq/admin build`).
- Build release APK (`BrokerIQ.apk`) in `apps/mobile/android` and stage at `/Users/yashjangid/Desktop/BrokerIQ/BrokerIQ.apk`.
- Install APK on Android emulator (`emulator-5554`), launch, verify persona switching and role-adaptive tabs, and capture verification screenshots.

## Acceptance Criteria

### Web Multi-Role Portals
- [ ] `/login` displays 1-click quick-login buttons for all 5 personas: Super Admin, Agency Manager, Broker Agent, Property Owner, Seeker.
- [ ] Logging in as Super Admin diverts to `/admin` and displays moderation queues, tenant management, and KYC verification.
- [ ] Logging in as Agency Manager diverts to `/agency` and displays agency team members, lead assignment, and agency inventory.
- [ ] Logging in as Broker Agent diverts to `/agent` and displays personal leads, personal inventory, and follow-ups.
- [ ] Logging in as Property Owner diverts to `/owner` and displays owner listings, inbound buyer inquiries, and verification status.
- [ ] Logging in as Seeker diverts to `/portal` and displays marketplace search, saved properties, and contacted list.
- [ ] Top-bar Persona Switcher allows switching between all 5 roles on the fly from any portal page.

### Mobile Multi-Persona App
- [ ] Mobile login screen features 1-tap demo quick-login buttons for the 5 personas.
- [ ] Switching to Seeker mode reconfigures the tab bar to `[Explore, Saved, Inquiries, Market Hub, Profile]`.
- [ ] Switching to Owner mode reconfigures the tab bar to `[My Listings, Inquiries, Post Property, Verification, Profile]`.
- [ ] Switching to Broker mode reconfigures the tab bar to `[Dashboard, Leads, Market Hub, Inventory, Follow-ups, More]`.
- [ ] Header persona switcher toggles persona smoothly without app restart or crash.

### Build & Integrity
- [ ] `pnpm typecheck` or individual package typechecks pass with 0 errors.
- [ ] Next.js admin/web portal compiles with 0 build errors.
- [ ] Release APK is assembled, copied to project root, installed on `emulator-5554`, and verified running with 0 crashes in logcat.

