# BrokerIQ — PostgreSQL Database Schema Specification

## 1. Architectural Philosophy & Engine Standards

BrokerIQ uses **PostgreSQL 16** managed through **Prisma ORM**. The data tier enforces strict enterprise multi-tenancy, immutable auditing, financial consistency, and high-performance querying across Indian real-estate workloads.

### Foundational Principles
1. **Row-Level Multi-Tenancy Isolation**: Every business entity table includes a mandatory `organizationId` foreign key referencing the `Organization` table. Queries executed across business domains are strictly scoped with `WHERE organization_id = :orgId`.
2. **Composite B-Tree Indexing**: Tables utilize composite indices structured as `(organization_id, created_at DESC)` and `(organization_id, status)` to ensure index-only scans on tenant-scoped list views and dashboards.
3. **Soft Deletion Strategy**: Transactional entities where business history is paramount (`Customer`, `Lead`, `Property`, `FollowUp`, `SiteVisit`) feature a `deletedAt TIMESTAMPTZ?` column. Soft-deleted records are filtered out of active queries while preserving audit and analytical integrity.
4. **Temporal Standards**: All timestamps are stored strictly in UTC with timezone (`TIMESTAMPTZ` / `DateTime @default(now())`).
5. **Financial & Currency Standards**: All financial amounts (property pricing, budgets, subscription prices, invoice totals) are stored as 64-bit integers (paise) or precise decimals, paired with a mandatory `currency` column defaulting to `"INR"`.

---

## 2. Relational Entity Overview (33 Models across 7 Groups)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        33 MODELS IN 7 GROUPS                           │
├────────────────────┬───────────────────────────────────────────────────┤
│ Group              │ Models                                            │
├────────────────────┼───────────────────────────────────────────────────┤
│ 1. SaaS Core (12)  │ Organization, OrganizationMember, User, Plan,     │
│                    │ PlanFeature, FeatureLimit, FeatureFlag,           │
│                    │ Subscription, Payment, Invoice, UsageCounter,     │
│                    │ Coupon                                            │
├────────────────────┼───────────────────────────────────────────────────┤
│ 2. CRM (8)         │ Customer, Lead, Property, PropertyOwner,          │
│                    │ FollowUp, SiteVisit, Task, Activity               │
├────────────────────┼───────────────────────────────────────────────────┤
│ 3. Communication(3)│ Conversation, Message, WhatsAppTemplate           │
├────────────────────┼───────────────────────────────────────────────────┤
│ 4. Integrations (3)│ Integration, IntegrationLog, WebhookEvent         │
├────────────────────┼───────────────────────────────────────────────────┤
│ 5. Automation (2)  │ AutomationRule, AutomationExecution               │
├────────────────────┼───────────────────────────────────────────────────┤
│ 6. AI (2)          │ AIResult, AIUsage                                 │
├────────────────────┼───────────────────────────────────────────────────┤
│ 7. Platform (3)    │ Notification, AuditLog, SystemSetting             │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 3. Entity Group Specifications

### 3.1 SaaS Core Entity Group (12 Models)

#### 1. `Organization`
The tenant root entity representing a brokerage firm, real-estate agency, or solo broker practice.
- `id`: `String @id @default(cuid())` — Primary key.
- `name`: `String` — Registered business name.
- `slug`: `String @unique` — URL-safe identifier for tenant routing.
- `status`: `OrganizationStatus @default(ACTIVE)` — `ACTIVE`, `SUSPENDED`.
- `planTier`: `PlanTier @default(STARTER)` — `FOUNDER`, `STARTER`, `PRO`, `BUSINESS`.
- `isFounder`: `Boolean @default(false)` — Early-adopter VIP flag.
- `city`: `String?` — Operational city (e.g., Bangalore, Mumbai).
- `state`: `String?` — State (e.g., Karnataka, Maharashtra).
- `gstin`: `String?` — Indian 15-character GST identification number.
- `logoUrl`: `String?` — S3 CDN URL for organization logo.
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`

#### 2. `OrganizationMember`
Mapping table linking Users to Organizations with role assignments and membership statuses.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `userId`: `String` (FK -> `User.id`)
- `role`: `Role @default(BROKER_STAFF)` — `BROKER_ADMIN`, `BROKER_STAFF`.
- `status`: `UserStatus @default(ACTIVE)`
- `createdAt`: `DateTime @default(now())`
- **Indices & Constraints**: `@@unique([organizationId, userId])`, `@@index([organizationId, role])`.

#### 3. `User`
Platform-wide user identities supporting multi-organization membership and Super Admin operations.
- `id`: `String @id @default(cuid())`
- `email`: `String? @unique` — Unique email identifier.
- `phone`: `String? @unique` — E.164 phone number (e.g. `+919876543210`).
- `passwordHash`: `String?` — Argon2id/bcrypt hashed credential.
- `name`: `String` — Full name.
- `role`: `Role @default(BROKER_STAFF)` — System role (`SUPER_ADMIN`, `BROKER_ADMIN`, `BROKER_STAFF`).
- `status`: `UserStatus @default(ACTIVE)`
- `avatarUrl`: `String?`
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`

#### 4. `Plan`
Available SaaS pricing tiers and baseline configurations.
- `id`: `String @id @default(cuid())`
- `code`: `PlanTier @unique` — `FOUNDER`, `STARTER`, `PRO`, `BUSINESS`.
- `name`: `String`
- `description`: `String?`
- `priceMonthly`: `Int` — Price in INR paise (e.g., 99900 = ₹999.00).
- `priceYearly`: `Int` — Annual price in INR paise (e.g., 999000 = ₹9,990.00).
- `currency`: `String @default("INR")`
- `trialDays`: `Int @default(14)`
- `isActive`: `Boolean @default(true)`
- `createdAt`: `DateTime @default(now())`

#### 5. `PlanFeature`
Mapping of marketing features and functional privileges associated with each plan tier.
- `id`: `String @id @default(cuid())`
- `planId`: `String` (FK -> `Plan.id`)
- `featureKey`: `String` — e.g. `housing_sync`, `ai_smart_replies`, `unlimited_leads`.
- `isEnabled`: `Boolean @default(true)`

#### 6. `FeatureLimit`
Quantitative caps enforced on plan tiers.
- `id`: `String @id @default(cuid())`
- `planId`: `String` (FK -> `Plan.id`)
- `limitKey`: `String` — `MAX_USERS`, `MAX_LEADS_PER_MONTH`, `MAX_WHATSAPP_PER_MONTH`, `MAX_AI_CALLS_PER_MONTH`.
- `limitValue`: `Int` — Numeric cap (`-1` represents unlimited).

#### 7. `FeatureFlag`
Fine-grained system toggles resolvable globally, per plan, or per tenant.
- `id`: `String @id @default(cuid())`
- `key`: `String @unique` — e.g. `ai_reply_suggestion`, `housing_auto_sync`.
- `description`: `String?`
- `globalDefault`: `Boolean @default(false)`
- `planTierOverrides`: `Json?` — e.g. `{"PRO": true, "BUSINESS": true}`
- `createdAt`: `DateTime @default(now())`

#### 8. `Subscription`
Tenant billing contracts and active subscription lifecycles.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String @unique` (FK -> `Organization.id`)
- `planId`: `String` (FK -> `Plan.id`)
- `status`: `SubscriptionStatus @default(TRIALING)` — `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCELLED`, `EXPIRED`.
- `billingPeriod`: `BillingPeriod @default(MONTHLY)`
- `currentPeriodStart`: `DateTime`
- `currentPeriodEnd`: `DateTime`
- `trialEndsAt`: `DateTime?`
- `razorpaySubscriptionId`: `String? @unique`
- `razorpayCustomerId`: `String?`
- `cancelAtPeriodEnd`: `Boolean @default(false)`
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`

#### 9. `Payment`
Payment transaction records from Razorpay, bank transfers, or manual offline settlements.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `subscriptionId`: `String?` (FK -> `Subscription.id`)
- `provider`: `PaymentProvider @default(RAZORPAY)` — `RAZORPAY`, `STRIPE`, `MANUAL`.
- `amount`: `Int` — In paise.
- `currency`: `String @default("INR")`
- `status`: `PaymentStatus @default(PENDING)` — `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`.
- `method`: `PaymentMethod?` — `UPI`, `NET_BANKING`, `CREDIT_CARD`, `BANK_TRANSFER`, `CASH`.
- `providerPaymentId`: `String?` — Razorpay payment ID (`pay_xxx`).
- `providerOrderId`: `String?` — Razorpay order ID (`order_xxx`).
- `signature`: `String?`
- `errorDescription`: `String?`
- `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([organizationId, createdAt])`, `@@index([providerPaymentId])`.

#### 10. `Invoice`
Tax-compliant billing documents generated for subscriptions and renewals.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `paymentId`: `String? @unique` (FK -> `Payment.id`)
- `invoiceNumber`: `String @unique` — e.g. `INV-2026-00421`.
- `subtotal`: `Int` — In paise.
- `taxAmount`: `Int` — 18% GST in paise.
- `totalAmount`: `Int` — Total in paise.
- `currency`: `String @default("INR")`
- `status`: `InvoiceStatus @default(ISSUED)` — `DRAFT`, `ISSUED`, `PAID`, `VOID`.
- `hsnSacCode`: `String @default("998314")` — Information technology SaaS service code.
- `pdfUrl`: `String?` — S3 CDN link to generated PDF.
- `issuedAt`: `DateTime @default(now())`
- `paidAt`: `DateTime?`

#### 11. `UsageCounter`
Tenant quota counters tracking current monthly consumption against plan caps.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `metricKey`: `String` — `LEADS_COUNT`, `WHATSAPP_SENT`, `AI_TOKENS_USED`.
- `currentValue`: `Int @default(0)`
- `periodStart`: `DateTime`
- `periodEnd`: `DateTime`
- **Indices & Constraints**: `@@unique([organizationId, metricKey, periodStart])`.

#### 12. `Coupon`
Promotional discount codes for subscriptions.
- `id`: `String @id @default(cuid())`
- `code`: `String @unique`
- `discountPercent`: `Int?`
- `discountAmount`: `Int?`
- `validUntil`: `DateTime?`
- `maxRedemptions`: `Int?`
- `timesRedeemed`: `Int @default(0)`
- `isActive`: `Boolean @default(true)`

---

### 3.2 CRM Entity Group (8 Models)

#### 13. `Customer`
Master contact registry representing property buyers, sellers, tenants, and investors.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `name`: `String`
- `phone`: `String`
- `email`: `String?`
- `city`: `String?`
- `budgetMin`: `BigInt?`
- `budgetMax`: `BigInt?`
- `currency`: `String @default("INR")`
- `preferredLocations`: `String[]`
- `status`: `String @default("ACTIVE")`
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`
- `deletedAt`: `DateTime?` — Soft deletion marker.
- **Indices**: `@@index([organizationId, phone])`, `@@index([organizationId, deletedAt])`.

#### 14. `Lead`
Core transactional lead progressing through the 9-stage real-estate sales pipeline.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `customerId`: `String?` (FK -> `Customer.id`)
- `assignedToId`: `String?` (FK -> `User.id`)
- `name`: `String`
- `phone`: `String`
- `email`: `String?`
- `source`: `LeadSource @default(MANUAL)` — `HOUSING_COM`, `WHATSAPP`, `ACRES99`, `MAGICBRICKS`, `WEBSITE`, `REFERRAL`, `WALK_IN`, `MANUAL`.
- `stage`: `LeadStage @default(NEW)` — `NEW`, `CONTACTED`, `INTERESTED`, `FOLLOW_UP`, `SITE_VISIT`, `NEGOTIATION`, `WON`, `LOST`, `NOT_INTERESTED`.
- `priority`: `Priority @default(MEDIUM)` — `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- `score`: `Int @default(50)` — AI/rule qualification score (0-100).
- `budgetMin`: `BigInt?`
- `budgetMax`: `BigInt?`
- `currency`: `String @default("INR")`
- `preferredBhk`: `String?` — e.g. "3 BHK", "4 BHK".
- `preferredLocation`: `String?`
- `propertyType`: `PropertyType?` — `APARTMENT`, `VILLA`, `PLOT`, `COMMERCIAL`, `PENTHOUSE`.
- `lostReason`: `String?`
- `externalId`: `String?` — Housing.com lead ID.
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`
- `deletedAt`: `DateTime?` — Soft delete.
- **Indices**: `@@index([organizationId, stage])`, `@@index([organizationId, assignedToId])`, `@@index([organizationId, createdAt DESC])`.

#### 15. `Property`
Real estate inventory catalog available for sale, lease, or rent.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `ownerId`: `String?` (FK -> `PropertyOwner.id`)
- `title`: `String`
- `description`: `String?`
- `propertyType`: `PropertyType` — `APARTMENT`, `VILLA`, `PLOT`, etc.
- `listingType`: `ListingType @default(SALE)` — `SALE`, `RENT`.
- `price`: `BigInt` — In INR units.
- `currency`: `String @default("INR")`
- `bhk`: `Int`
- `areaSqft`: `Int`
- `furnishing`: `FurnishingStatus @default(UNFURNISHED)`
- `locality`: `String`
- `city`: `String`
- `state`: `String`
- `pincode`: `String`
- `status`: `PropertyStatus @default(AVAILABLE)` — `AVAILABLE`, `UNDER_OFFER`, `SOLD`, `RENTED`, `INACTIVE`.
- `externalSource`: `String @default("MANUAL")` — `MANUAL`, `HOUSING_COM`.
- `images`: `String[]` — CDN URLs.
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`
- `deletedAt`: `DateTime?`
- **Indices**: `@@index([organizationId, locality, price])`, `@@index([organizationId, bhk, propertyType])`.

#### 16. `PropertyOwner`
Direct owner or landlord metadata for listed properties.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `name`: `String`
- `phone`: `String`
- `email`: `String?`
- `address`: `String?`
- `createdAt`: `DateTime @default(now())`

#### 17. `FollowUp`
Actionable broker task reminders linked to leads.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `leadId`: `String` (FK -> `Lead.id`)
- `assignedToId`: `String` (FK -> `User.id`)
- `scheduledAt`: `DateTime`
- `completedAt`: `DateTime?`
- `status`: `FollowUpStatus @default(SCHEDULED)` — `SCHEDULED`, `COMPLETED`, `CANCELLED`, `RESCHEDULED`, `MISSED`.
- `type`: `FollowUpType @default(CALL)` — `CALL`, `WHATSAPP`, `EMAIL`, `IN_PERSON`, `MEETING`.
- `notes`: `String?`
- `createdAt`: `DateTime @default(now())`
- `deletedAt`: `DateTime?`
- **Indices**: `@@index([organizationId, scheduledAt, status])`.

#### 18. `SiteVisit`
Coordinated physical property walkthrough appointments.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `leadId`: `String` (FK -> `Lead.id`)
- `propertyId`: `String` (FK -> `Property.id`)
- `assignedToId`: `String` (FK -> `User.id`)
- `scheduledAt`: `DateTime`
- `status`: `SiteVisitStatus @default(SCHEDULED)` — `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `RESCHEDULED`.
- `feedback`: `String?`
- `rating`: `Int?` — Client interest score (1 to 5).
- `createdAt`: `DateTime @default(now())`
- `deletedAt`: `DateTime?`
- **Indices**: `@@index([organizationId, scheduledAt])`.

#### 19. `Task`
General operational tasks for brokers and agency administrators.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `assignedToId`: `String` (FK -> `User.id`)
- `title`: `String`
- `description`: `String?`
- `dueDate`: `DateTime?`
- `isCompleted`: `Boolean @default(false)`
- `createdAt`: `DateTime @default(now())`

#### 20. `Activity`
Comprehensive audit feed tracking all interactions and transitions on a lead or customer.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `leadId`: `String?` (FK -> `Lead.id`)
- `userId`: `String?` (FK -> `User.id`)
- `type`: `ActivityType` — `STAGE_CHANGED`, `CALL_LOGGED`, `MESSAGE_SENT`, `NOTE_ADDED`, `CREATED`, `UPDATED`, `ASSIGNED`.
- `title`: `String`
- `description`: `String?`
- `metadata`: `Json?` — e.g. `{"from": "NEW", "to": "CONTACTED"}`.
- `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([organizationId, leadId, createdAt DESC])`.

---

### 3.3 Communication Entity Group (3 Models)

#### 21. `Conversation`
Bi-directional chat thread between broker agency and a customer or lead.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `channel`: `ConversationChannel @default(WHATSAPP)`
- `contactPhone`: `String`
- `leadId`: `String?` (FK -> `Lead.id`)
- `unreadCount`: `Int @default(0)`
- `lastMessageText`: `String?`
- `lastMessageAt`: `DateTime?`
- `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([organizationId, contactPhone])`, `@@index([organizationId, lastMessageAt DESC])`.

#### 22. `Message`
Individual chat message in a conversation.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `conversationId`: `String` (FK -> `Conversation.id`)
- `senderType`: `SenderType` — `USER`, `CONTACT`, `SYSTEM`, `AI`.
- `senderId`: `String?`
- `direction`: `MessageDirection` — `INBOUND`, `OUTBOUND`.
- `messageType`: `MessageType @default(TEXT)` — `TEXT`, `IMAGE`, `DOCUMENT`, `AUDIO`, `VIDEO`, `TEMPLATE`.
- `content`: `String`
- `mediaUrl`: `String?`
- `status`: `MessageStatus @default(QUEUED)` — `QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`.
- `externalId`: `String?` — WhatsApp message ID (`wamid.xxx`).
- `sentAt`: `DateTime @default(now())`
- **Indices**: `@@index([conversationId, sentAt ASC])`.

#### 23. `WhatsAppTemplate`
Meta-approved pre-configured WhatsApp message templates.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `templateName`: `String` — Approved name on Meta Manager.
- `category`: `String` — `MARKETING`, `UTILITY`.
- `language`: `String @default("en")`
- `body`: `String` — Contains parameters like `{{1}}`, `{{2}}`.
- `status`: `String @default("APPROVED")`
- `createdAt`: `DateTime @default(now())`

---

### 3.4 Integrations Entity Group (3 Models)

#### 24. `Integration`
Configured third-party service connection and operational status.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String?` (Null represents global Super Admin integration)
- `type`: `IntegrationType` — `HOUSING_COM`, `META_WHATSAPP`, `RAZORPAY`, `GROQ_AI`, `FCM`, `DIGITALOCEAN_SPACES`.
- `credentialsEncrypted`: `String` — AES-256-GCM format `iv:tag:ciphertext`.
- `isActive`: `Boolean @default(true)`
- `lastSyncAt`: `DateTime?`
- `lastError`: `String?`
- `createdAt`: `DateTime @default(now())`

#### 25. `IntegrationLog`
Detailed communication logs with external APIs.
- `id`: `String @id @default(cuid())`
- `integrationId`: `String` (FK -> `Integration.id`)
- `endpoint`: `String`
- `statusCode`: `Int?`
- `latencyMs`: `Int?`
- `error`: `String?`
- `createdAt`: `DateTime @default(now())`

#### 26. `WebhookEvent`
Idempotent record of incoming webhooks from Housing.com, Meta, and Razorpay.
- `id`: `String @id @default(cuid())`
- `provider`: `String` — `HOUSING`, `META_WHATSAPP`, `RAZORPAY`.
- `eventId`: `String @unique` — External unique event ID.
- `payload`: `Json`
- `processed`: `Boolean @default(false)`
- `createdAt`: `DateTime @default(now())`

---

### 3.5 Automation Entity Group (2 Models)

#### 27. `AutomationRule`
Configurable event-trigger-action workflows.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `name`: `String`
- `trigger`: `AutomationTrigger` — `LEAD_CREATED`, `LEAD_STAGE_CHANGED`, `INCOMING_WHATSAPP`, `FOLLOW_UP_OVERDUE`, `SITE_VISIT_SCHEDULED`.
- `conditions`: `Json` — Evaluation criteria (e.g. `stage == 'NEW'`, `source == 'HOUSING'`).
- `actions`: `Json` — Execution tasks (e.g. Send WhatsApp Template, Assign Staff, Create Follow-Up).
- `delayMinutes`: `Int @default(0)`
- `onlyInBusinessHours`: `Boolean @default(true)`
- `isActive`: `Boolean @default(true)`
- `createdAt`: `DateTime @default(now())`

#### 28. `AutomationExecution`
Execution logs documenting rule evaluations.
- `id`: `String @id @default(cuid())`
- `ruleId`: `String` (FK -> `AutomationRule.id`)
- `targetEntityId`: `String` — ID of Lead or Message evaluated.
- `status`: `String` — `SUCCESS`, `FAILED`, `SKIPPED`.
- `executedAt`: `DateTime @default(now())`

---

### 3.6 AI Entity Group (2 Models)

#### 29. `AIResult`
Persisted inference results generated by Groq LLM pipelines.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `taskType`: `AITaskType` — `FEATURE_EXTRACTION`, `CONVERSATION_SUMMARY`, `REPLY_SUGGESTION`, `LEAD_SCORING`, `PROPERTY_MATCHING`.
- `inputPayloadHash`: `String`
- `outputContent`: `String`
- `confidence`: `Float?`
- `createdAt`: `DateTime @default(now())`

#### 30. `AIUsage`
Granular token consumption tracking for billing and cost containment.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `model`: `String` — e.g. `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`.
- `promptTokens`: `Int`
- `completionTokens`: `Int`
- `totalTokens`: `Int`
- `costEstimatedInr`: `Float @default(0)`
- `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([organizationId, createdAt])`.

---

### 3.7 Platform Entity Group (3 Models)

#### 31. `Notification`
In-app and push notification dispatch ledger.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String` (FK -> `Organization.id`)
- `userId`: `String` (FK -> `User.id`)
- `type`: `NotificationType` — `LEAD_ASSIGNED`, `FOLLOW_UP_REMINDER`, `SITE_VISIT_REMINDER`, `WHATSAPP_RECEIVED`, `SYSTEM_ALERT`, `SUBSCRIPTION_EVENT`.
- `title`: `String`
- `body`: `String`
- `data`: `Json?`
- `isRead`: `Boolean @default(false)`
- `createdAt`: `DateTime @default(now())`

#### 32. `AuditLog`
Immutable security and administrative audit trail.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String?` (FK -> `Organization.id`)
- `userId`: `String?` (FK -> `User.id`)
- `actorEmail`: `String?`
- `actorIp`: `String?`
- `action`: `AuditAction` — `LOGIN`, `LOGOUT`, `CREDENTIAL_UPDATE`, `SUBSCRIPTION_CHANGE`, `PLAN_CHANGE`, `INTEGRATION_CHANGE`, `MEMBER_INVITE`, `MEMBER_REMOVE`.
- `entityType`: `String`
- `entityId`: `String`
- `oldValues`: `Json?`
- `newValues`: `Json?`
- `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([organizationId, createdAt DESC])`, `@@index([action])`.

#### 33. `SystemSetting`
Hierarchical platform configuration key-values.
- `id`: `String @id @default(cuid())`
- `organizationId`: `String?` (Null = Global Platform Setting; Set = Tenant Override)
- `category`: `SystemSettingCategory` — `GENERAL`, `BRANDING`, `AI`, `PAYMENTS`, `WHATSAPP`, `HOUSING`, `STORAGE`, `NOTIFICATIONS`, `SECURITY`, `FEATURE_FLAGS`.
- `key`: `String`
- `value`: `Json`
- `createdAt`: `DateTime @default(now())`
- `updatedAt`: `DateTime @updatedAt`
- **Indices & Constraints**: `@@unique([organizationId, key])`.
