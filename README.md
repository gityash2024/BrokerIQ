# BrokerIQ — Enterprise Multi-Role Real Estate Marketplace & AI Listing Book Scanner

An enterprise-grade, multi-sided real estate marketplace inspired by **Housing.com**, **Linear**, and **Stripe**. BrokerIQ connects property seekers, owners, field broker agents, agency principals, and platform super administrators into a unified identity architecture with role-adaptive web and mobile experiences.

---

## 🌟 Key Capabilities

### 1. Unified 5-Persona Identity & RBAC
- **Super Admin (`SUPER_ADMIN`)**: Platform command center, listing moderation queue, KYC document auditing, agency tenant provisioning.
- **Agency Manager (`BROKER_ADMIN`)**: Team management, revenue pipeline, round-robin lead allocation, commission tracking.
- **Broker Agent (`BROKER_AGENT`)**: Field CRM, assigned leads, follow-up timeline, client visit scheduling, book scanner.
- **Property Owner (`PROPERTY_OWNER`)**: 3-step listing wizard, ownership document verification, direct buyer inquiry inbox.
- **Buyer / Renter (`SEEKER`)**: Micro-market exploration, commercial ROI calculator, saved wishlist, direct owner/agent outreach.
- **Instant Role-Switching**: Token re-minting via `/auth/switch-role` and `/auth/demo-login` preserving user identity across personas.

### 2. Web Application (`apps/admin`)
- Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS**, and **Turbopack**.
- **1-Click Demo Login (`/login`)**: Instant login chips for all 5 personas directing users to their dedicated portal.
- **5 Dedicated Portals (39 Routes)**:
  - `/admin`: Super Admin Command Center, Moderation, KYC Queues, Tenants.
  - `/agency`: Agency Command Dashboard, Team Performance, Lead Allocation.
  - `/agent`: Broker Field CRM, Property Matching, Direct WhatsApp Outreach.
  - `/owner`: Property Owner Dashboard, 3-Step Wizard, Inquiry Tracker.
  - `/portal`: High-resolution Seeker Search, Saved Wishlist, EMI Calculator.
- **Top-Bar Persona Switcher**: Seamless switching between roles during live client demos.

### 3. Mobile Application (`apps/mobile`)
- Built with **React Native**, **Expo SDK 52**, **Expo Router**, and **NativeWind**.
- **Dynamic Role-Adaptive Navigation**: Hot-swaps bottom tabs based on active role:
  - **Seeker**: `[Explore, Saved, Inquiries, Market Hub, Profile]`
  - **Owner**: `[My Listings, Inquiries, Post Property, Verification, Profile]`
  - **Broker Agent**: `[Dashboard, Leads, Market Hub, Inventory, Follow-ups, More]`
  - **Broker Admin**: `[Dashboard, Team, Pipeline, Inventory, Settings, More]`
- **1-Tap Header Persona Switcher Modal**: Quick-switch personas via the header status badge (`• Broker Agent ⌵`).
- **AI Physical Listing Book Scanner**: Scan physical listing registers via camera, gallery upload, or 1-tap sample loader with OCR extraction into structured fields (Sector, Complex, Unit, Area, Floor, Tenancy, Contact).
- **Micro-Market Directory**: Sector intelligence across Sectors 86–93 (Dwarka Expressway corridor) with 1-tap WhatsApp and Call broker outreach.

### 4. Robust Backend API (`apps/api`)
- Built with **NestJS 10**, **Prisma ORM**, and **PostgreSQL**.
- Cryptographic token generation, AES-256-GCM field encryption, and row-level tenant isolation.
- Complete market directory and OCR data extraction endpoints with offline fallback cache.

---

## 📁 Repository Structure

```
BrokerIQ/
├── apps/
│   ├── admin/             # Next.js 16 Multi-Role Web Portals (/admin, /agency, /agent, /owner, /portal)
│   ├── api/               # NestJS Backend API & Prisma ORM Engine
│   └── mobile/            # React Native / Expo Mobile App with Dynamic Tab Navigation
├── packages/
│   ├── shared/            # Shared TypeScript types, enums, DTOs, and RBAC contracts
│   └── eslint-config/     # Workspace linting configuration
├── tests/                 # 4-tier E2E test battery (241 test cases)
├── docker-compose.yml     # PostgreSQL, Redis, and infrastructure setup
├── pnpm-workspace.yaml    # Monorepo workspace configuration
└── turbo.json             # Turborepo task pipeline configuration
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: >= 20.x
- **pnpm**: >= 9.x
- **Docker & Docker Compose** (for PostgreSQL and Redis)

### Installation
```bash
# Clone the repository
git clone https://github.com/gityash2024/BrokerIQ.git
cd BrokerIQ

# Install dependencies across all workspaces
pnpm install
```

### Environment Configuration
```bash
# Copy root environment file
cp .env.example .env

# Copy app-specific environment files
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
```

### Database Setup & Seeding
```bash
# Start PostgreSQL & Redis
docker-compose up -d

# Run database migrations and seed 5-persona demo data
pnpm --filter @brokeriq/api db:migrate
pnpm --filter @brokeriq/api db:seed
```

### Running Applications
```bash
# Start all applications concurrently via Turborepo
pnpm dev

# Or start individually:
pnpm --filter @brokeriq/api start:dev   # NestJS API (http://localhost:3000)
pnpm --filter @brokeriq/admin dev      # Web Portals (http://localhost:3001)
pnpm --filter @brokeriq/mobile start   # Expo Mobile App (Metro bundler)
```

---

## 🧪 Testing & Verification

The test battery includes **241 comprehensive tests** covering RBAC, tenant isolation, role switching, and real-world marketplace scenarios:

```bash
# Run baseline E2E test suite (197 tests)
bash tests/runner.sh

# Run Milestone 4 Multi-Role Marketplace test suite (44 tests)
NODE_PATH=apps/api/node_modules node tests/m4_personas_e2e_suite.js
```

---

## 📱 Mobile APK Build

To build the release Android APK:
```bash
cd apps/mobile/android
./gradlew assembleRelease --no-daemon
```
The compiled APK will be generated at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

---

## 📄 License
Private & Confidential — BrokerIQ Platform.
