// Generated Prisma Client Typings for BrokerIQ
// Schema: /Users/yashjangid/Desktop/BrokerIQ/apps/api/prisma/schema.prisma

export type Decimal = number | string;
export type JsonValue = string | number | boolean | { [key: string]: JsonValue } | JsonValue[] | null;
export type InputJsonValue = string | number | boolean | { [key: string]: InputJsonValue } | InputJsonValue[] | null;

// ==========================================
// ENUMS
// ==========================================

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  BROKER_ADMIN = 'BROKER_ADMIN',
  BROKER_STAFF = 'BROKER_STAFF',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum PlanTier {
  FOUNDER = 'FOUNDER',
  STARTER = 'STARTER',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
}

export enum BillingPeriod {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  RAZORPAY = 'RAZORPAY',
  STRIPE = 'STRIPE',
  MANUAL = 'MANUAL',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum LeadStage {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  INTERESTED = 'INTERESTED',
  FOLLOW_UP = 'FOLLOW_UP',
  SITE_VISIT = 'SITE_VISIT',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
  NOT_INTERESTED = 'NOT_INTERESTED',
}

export enum LeadSource {
  HOUSING_COM = 'HOUSING_COM',
  ACRES99 = 'ACRES99',
  MAGICBRICKS = 'MAGICBRICKS',
  WHATSAPP = 'WHATSAPP',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  WALK_IN = 'WALK_IN',
  MANUAL = 'MANUAL',
}

export enum PropertyType {
  APARTMENT = 'APARTMENT',
  VILLA = 'VILLA',
  PLOT = 'PLOT',
  COMMERCIAL = 'COMMERCIAL',
  PENTHOUSE = 'PENTHOUSE',
  FLOOR = 'FLOOR',
}

export enum ListingType {
  SALE = 'SALE',
  RENT = 'RENT',
}

export enum PropertyStatus {
  AVAILABLE = 'AVAILABLE',
  UNDER_OFFER = 'UNDER_OFFER',
  SOLD = 'SOLD',
  RENTED = 'RENTED',
  INACTIVE = 'INACTIVE',
}

export enum FurnishingStatus {
  UNFURNISHED = 'UNFURNISHED',
  SEMI_FURNISHED = 'SEMI_FURNISHED',
  FULLY_FURNISHED = 'FULLY_FURNISHED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum FollowUpStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
  MISSED = 'MISSED',
}

export enum FollowUpType {
  CALL = 'CALL',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  IN_PERSON = 'IN_PERSON',
  MEETING = 'MEETING',
}

export enum SiteVisitStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ActivityType {
  STAGE_CHANGED = 'STAGE_CHANGED',
  CALL_LOGGED = 'CALL_LOGGED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  NOTE_ADDED = 'NOTE_ADDED',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  ASSIGNED = 'ASSIGNED',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum IntegrationType {
  HOUSING_COM = 'HOUSING_COM',
  META_WHATSAPP = 'META_WHATSAPP',
  RAZORPAY = 'RAZORPAY',
  GROQ_AI = 'GROQ_AI',
  FCM = 'FCM',
  DIGITALOCEAN_SPACES = 'DIGITALOCEAN_SPACES',
}

export enum AutomationTrigger {
  LEAD_CREATED = 'LEAD_CREATED',
  LEAD_STAGE_CHANGED = 'LEAD_STAGE_CHANGED',
  INCOMING_WHATSAPP = 'INCOMING_WHATSAPP',
  FOLLOW_UP_OVERDUE = 'FOLLOW_UP_OVERDUE',
  SITE_VISIT_SCHEDULED = 'SITE_VISIT_SCHEDULED',
}

export enum AITaskType {
  FEATURE_EXTRACTION = 'FEATURE_EXTRACTION',
  CONVERSATION_SUMMARY = 'CONVERSATION_SUMMARY',
  REPLY_SUGGESTION = 'REPLY_SUGGESTION',
  LEAD_SCORING = 'LEAD_SCORING',
  PROPERTY_MATCHING = 'PROPERTY_MATCHING',
}

export enum NotificationType {
  LEAD_ASSIGNED = 'LEAD_ASSIGNED',
  FOLLOW_UP_REMINDER = 'FOLLOW_UP_REMINDER',
  SITE_VISIT_REMINDER = 'SITE_VISIT_REMINDER',
  WHATSAPP_RECEIVED = 'WHATSAPP_RECEIVED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  SUBSCRIPTION_EVENT = 'SUBSCRIPTION_EVENT',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREDENTIAL_UPDATE = 'CREDENTIAL_UPDATE',
  SUBSCRIPTION_CHANGE = 'SUBSCRIPTION_CHANGE',
  PLAN_CHANGE = 'PLAN_CHANGE',
  INTEGRATION_CHANGE = 'INTEGRATION_CHANGE',
  MEMBER_INVITE = 'MEMBER_INVITE',
  MEMBER_REMOVE = 'MEMBER_REMOVE',
}

export enum SystemSettingCategory {
  GENERAL = 'GENERAL',
  BRANDING = 'BRANDING',
  AI = 'AI',
  PAYMENTS = 'PAYMENTS',
  WHATSAPP = 'WHATSAPP',
  HOUSING = 'HOUSING',
  STORAGE = 'STORAGE',
  NOTIFICATIONS = 'NOTIFICATIONS',
  SECURITY = 'SECURITY',
  FEATURE_FLAGS = 'FEATURE_FLAGS',
}

// ==========================================
// MODEL INTERFACES
// ==========================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: OrganizationStatus;
  maxBrokers: number;
  isFounder: boolean;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  members?: OrganizationMember[];
  featureFlags?: FeatureFlag[];
  subscriptions?: Subscription[];
  payments?: Payment[];
  invoices?: Invoice[];
  usageCounters?: UsageCounter[];
  customers?: Customer[];
  leads?: Lead[];
  properties?: Property[];
  propertyOwners?: PropertyOwner[];
  followUps?: FollowUp[];
  siteVisits?: SiteVisit[];
  tasks?: Task[];
  activities?: Activity[];
  conversations?: Conversation[];
  messages?: Message[];
  whatsAppTemplates?: WhatsAppTemplate[];
  integrations?: Integration[];
  integrationLogs?: IntegrationLog[];
  webhookEvents?: WebhookEvent[];
  automationRules?: AutomationRule[];
  automationExecutions?: AutomationExecution[];
  aiResults?: AIResult[];
  aiUsages?: AIUsage[];
  notifications?: Notification[];
  auditLogs?: AuditLog[];
  systemSettings?: SystemSetting[];
}

export interface OrganizationCreateInput {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  status?: OrganizationStatus;
  maxBrokers?: number;
  isFounder?: boolean;
  trialEndsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationUpdateInput {
  id?: string;
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  status?: OrganizationStatus;
  maxBrokers?: number;
  isFounder?: boolean;
  trialEndsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Organization | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Organization | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Organization[]>;
  create(args: { data: OrganizationCreateInput | any; select?: any; include?: any }): Promise<Organization>;
  createMany(args: { data: (OrganizationCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: OrganizationUpdateInput | any; select?: any; include?: any }): Promise<Organization>;
  updateMany(args: { where?: any; data: OrganizationUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: OrganizationCreateInput | any; update: OrganizationUpdateInput | any; select?: any; include?: any }): Promise<Organization>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Organization>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  user?: User;
}

export interface OrganizationMemberCreateInput {
  id?: string;
  organizationId: string;
  userId: string;
  role?: Role;
  joinedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationMemberUpdateInput {
  id?: string;
  organizationId?: string;
  userId?: string;
  role?: Role;
  joinedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationMemberDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<OrganizationMember | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<OrganizationMember | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<OrganizationMember[]>;
  create(args: { data: OrganizationMemberCreateInput | any; select?: any; include?: any }): Promise<OrganizationMember>;
  createMany(args: { data: (OrganizationMemberCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: OrganizationMemberUpdateInput | any; select?: any; include?: any }): Promise<OrganizationMember>;
  updateMany(args: { where?: any; data: OrganizationMemberUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: OrganizationMemberCreateInput | any; update: OrganizationMemberUpdateInput | any; select?: any; include?: any }): Promise<OrganizationMember>;
  delete(args: { where: any; select?: any; include?: any }): Promise<OrganizationMember>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  passwordHash: string;
  name: string;
  role: Role;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberships?: OrganizationMember[];
  assignedLeads?: Lead[];
  assignedFollowUps?: FollowUp[];
  assignedSiteVisits?: SiteVisit[];
  assignedTasks?: Task[];
  createdTasks?: Task[];
  activities?: Activity[];
  notifications?: Notification[];
  auditLogs?: AuditLog[];
}

export interface UserCreateInput {
  id?: string;
  email: string;
  phone: string;
  passwordHash: string;
  name: string;
  role?: Role;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserUpdateInput {
  id?: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  name?: string;
  role?: Role;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<User | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<User | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<User[]>;
  create(args: { data: UserCreateInput | any; select?: any; include?: any }): Promise<User>;
  createMany(args: { data: (UserCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: UserUpdateInput | any; select?: any; include?: any }): Promise<User>;
  updateMany(args: { where?: any; data: UserUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: UserCreateInput | any; update: UserUpdateInput | any; select?: any; include?: any }): Promise<User>;
  delete(args: { where: any; select?: any; include?: any }): Promise<User>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  priceMonthly: Decimal;
  priceAnnual: Decimal;
  currency: string;
  trialDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  features?: PlanFeature[];
  limits?: FeatureLimit[];
  subscriptions?: Subscription[];
}

export interface PlanCreateInput {
  id?: string;
  tier: PlanTier;
  name: string;
  description?: string | null;
  priceMonthly?: Decimal;
  priceAnnual?: Decimal;
  currency?: string;
  trialDays?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlanUpdateInput {
  id?: string;
  tier?: PlanTier;
  name?: string;
  description?: string | null;
  priceMonthly?: Decimal;
  priceAnnual?: Decimal;
  currency?: string;
  trialDays?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlanDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Plan | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Plan | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Plan[]>;
  create(args: { data: PlanCreateInput | any; select?: any; include?: any }): Promise<Plan>;
  createMany(args: { data: (PlanCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: PlanUpdateInput | any; select?: any; include?: any }): Promise<Plan>;
  updateMany(args: { where?: any; data: PlanUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: PlanCreateInput | any; update: PlanUpdateInput | any; select?: any; include?: any }): Promise<Plan>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Plan>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface PlanFeature {
  id: string;
  planId: string;
  code: string;
  name: string;
  description: string | null;
  isIncluded: boolean;
  createdAt: Date;
  updatedAt: Date;
  plan?: Plan;
}

export interface PlanFeatureCreateInput {
  id?: string;
  planId: string;
  code: string;
  name: string;
  description?: string | null;
  isIncluded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlanFeatureUpdateInput {
  id?: string;
  planId?: string;
  code?: string;
  name?: string;
  description?: string | null;
  isIncluded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlanFeatureDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<PlanFeature | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<PlanFeature | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<PlanFeature[]>;
  create(args: { data: PlanFeatureCreateInput | any; select?: any; include?: any }): Promise<PlanFeature>;
  createMany(args: { data: (PlanFeatureCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: PlanFeatureUpdateInput | any; select?: any; include?: any }): Promise<PlanFeature>;
  updateMany(args: { where?: any; data: PlanFeatureUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: PlanFeatureCreateInput | any; update: PlanFeatureUpdateInput | any; select?: any; include?: any }): Promise<PlanFeature>;
  delete(args: { where: any; select?: any; include?: any }): Promise<PlanFeature>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface FeatureLimit {
  id: string;
  planId: string;
  code: string;
  maxUnits: number;
  period: string;
  createdAt: Date;
  updatedAt: Date;
  plan?: Plan;
}

export interface FeatureLimitCreateInput {
  id?: string;
  planId: string;
  code: string;
  maxUnits: number;
  period?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureLimitUpdateInput {
  id?: string;
  planId?: string;
  code?: string;
  maxUnits?: number;
  period?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureLimitDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<FeatureLimit | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<FeatureLimit | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<FeatureLimit[]>;
  create(args: { data: FeatureLimitCreateInput | any; select?: any; include?: any }): Promise<FeatureLimit>;
  createMany(args: { data: (FeatureLimitCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: FeatureLimitUpdateInput | any; select?: any; include?: any }): Promise<FeatureLimit>;
  updateMany(args: { where?: any; data: FeatureLimitUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: FeatureLimitCreateInput | any; update: FeatureLimitUpdateInput | any; select?: any; include?: any }): Promise<FeatureLimit>;
  delete(args: { where: any; select?: any; include?: any }): Promise<FeatureLimit>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface FeatureFlag {
  id: string;
  organizationId: string | null;
  key: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization | null;
}

export interface FeatureFlagCreateInput {
  id?: string;
  organizationId?: string | null;
  key: string;
  isEnabled?: boolean;
  rolloutPercentage?: number;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureFlagUpdateInput {
  id?: string;
  organizationId?: string | null;
  key?: string;
  isEnabled?: boolean;
  rolloutPercentage?: number;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureFlagDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<FeatureFlag | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<FeatureFlag | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<FeatureFlag[]>;
  create(args: { data: FeatureFlagCreateInput | any; select?: any; include?: any }): Promise<FeatureFlag>;
  createMany(args: { data: (FeatureFlagCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: FeatureFlagUpdateInput | any; select?: any; include?: any }): Promise<FeatureFlag>;
  updateMany(args: { where?: any; data: FeatureFlagUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: FeatureFlagCreateInput | any; update: FeatureFlagUpdateInput | any; select?: any; include?: any }): Promise<FeatureFlag>;
  delete(args: { where: any; select?: any; include?: any }): Promise<FeatureFlag>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  billingInterval: BillingPeriod;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialStart: Date | null;
  trialEnd: Date | null;
  gracePeriodEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  plan?: Plan;
  payments?: Payment[];
  invoices?: Invoice[];
}

export interface SubscriptionCreateInput {
  id?: string;
  organizationId: string;
  planId: string;
  status?: SubscriptionStatus;
  billingInterval?: BillingPeriod;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  gracePeriodEndsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionUpdateInput {
  id?: string;
  organizationId?: string;
  planId?: string;
  status?: SubscriptionStatus;
  billingInterval?: BillingPeriod;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  gracePeriodEndsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Subscription | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Subscription | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Subscription[]>;
  create(args: { data: SubscriptionCreateInput | any; select?: any; include?: any }): Promise<Subscription>;
  createMany(args: { data: (SubscriptionCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: SubscriptionUpdateInput | any; select?: any; include?: any }): Promise<Subscription>;
  updateMany(args: { where?: any; data: SubscriptionUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: SubscriptionCreateInput | any; update: SubscriptionUpdateInput | any; select?: any; include?: any }): Promise<Subscription>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Subscription>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Payment {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  amount: Decimal;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  signature: string | null;
  invoiceUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  subscription?: Subscription | null;
  invoices?: Invoice[];
}

export interface PaymentCreateInput {
  id?: string;
  organizationId: string;
  subscriptionId?: string | null;
  amount: Decimal;
  currency?: string;
  status?: PaymentStatus;
  provider?: PaymentProvider;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  signature?: string | null;
  invoiceUrl?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentUpdateInput {
  id?: string;
  organizationId?: string;
  subscriptionId?: string | null;
  amount?: Decimal;
  currency?: string;
  status?: PaymentStatus;
  provider?: PaymentProvider;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  signature?: string | null;
  invoiceUrl?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Payment | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Payment | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Payment[]>;
  create(args: { data: PaymentCreateInput | any; select?: any; include?: any }): Promise<Payment>;
  createMany(args: { data: (PaymentCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: PaymentUpdateInput | any; select?: any; include?: any }): Promise<Payment>;
  updateMany(args: { where?: any; data: PaymentUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: PaymentCreateInput | any; update: PaymentUpdateInput | any; select?: any; include?: any }): Promise<Payment>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Payment>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Invoice {
  id: string;
  organizationId: string;
  paymentId: string | null;
  subscriptionId: string | null;
  invoiceNumber: string;
  amount: Decimal;
  tax: Decimal;
  totalAmount: Decimal;
  currency: string;
  status: InvoiceStatus;
  invoicePdfUrl: string | null;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  payment?: Payment | null;
  subscription?: Subscription | null;
}

export interface InvoiceCreateInput {
  id?: string;
  organizationId: string;
  paymentId?: string | null;
  subscriptionId?: string | null;
  invoiceNumber: string;
  amount: Decimal;
  tax?: Decimal;
  totalAmount: Decimal;
  currency?: string;
  status?: InvoiceStatus;
  invoicePdfUrl?: string | null;
  dueDate: Date;
  paidAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceUpdateInput {
  id?: string;
  organizationId?: string;
  paymentId?: string | null;
  subscriptionId?: string | null;
  invoiceNumber?: string;
  amount?: Decimal;
  tax?: Decimal;
  totalAmount?: Decimal;
  currency?: string;
  status?: InvoiceStatus;
  invoicePdfUrl?: string | null;
  dueDate?: Date;
  paidAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Invoice | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Invoice | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Invoice[]>;
  create(args: { data: InvoiceCreateInput | any; select?: any; include?: any }): Promise<Invoice>;
  createMany(args: { data: (InvoiceCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: InvoiceUpdateInput | any; select?: any; include?: any }): Promise<Invoice>;
  updateMany(args: { where?: any; data: InvoiceUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: InvoiceCreateInput | any; update: InvoiceUpdateInput | any; select?: any; include?: any }): Promise<Invoice>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Invoice>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface UsageCounter {
  id: string;
  organizationId: string;
  metric: string;
  count: number;
  periodStart: Date;
  periodEnd: Date;
  updatedAt: Date;
  organization?: Organization;
}

export interface UsageCounterCreateInput {
  id?: string;
  organizationId: string;
  metric: string;
  count?: number;
  periodStart: Date;
  periodEnd: Date;
  updatedAt?: Date;
}

export interface UsageCounterUpdateInput {
  id?: string;
  organizationId?: string;
  metric?: string;
  count?: number;
  periodStart?: Date;
  periodEnd?: Date;
  updatedAt?: Date;
}

export interface UsageCounterDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<UsageCounter | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<UsageCounter | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<UsageCounter[]>;
  create(args: { data: UsageCounterCreateInput | any; select?: any; include?: any }): Promise<UsageCounter>;
  createMany(args: { data: (UsageCounterCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: UsageCounterUpdateInput | any; select?: any; include?: any }): Promise<UsageCounter>;
  updateMany(args: { where?: any; data: UsageCounterUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: UsageCounterCreateInput | any; update: UsageCounterUpdateInput | any; select?: any; include?: any }): Promise<UsageCounter>;
  delete(args: { where: any; select?: any; include?: any }): Promise<UsageCounter>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: Decimal;
  maxUses: number;
  usedCount: number;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface CouponCreateInput {
  id?: string;
  code: string;
  discountType?: string;
  discountValue: Decimal;
  maxUses?: number;
  usedCount?: number;
  validUntil: Date;
  isActive?: boolean;
  createdAt?: Date;
}

export interface CouponUpdateInput {
  id?: string;
  code?: string;
  discountType?: string;
  discountValue?: Decimal;
  maxUses?: number;
  usedCount?: number;
  validUntil?: Date;
  isActive?: boolean;
  createdAt?: Date;
}

export interface CouponDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Coupon | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Coupon | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Coupon[]>;
  create(args: { data: CouponCreateInput | any; select?: any; include?: any }): Promise<Coupon>;
  createMany(args: { data: (CouponCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: CouponUpdateInput | any; select?: any; include?: any }): Promise<Coupon>;
  updateMany(args: { where?: any; data: CouponUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: CouponCreateInput | any; update: CouponUpdateInput | any; select?: any; include?: any }): Promise<Coupon>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Coupon>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  leads?: Lead[];
  conversations?: Conversation[];
}

export interface CustomerCreateInput {
  id?: string;
  organizationId: string;
  name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  notes?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerUpdateInput {
  id?: string;
  organizationId?: string;
  name?: string;
  email?: string | null;
  phone?: string;
  address?: string | null;
  notes?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Customer | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Customer | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Customer[]>;
  create(args: { data: CustomerCreateInput | any; select?: any; include?: any }): Promise<Customer>;
  createMany(args: { data: (CustomerCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: CustomerUpdateInput | any; select?: any; include?: any }): Promise<Customer>;
  updateMany(args: { where?: any; data: CustomerUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: CustomerCreateInput | any; update: CustomerUpdateInput | any; select?: any; include?: any }): Promise<Customer>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Customer>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Lead {
  id: string;
  organizationId: string;
  customerId: string | null;
  title: string;
  stage: LeadStage;
  source: LeadSource;
  budgetMin: Decimal | null;
  budgetMax: Decimal | null;
  currency: string;
  preferredLocation: string | null;
  preferredBhk: string | null;
  preferredPropertyType: PropertyType | null;
  assignedToId: string | null;
  score: number;
  notes: string | null;
  lostReason: string | null;
  wonAmount: Decimal | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  customer?: Customer | null;
  assignedTo?: User | null;
  followUps?: FollowUp[];
  siteVisits?: SiteVisit[];
  tasks?: Task[];
  activities?: Activity[];
  conversations?: Conversation[];
  automationExecutions?: AutomationExecution[];
}

export interface LeadCreateInput {
  id?: string;
  organizationId: string;
  customerId?: string | null;
  title: string;
  stage?: LeadStage;
  source?: LeadSource;
  budgetMin?: Decimal | null;
  budgetMax?: Decimal | null;
  currency?: string;
  preferredLocation?: string | null;
  preferredBhk?: string | null;
  preferredPropertyType?: PropertyType | null;
  assignedToId?: string | null;
  score?: number;
  notes?: string | null;
  lostReason?: string | null;
  wonAmount?: Decimal | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeadUpdateInput {
  id?: string;
  organizationId?: string;
  customerId?: string | null;
  title?: string;
  stage?: LeadStage;
  source?: LeadSource;
  budgetMin?: Decimal | null;
  budgetMax?: Decimal | null;
  currency?: string;
  preferredLocation?: string | null;
  preferredBhk?: string | null;
  preferredPropertyType?: PropertyType | null;
  assignedToId?: string | null;
  score?: number;
  notes?: string | null;
  lostReason?: string | null;
  wonAmount?: Decimal | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeadDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Lead | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Lead | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Lead[]>;
  create(args: { data: LeadCreateInput | any; select?: any; include?: any }): Promise<Lead>;
  createMany(args: { data: (LeadCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: LeadUpdateInput | any; select?: any; include?: any }): Promise<Lead>;
  updateMany(args: { where?: any; data: LeadUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: LeadCreateInput | any; update: LeadUpdateInput | any; select?: any; include?: any }): Promise<Lead>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Lead>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Property {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  propertyType: PropertyType;
  listingType: ListingType;
  status: PropertyStatus;
  price: Decimal;
  currency: string;
  maintenanceCharges: Decimal | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  locality: string;
  latitude: number | null;
  longitude: number | null;
  bhk: number | null;
  bathrooms: number | null;
  balconies: number | null;
  superAreaSqFt: Decimal | null;
  carpetAreaSqFt: Decimal | null;
  furnishingStatus: FurnishingStatus;
  parkingAvailable: boolean;
  floorNumber: number | null;
  totalFloors: number | null;
  propertyAgeYears: number | null;
  amenities: string[];
  images: string[];
  housingListingId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  owners?: PropertyOwner[];
  siteVisits?: SiteVisit[];
  tasks?: Task[];
}

export interface PropertyCreateInput {
  id?: string;
  organizationId: string;
  title: string;
  description?: string | null;
  propertyType: PropertyType;
  listingType: ListingType;
  status?: PropertyStatus;
  price: Decimal;
  currency?: string;
  maintenanceCharges?: Decimal | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  locality: string;
  latitude?: number | null;
  longitude?: number | null;
  bhk?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  superAreaSqFt?: Decimal | null;
  carpetAreaSqFt?: Decimal | null;
  furnishingStatus?: FurnishingStatus;
  parkingAvailable?: boolean;
  floorNumber?: number | null;
  totalFloors?: number | null;
  propertyAgeYears?: number | null;
  amenities?: string[];
  images?: string[];
  housingListingId?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PropertyUpdateInput {
  id?: string;
  organizationId?: string;
  title?: string;
  description?: string | null;
  propertyType?: PropertyType;
  listingType?: ListingType;
  status?: PropertyStatus;
  price?: Decimal;
  currency?: string;
  maintenanceCharges?: Decimal | null;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  locality?: string;
  latitude?: number | null;
  longitude?: number | null;
  bhk?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  superAreaSqFt?: Decimal | null;
  carpetAreaSqFt?: Decimal | null;
  furnishingStatus?: FurnishingStatus;
  parkingAvailable?: boolean;
  floorNumber?: number | null;
  totalFloors?: number | null;
  propertyAgeYears?: number | null;
  amenities?: string[];
  images?: string[];
  housingListingId?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PropertyDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Property | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Property | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Property[]>;
  create(args: { data: PropertyCreateInput | any; select?: any; include?: any }): Promise<Property>;
  createMany(args: { data: (PropertyCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: PropertyUpdateInput | any; select?: any; include?: any }): Promise<Property>;
  updateMany(args: { where?: any; data: PropertyUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: PropertyCreateInput | any; update: PropertyUpdateInput | any; select?: any; include?: any }): Promise<Property>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Property>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface PropertyOwner {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  property?: Property;
}

export interface PropertyOwnerCreateInput {
  id?: string;
  organizationId: string;
  propertyId: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PropertyOwnerUpdateInput {
  id?: string;
  organizationId?: string;
  propertyId?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PropertyOwnerDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<PropertyOwner | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<PropertyOwner | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<PropertyOwner[]>;
  create(args: { data: PropertyOwnerCreateInput | any; select?: any; include?: any }): Promise<PropertyOwner>;
  createMany(args: { data: (PropertyOwnerCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: PropertyOwnerUpdateInput | any; select?: any; include?: any }): Promise<PropertyOwner>;
  updateMany(args: { where?: any; data: PropertyOwnerUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: PropertyOwnerCreateInput | any; update: PropertyOwnerUpdateInput | any; select?: any; include?: any }): Promise<PropertyOwner>;
  delete(args: { where: any; select?: any; include?: any }): Promise<PropertyOwner>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface FollowUp {
  id: string;
  organizationId: string;
  leadId: string;
  scheduledAt: Date;
  reminderAt: Date | null;
  status: FollowUpStatus;
  priority: Priority;
  type: FollowUpType;
  notes: string | null;
  outcome: string | null;
  completedAt: Date | null;
  assignedToId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  lead?: Lead;
  assignedTo?: User | null;
}

export interface FollowUpCreateInput {
  id?: string;
  organizationId: string;
  leadId: string;
  scheduledAt: Date;
  reminderAt?: Date | null;
  status?: FollowUpStatus;
  priority?: Priority;
  type?: FollowUpType;
  notes?: string | null;
  outcome?: string | null;
  completedAt?: Date | null;
  assignedToId?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FollowUpUpdateInput {
  id?: string;
  organizationId?: string;
  leadId?: string;
  scheduledAt?: Date;
  reminderAt?: Date | null;
  status?: FollowUpStatus;
  priority?: Priority;
  type?: FollowUpType;
  notes?: string | null;
  outcome?: string | null;
  completedAt?: Date | null;
  assignedToId?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FollowUpDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<FollowUp | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<FollowUp | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<FollowUp[]>;
  create(args: { data: FollowUpCreateInput | any; select?: any; include?: any }): Promise<FollowUp>;
  createMany(args: { data: (FollowUpCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: FollowUpUpdateInput | any; select?: any; include?: any }): Promise<FollowUp>;
  updateMany(args: { where?: any; data: FollowUpUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: FollowUpCreateInput | any; update: FollowUpUpdateInput | any; select?: any; include?: any }): Promise<FollowUp>;
  delete(args: { where: any; select?: any; include?: any }): Promise<FollowUp>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface SiteVisit {
  id: string;
  organizationId: string;
  leadId: string;
  propertyId: string;
  scheduledAt: Date;
  status: SiteVisitStatus;
  feedback: string | null;
  rating: number | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  assignedToId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  lead?: Lead;
  property?: Property;
  assignedTo?: User | null;
}

export interface SiteVisitCreateInput {
  id?: string;
  organizationId: string;
  leadId: string;
  propertyId: string;
  scheduledAt: Date;
  status?: SiteVisitStatus;
  feedback?: string | null;
  rating?: number | null;
  cancellationReason?: string | null;
  completedAt?: Date | null;
  assignedToId?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SiteVisitUpdateInput {
  id?: string;
  organizationId?: string;
  leadId?: string;
  propertyId?: string;
  scheduledAt?: Date;
  status?: SiteVisitStatus;
  feedback?: string | null;
  rating?: number | null;
  cancellationReason?: string | null;
  completedAt?: Date | null;
  assignedToId?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SiteVisitDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<SiteVisit | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<SiteVisit | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<SiteVisit[]>;
  create(args: { data: SiteVisitCreateInput | any; select?: any; include?: any }): Promise<SiteVisit>;
  createMany(args: { data: (SiteVisitCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: SiteVisitUpdateInput | any; select?: any; include?: any }): Promise<SiteVisit>;
  updateMany(args: { where?: any; data: SiteVisitUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: SiteVisitCreateInput | any; update: SiteVisitUpdateInput | any; select?: any; include?: any }): Promise<SiteVisit>;
  delete(args: { where: any; select?: any; include?: any }): Promise<SiteVisit>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Task {
  id: string;
  organizationId: string;
  leadId: string | null;
  propertyId: string | null;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: Priority;
  status: TaskStatus;
  assignedToId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  lead?: Lead | null;
  property?: Property | null;
  assignedTo?: User | null;
  createdBy?: User | null;
}

export interface TaskCreateInput {
  id?: string;
  organizationId: string;
  leadId?: string | null;
  propertyId?: string | null;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: Priority;
  status?: TaskStatus;
  assignedToId?: string | null;
  createdById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TaskUpdateInput {
  id?: string;
  organizationId?: string;
  leadId?: string | null;
  propertyId?: string | null;
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: Priority;
  status?: TaskStatus;
  assignedToId?: string | null;
  createdById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TaskDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Task | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Task | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Task[]>;
  create(args: { data: TaskCreateInput | any; select?: any; include?: any }): Promise<Task>;
  createMany(args: { data: (TaskCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: TaskUpdateInput | any; select?: any; include?: any }): Promise<Task>;
  updateMany(args: { where?: any; data: TaskUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: TaskCreateInput | any; update: TaskUpdateInput | any; select?: any; include?: any }): Promise<Task>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Task>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Activity {
  id: string;
  organizationId: string;
  leadId: string | null;
  userId: string | null;
  type: ActivityType;
  description: string;
  metadata: JsonValue | null;
  createdAt: Date;
  organization?: Organization;
  lead?: Lead | null;
  user?: User | null;
}

export interface ActivityCreateInput {
  id?: string;
  organizationId: string;
  leadId?: string | null;
  userId?: string | null;
  type: ActivityType;
  description: string;
  metadata?: JsonValue | null;
  createdAt?: Date;
}

export interface ActivityUpdateInput {
  id?: string;
  organizationId?: string;
  leadId?: string | null;
  userId?: string | null;
  type?: ActivityType;
  description?: string;
  metadata?: JsonValue | null;
  createdAt?: Date;
}

export interface ActivityDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Activity | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Activity | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Activity[]>;
  create(args: { data: ActivityCreateInput | any; select?: any; include?: any }): Promise<Activity>;
  createMany(args: { data: (ActivityCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: ActivityUpdateInput | any; select?: any; include?: any }): Promise<Activity>;
  updateMany(args: { where?: any; data: ActivityUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: ActivityCreateInput | any; update: ActivityUpdateInput | any; select?: any; include?: any }): Promise<Activity>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Activity>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Conversation {
  id: string;
  organizationId: string;
  leadId: string | null;
  customerId: string | null;
  customerPhone: string;
  channel: string;
  unreadCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  lead?: Lead | null;
  customer?: Customer | null;
  messages?: Message[];
}

export interface ConversationCreateInput {
  id?: string;
  organizationId: string;
  leadId?: string | null;
  customerId?: string | null;
  customerPhone: string;
  channel?: string;
  unreadCount?: number;
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationUpdateInput {
  id?: string;
  organizationId?: string;
  leadId?: string | null;
  customerId?: string | null;
  customerPhone?: string;
  channel?: string;
  unreadCount?: number;
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Conversation | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Conversation | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Conversation[]>;
  create(args: { data: ConversationCreateInput | any; select?: any; include?: any }): Promise<Conversation>;
  createMany(args: { data: (ConversationCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: ConversationUpdateInput | any; select?: any; include?: any }): Promise<Conversation>;
  updateMany(args: { where?: any; data: ConversationUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: ConversationCreateInput | any; update: ConversationUpdateInput | any; select?: any; include?: any }): Promise<Conversation>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Conversation>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Message {
  id: string;
  organizationId: string;
  conversationId: string;
  direction: MessageDirection;
  status: MessageStatus;
  senderId: string | null;
  messageType: string;
  content: string;
  mediaUrl: string | null;
  metadata: JsonValue | null;
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  organization?: Organization;
  conversation?: Conversation;
}

export interface MessageCreateInput {
  id?: string;
  organizationId: string;
  conversationId: string;
  direction: MessageDirection;
  status?: MessageStatus;
  senderId?: string | null;
  messageType?: string;
  content: string;
  mediaUrl?: string | null;
  metadata?: JsonValue | null;
  sentAt?: Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  createdAt?: Date;
}

export interface MessageUpdateInput {
  id?: string;
  organizationId?: string;
  conversationId?: string;
  direction?: MessageDirection;
  status?: MessageStatus;
  senderId?: string | null;
  messageType?: string;
  content?: string;
  mediaUrl?: string | null;
  metadata?: JsonValue | null;
  sentAt?: Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  createdAt?: Date;
}

export interface MessageDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Message | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Message | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Message[]>;
  create(args: { data: MessageCreateInput | any; select?: any; include?: any }): Promise<Message>;
  createMany(args: { data: (MessageCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: MessageUpdateInput | any; select?: any; include?: any }): Promise<Message>;
  updateMany(args: { where?: any; data: MessageUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: MessageCreateInput | any; update: MessageUpdateInput | any; select?: any; include?: any }): Promise<Message>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Message>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface WhatsAppTemplate {
  id: string;
  organizationId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
  headerText: string | null;
  footerText: string | null;
  buttons: JsonValue | null;
  variables: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
}

export interface WhatsAppTemplateCreateInput {
  id?: string;
  organizationId: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
  bodyText: string;
  headerText?: string | null;
  footerText?: string | null;
  buttons?: JsonValue | null;
  variables?: JsonValue | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppTemplateUpdateInput {
  id?: string;
  organizationId?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  bodyText?: string;
  headerText?: string | null;
  footerText?: string | null;
  buttons?: JsonValue | null;
  variables?: JsonValue | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppTemplateDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<WhatsAppTemplate | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<WhatsAppTemplate | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<WhatsAppTemplate[]>;
  create(args: { data: WhatsAppTemplateCreateInput | any; select?: any; include?: any }): Promise<WhatsAppTemplate>;
  createMany(args: { data: (WhatsAppTemplateCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: WhatsAppTemplateUpdateInput | any; select?: any; include?: any }): Promise<WhatsAppTemplate>;
  updateMany(args: { where?: any; data: WhatsAppTemplateUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: WhatsAppTemplateCreateInput | any; update: WhatsAppTemplateUpdateInput | any; select?: any; include?: any }): Promise<WhatsAppTemplate>;
  delete(args: { where: any; select?: any; include?: any }): Promise<WhatsAppTemplate>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Integration {
  id: string;
  organizationId: string;
  type: IntegrationType;
  status: string;
  encryptedCredentials: string | null;
  config: JsonValue | null;
  lastSyncAt: Date | null;
  errorDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  logs?: IntegrationLog[];
}

export interface IntegrationCreateInput {
  id?: string;
  organizationId: string;
  type: IntegrationType;
  status?: string;
  encryptedCredentials?: string | null;
  config?: JsonValue | null;
  lastSyncAt?: Date | null;
  errorDetails?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IntegrationUpdateInput {
  id?: string;
  organizationId?: string;
  type?: IntegrationType;
  status?: string;
  encryptedCredentials?: string | null;
  config?: JsonValue | null;
  lastSyncAt?: Date | null;
  errorDetails?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IntegrationDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Integration | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Integration | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Integration[]>;
  create(args: { data: IntegrationCreateInput | any; select?: any; include?: any }): Promise<Integration>;
  createMany(args: { data: (IntegrationCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: IntegrationUpdateInput | any; select?: any; include?: any }): Promise<Integration>;
  updateMany(args: { where?: any; data: IntegrationUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: IntegrationCreateInput | any; update: IntegrationUpdateInput | any; select?: any; include?: any }): Promise<Integration>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Integration>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface IntegrationLog {
  id: string;
  organizationId: string;
  integrationId: string;
  level: string;
  event: string;
  payload: JsonValue | null;
  error: string | null;
  createdAt: Date;
  organization?: Organization;
  integration?: Integration;
}

export interface IntegrationLogCreateInput {
  id?: string;
  organizationId: string;
  integrationId: string;
  level?: string;
  event: string;
  payload?: JsonValue | null;
  error?: string | null;
  createdAt?: Date;
}

export interface IntegrationLogUpdateInput {
  id?: string;
  organizationId?: string;
  integrationId?: string;
  level?: string;
  event?: string;
  payload?: JsonValue | null;
  error?: string | null;
  createdAt?: Date;
}

export interface IntegrationLogDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<IntegrationLog | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<IntegrationLog | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<IntegrationLog[]>;
  create(args: { data: IntegrationLogCreateInput | any; select?: any; include?: any }): Promise<IntegrationLog>;
  createMany(args: { data: (IntegrationLogCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: IntegrationLogUpdateInput | any; select?: any; include?: any }): Promise<IntegrationLog>;
  updateMany(args: { where?: any; data: IntegrationLogUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: IntegrationLogCreateInput | any; update: IntegrationLogUpdateInput | any; select?: any; include?: any }): Promise<IntegrationLog>;
  delete(args: { where: any; select?: any; include?: any }): Promise<IntegrationLog>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface WebhookEvent {
  id: string;
  organizationId: string | null;
  source: string;
  eventType: string;
  payload: JsonValue;
  status: string;
  errorDetails: string | null;
  processedAt: Date | null;
  createdAt: Date;
  organization?: Organization | null;
}

export interface WebhookEventCreateInput {
  id?: string;
  organizationId?: string | null;
  source: string;
  eventType: string;
  payload: JsonValue;
  status?: string;
  errorDetails?: string | null;
  processedAt?: Date | null;
  createdAt?: Date;
}

export interface WebhookEventUpdateInput {
  id?: string;
  organizationId?: string | null;
  source?: string;
  eventType?: string;
  payload?: JsonValue;
  status?: string;
  errorDetails?: string | null;
  processedAt?: Date | null;
  createdAt?: Date;
}

export interface WebhookEventDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<WebhookEvent | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<WebhookEvent | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<WebhookEvent[]>;
  create(args: { data: WebhookEventCreateInput | any; select?: any; include?: any }): Promise<WebhookEvent>;
  createMany(args: { data: (WebhookEventCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: WebhookEventUpdateInput | any; select?: any; include?: any }): Promise<WebhookEvent>;
  updateMany(args: { where?: any; data: WebhookEventUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: WebhookEventCreateInput | any; update: WebhookEventUpdateInput | any; select?: any; include?: any }): Promise<WebhookEvent>;
  delete(args: { where: any; select?: any; include?: any }): Promise<WebhookEvent>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface AutomationRule {
  id: string;
  organizationId: string;
  name: string;
  triggerType: AutomationTrigger;
  conditions: JsonValue;
  actions: JsonValue;
  delayMinutes: number;
  isBusinessHoursOnly: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization;
  executions?: AutomationExecution[];
}

export interface AutomationRuleCreateInput {
  id?: string;
  organizationId: string;
  name: string;
  triggerType: AutomationTrigger;
  conditions: JsonValue;
  actions: JsonValue;
  delayMinutes?: number;
  isBusinessHoursOnly?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AutomationRuleUpdateInput {
  id?: string;
  organizationId?: string;
  name?: string;
  triggerType?: AutomationTrigger;
  conditions?: JsonValue;
  actions?: JsonValue;
  delayMinutes?: number;
  isBusinessHoursOnly?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AutomationRuleDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<AutomationRule | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<AutomationRule | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<AutomationRule[]>;
  create(args: { data: AutomationRuleCreateInput | any; select?: any; include?: any }): Promise<AutomationRule>;
  createMany(args: { data: (AutomationRuleCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: AutomationRuleUpdateInput | any; select?: any; include?: any }): Promise<AutomationRule>;
  updateMany(args: { where?: any; data: AutomationRuleUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: AutomationRuleCreateInput | any; update: AutomationRuleUpdateInput | any; select?: any; include?: any }): Promise<AutomationRule>;
  delete(args: { where: any; select?: any; include?: any }): Promise<AutomationRule>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface AutomationExecution {
  id: string;
  organizationId: string;
  ruleId: string;
  leadId: string | null;
  status: string;
  executedActions: JsonValue | null;
  errorDetails: string | null;
  scheduledFor: Date | null;
  executedAt: Date | null;
  createdAt: Date;
  organization?: Organization;
  rule?: AutomationRule;
  lead?: Lead | null;
}

export interface AutomationExecutionCreateInput {
  id?: string;
  organizationId: string;
  ruleId: string;
  leadId?: string | null;
  status?: string;
  executedActions?: JsonValue | null;
  errorDetails?: string | null;
  scheduledFor?: Date | null;
  executedAt?: Date | null;
  createdAt?: Date;
}

export interface AutomationExecutionUpdateInput {
  id?: string;
  organizationId?: string;
  ruleId?: string;
  leadId?: string | null;
  status?: string;
  executedActions?: JsonValue | null;
  errorDetails?: string | null;
  scheduledFor?: Date | null;
  executedAt?: Date | null;
  createdAt?: Date;
}

export interface AutomationExecutionDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<AutomationExecution | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<AutomationExecution | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<AutomationExecution[]>;
  create(args: { data: AutomationExecutionCreateInput | any; select?: any; include?: any }): Promise<AutomationExecution>;
  createMany(args: { data: (AutomationExecutionCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: AutomationExecutionUpdateInput | any; select?: any; include?: any }): Promise<AutomationExecution>;
  updateMany(args: { where?: any; data: AutomationExecutionUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: AutomationExecutionCreateInput | any; update: AutomationExecutionUpdateInput | any; select?: any; include?: any }): Promise<AutomationExecution>;
  delete(args: { where: any; select?: any; include?: any }): Promise<AutomationExecution>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface AIResult {
  id: string;
  organizationId: string;
  operationType: AITaskType;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: Decimal;
  inputSanitized: string;
  outputText: string;
  executionDurationMs: number;
  createdAt: Date;
  organization?: Organization;
}

export interface AIResultCreateInput {
  id?: string;
  organizationId: string;
  operationType: AITaskType;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: Decimal;
  inputSanitized: string;
  outputText: string;
  executionDurationMs?: number;
  createdAt?: Date;
}

export interface AIResultUpdateInput {
  id?: string;
  organizationId?: string;
  operationType?: AITaskType;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: Decimal;
  inputSanitized?: string;
  outputText?: string;
  executionDurationMs?: number;
  createdAt?: Date;
}

export interface AIResultDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<AIResult | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<AIResult | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<AIResult[]>;
  create(args: { data: AIResultCreateInput | any; select?: any; include?: any }): Promise<AIResult>;
  createMany(args: { data: (AIResultCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: AIResultUpdateInput | any; select?: any; include?: any }): Promise<AIResult>;
  updateMany(args: { where?: any; data: AIResultUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: AIResultCreateInput | any; update: AIResultUpdateInput | any; select?: any; include?: any }): Promise<AIResult>;
  delete(args: { where: any; select?: any; include?: any }): Promise<AIResult>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface AIUsage {
  id: string;
  organizationId: string;
  month: number;
  year: number;
  tokensUsed: number;
  requestsCount: number;
  costEstimate: Decimal;
  updatedAt: Date;
  organization?: Organization;
}

export interface AIUsageCreateInput {
  id?: string;
  organizationId: string;
  month: number;
  year: number;
  tokensUsed?: number;
  requestsCount?: number;
  costEstimate?: Decimal;
  updatedAt?: Date;
}

export interface AIUsageUpdateInput {
  id?: string;
  organizationId?: string;
  month?: number;
  year?: number;
  tokensUsed?: number;
  requestsCount?: number;
  costEstimate?: Decimal;
  updatedAt?: Date;
}

export interface AIUsageDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<AIUsage | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<AIUsage | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<AIUsage[]>;
  create(args: { data: AIUsageCreateInput | any; select?: any; include?: any }): Promise<AIUsage>;
  createMany(args: { data: (AIUsageCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: AIUsageUpdateInput | any; select?: any; include?: any }): Promise<AIUsage>;
  updateMany(args: { where?: any; data: AIUsageUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: AIUsageCreateInput | any; update: AIUsageUpdateInput | any; select?: any; include?: any }): Promise<AIUsage>;
  delete(args: { where: any; select?: any; include?: any }): Promise<AIUsage>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface Notification {
  id: string;
  organizationId: string;
  userId: string | null;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  data: JsonValue | null;
  createdAt: Date;
  organization?: Organization;
  user?: User | null;
}

export interface NotificationCreateInput {
  id?: string;
  organizationId: string;
  userId?: string | null;
  title: string;
  body: string;
  type: NotificationType;
  isRead?: boolean;
  data?: JsonValue | null;
  createdAt?: Date;
}

export interface NotificationUpdateInput {
  id?: string;
  organizationId?: string;
  userId?: string | null;
  title?: string;
  body?: string;
  type?: NotificationType;
  isRead?: boolean;
  data?: JsonValue | null;
  createdAt?: Date;
}

export interface NotificationDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<Notification | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<Notification | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<Notification[]>;
  create(args: { data: NotificationCreateInput | any; select?: any; include?: any }): Promise<Notification>;
  createMany(args: { data: (NotificationCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: NotificationUpdateInput | any; select?: any; include?: any }): Promise<Notification>;
  updateMany(args: { where?: any; data: NotificationUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: NotificationCreateInput | any; update: NotificationUpdateInput | any; select?: any; include?: any }): Promise<Notification>;
  delete(args: { where: any; select?: any; include?: any }): Promise<Notification>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface AuditLog {
  id: string;
  organizationId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  oldValues: JsonValue | null;
  newValues: JsonValue | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  organization?: Organization | null;
  user?: User | null;
}

export interface AuditLogCreateInput {
  id?: string;
  organizationId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValues?: JsonValue | null;
  newValues?: JsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
}

export interface AuditLogUpdateInput {
  id?: string;
  organizationId?: string | null;
  userId?: string | null;
  action?: AuditAction;
  entityType?: string;
  entityId?: string | null;
  oldValues?: JsonValue | null;
  newValues?: JsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
}

export interface AuditLogDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<AuditLog | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<AuditLog | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<AuditLog[]>;
  create(args: { data: AuditLogCreateInput | any; select?: any; include?: any }): Promise<AuditLog>;
  createMany(args: { data: (AuditLogCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: AuditLogUpdateInput | any; select?: any; include?: any }): Promise<AuditLog>;
  updateMany(args: { where?: any; data: AuditLogUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: AuditLogCreateInput | any; update: AuditLogUpdateInput | any; select?: any; include?: any }): Promise<AuditLog>;
  delete(args: { where: any; select?: any; include?: any }): Promise<AuditLog>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export interface SystemSetting {
  id: string;
  organizationId: string | null;
  group: SystemSettingCategory;
  key: string;
  value: JsonValue;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  organization?: Organization | null;
}

export interface SystemSettingCreateInput {
  id?: string;
  organizationId?: string | null;
  group: SystemSettingCategory;
  key: string;
  value: JsonValue;
  isEncrypted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SystemSettingUpdateInput {
  id?: string;
  organizationId?: string | null;
  group?: SystemSettingCategory;
  key?: string;
  value?: JsonValue;
  isEncrypted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SystemSettingDelegate {
  findUnique(args: { where: any; select?: any; include?: any }): Promise<SystemSetting | null>;
  findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }): Promise<SystemSetting | null>;
  findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; take?: number; skip?: number }): Promise<SystemSetting[]>;
  create(args: { data: SystemSettingCreateInput | any; select?: any; include?: any }): Promise<SystemSetting>;
  createMany(args: { data: (SystemSettingCreateInput | any)[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: any; data: SystemSettingUpdateInput | any; select?: any; include?: any }): Promise<SystemSetting>;
  updateMany(args: { where?: any; data: SystemSettingUpdateInput | any }): Promise<{ count: number }>;
  upsert(args: { where: any; create: SystemSettingCreateInput | any; update: SystemSettingUpdateInput | any; select?: any; include?: any }): Promise<SystemSetting>;
  delete(args: { where: any; select?: any; include?: any }): Promise<SystemSetting>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count(args?: { where?: any }): Promise<number>;
}

export class PrismaClient {
  constructor(options?: any);
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<T>(arg: ((prisma: PrismaClient) => Promise<T>) | Promise<any>[]): Promise<T>;
  $queryRaw<T = any>(query: any, ...values: any[]): Promise<T>;
  $executeRaw(query: any, ...values: any[]): Promise<number>;
  organization: OrganizationDelegate;
  organizationMember: OrganizationMemberDelegate;
  user: UserDelegate;
  plan: PlanDelegate;
  planFeature: PlanFeatureDelegate;
  featureLimit: FeatureLimitDelegate;
  featureFlag: FeatureFlagDelegate;
  subscription: SubscriptionDelegate;
  payment: PaymentDelegate;
  invoice: InvoiceDelegate;
  usageCounter: UsageCounterDelegate;
  coupon: CouponDelegate;
  customer: CustomerDelegate;
  lead: LeadDelegate;
  property: PropertyDelegate;
  propertyOwner: PropertyOwnerDelegate;
  followUp: FollowUpDelegate;
  siteVisit: SiteVisitDelegate;
  task: TaskDelegate;
  activity: ActivityDelegate;
  conversation: ConversationDelegate;
  message: MessageDelegate;
  whatsAppTemplate: WhatsAppTemplateDelegate;
  integration: IntegrationDelegate;
  integrationLog: IntegrationLogDelegate;
  webhookEvent: WebhookEventDelegate;
  automationRule: AutomationRuleDelegate;
  automationExecution: AutomationExecutionDelegate;
  aIResult: AIResultDelegate;
  aIUsage: AIUsageDelegate;
  notification: NotificationDelegate;
  auditLog: AuditLogDelegate;
  systemSetting: SystemSettingDelegate;
}
