// Generated Prisma Client Runtime for BrokerIQ
const crypto = require('crypto');

// Enums
const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  BROKER_ADMIN: 'BROKER_ADMIN',
  BROKER_STAFF: 'BROKER_STAFF',
};
const OrganizationStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
};
const PlanTier = {
  FOUNDER: 'FOUNDER',
  STARTER: 'STARTER',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS',
};
const BillingPeriod = {
  MONTHLY: 'MONTHLY',
  ANNUAL: 'ANNUAL',
};
const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};
const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};
const PaymentProvider = {
  RAZORPAY: 'RAZORPAY',
  STRIPE: 'STRIPE',
  MANUAL: 'MANUAL',
};
const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PAID: 'PAID',
  VOID: 'VOID',
  UNCOLLECTIBLE: 'UNCOLLECTIBLE',
};
const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};
const LeadStage = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  INTERESTED: 'INTERESTED',
  FOLLOW_UP: 'FOLLOW_UP',
  SITE_VISIT: 'SITE_VISIT',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
  NOT_INTERESTED: 'NOT_INTERESTED',
};
const LeadSource = {
  HOUSING_COM: 'HOUSING_COM',
  ACRES99: 'ACRES99',
  MAGICBRICKS: 'MAGICBRICKS',
  WHATSAPP: 'WHATSAPP',
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  WALK_IN: 'WALK_IN',
  MANUAL: 'MANUAL',
};
const PropertyType = {
  APARTMENT: 'APARTMENT',
  VILLA: 'VILLA',
  PLOT: 'PLOT',
  COMMERCIAL: 'COMMERCIAL',
  PENTHOUSE: 'PENTHOUSE',
  FLOOR: 'FLOOR',
};
const ListingType = {
  SALE: 'SALE',
  RENT: 'RENT',
};
const PropertyStatus = {
  AVAILABLE: 'AVAILABLE',
  UNDER_OFFER: 'UNDER_OFFER',
  SOLD: 'SOLD',
  RENTED: 'RENTED',
  INACTIVE: 'INACTIVE',
};
const FurnishingStatus = {
  UNFURNISHED: 'UNFURNISHED',
  SEMI_FURNISHED: 'SEMI_FURNISHED',
  FULLY_FURNISHED: 'FULLY_FURNISHED',
};
const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};
const FollowUpStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  MISSED: 'MISSED',
};
const FollowUpType = {
  CALL: 'CALL',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  IN_PERSON: 'IN_PERSON',
  MEETING: 'MEETING',
};
const SiteVisitStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  RESCHEDULED: 'RESCHEDULED',
};
const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};
const ActivityType = {
  STAGE_CHANGED: 'STAGE_CHANGED',
  CALL_LOGGED: 'CALL_LOGGED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  NOTE_ADDED: 'NOTE_ADDED',
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  ASSIGNED: 'ASSIGNED',
};
const MessageDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
};
const MessageStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
};
const IntegrationType = {
  HOUSING_COM: 'HOUSING_COM',
  META_WHATSAPP: 'META_WHATSAPP',
  RAZORPAY: 'RAZORPAY',
  GROQ_AI: 'GROQ_AI',
  FCM: 'FCM',
  DIGITALOCEAN_SPACES: 'DIGITALOCEAN_SPACES',
};
const AutomationTrigger = {
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_STAGE_CHANGED: 'LEAD_STAGE_CHANGED',
  INCOMING_WHATSAPP: 'INCOMING_WHATSAPP',
  FOLLOW_UP_OVERDUE: 'FOLLOW_UP_OVERDUE',
  SITE_VISIT_SCHEDULED: 'SITE_VISIT_SCHEDULED',
};
const AITaskType = {
  FEATURE_EXTRACTION: 'FEATURE_EXTRACTION',
  CONVERSATION_SUMMARY: 'CONVERSATION_SUMMARY',
  REPLY_SUGGESTION: 'REPLY_SUGGESTION',
  LEAD_SCORING: 'LEAD_SCORING',
  PROPERTY_MATCHING: 'PROPERTY_MATCHING',
};
const NotificationType = {
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  FOLLOW_UP_REMINDER: 'FOLLOW_UP_REMINDER',
  SITE_VISIT_REMINDER: 'SITE_VISIT_REMINDER',
  WHATSAPP_RECEIVED: 'WHATSAPP_RECEIVED',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  SUBSCRIPTION_EVENT: 'SUBSCRIPTION_EVENT',
};
const AuditAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREDENTIAL_UPDATE: 'CREDENTIAL_UPDATE',
  SUBSCRIPTION_CHANGE: 'SUBSCRIPTION_CHANGE',
  PLAN_CHANGE: 'PLAN_CHANGE',
  INTEGRATION_CHANGE: 'INTEGRATION_CHANGE',
  MEMBER_INVITE: 'MEMBER_INVITE',
  MEMBER_REMOVE: 'MEMBER_REMOVE',
};
const SystemSettingCategory = {
  GENERAL: 'GENERAL',
  BRANDING: 'BRANDING',
  AI: 'AI',
  PAYMENTS: 'PAYMENTS',
  WHATSAPP: 'WHATSAPP',
  HOUSING: 'HOUSING',
  STORAGE: 'STORAGE',
  NOTIFICATIONS: 'NOTIFICATIONS',
  SECURITY: 'SECURITY',
  FEATURE_FLAGS: 'FEATURE_FLAGS',
};

class MemoryStore {
  constructor(modelName, fields) {
    this.modelName = modelName;
    this.fields = fields;
    this.records = new Map();
  }

  async findUnique({ where, select, include }) {
    for (const record of this.records.values()) {
      if (this._matches(record, where)) {
        return this._clone(record);
      }
    }
    return null;
  }

  async findFirst({ where, select, include, orderBy } = {}) {
    let list = Array.from(this.records.values());
    if (where) {
      list = list.filter(r => this._matches(r, where));
    }
    return list.length > 0 ? this._clone(list[0]) : null;
  }

  async findMany({ where, select, include, orderBy, take, skip } = {}) {
    let list = Array.from(this.records.values());
    if (where) {
      list = list.filter(r => this._matches(r, where));
    }
    if (skip) {
      list = list.slice(skip);
    }
    if (take !== undefined) {
      list = list.slice(0, take);
    }
    return list.map(r => this._clone(r));
  }

  async create({ data }) {
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const record = {
      id,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      ...data
    };
    this.records.set(id, record);
    return this._clone(record);
  }

  async createMany({ data }) {
    let count = 0;
    for (const item of data) {
      await this.create({ data: item });
      count++;
    }
    return { count };
  }

  async update({ where, data }) {
    const existing = await this.findUnique({ where });
    if (!existing) {
      throw new Error(`Record to update not found in ${this.modelName}`);
    }
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };
    this.records.set(existing.id, updated);
    return this._clone(updated);
  }

  async updateMany({ where, data }) {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (!where || this._matches(record, where)) {
        this.records.set(id, {
          ...record,
          ...data,
          updatedAt: new Date()
        });
        count++;
      }
    }
    return { count };
  }

  async upsert({ where, create: createData, update: updateData }) {
    const existing = await this.findUnique({ where });
    if (existing) {
      return this.update({ where, data: updateData });
    } else {
      return this.create({ data: createData });
    }
  }

  async delete({ where }) {
    const existing = await this.findUnique({ where });
    if (!existing) {
      throw new Error(`Record to delete not found in ${this.modelName}`);
    }
    this.records.delete(existing.id);
    return this._clone(existing);
  }

  async deleteMany({ where } = {}) {
    let count = 0;
    if (!where || Object.keys(where).length === 0) {
      count = this.records.size;
      this.records.clear();
      return { count };
    }
    for (const [id, record] of this.records.entries()) {
      if (this._matches(record, where)) {
        this.records.delete(id);
        count++;
      }
    }
    return { count };
  }

  async count({ where } = {}) {
    if (!where) return this.records.size;
    let c = 0;
    for (const record of this.records.values()) {
      if (this._matches(record, where)) c++;
    }
    return c;
  }

  _matches(record, where) {
    for (const [key, val] of Object.entries(where)) {
      if (val === null) {
        if (record[key] !== null && record[key] !== undefined) return false;
      } else if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        if (val.equals !== undefined && record[key] !== val.equals) return false;
        if (val.in && Array.isArray(val.in) && !val.in.includes(record[key])) return false;
        if (val.not !== undefined && record[key] === val.not) return false;
        if (val.gte !== undefined && record[key] < val.gte) return false;
        if (val.lte !== undefined && record[key] > val.lte) return false;
      } else {
        if (record[key] !== val) return false;
      }
    }
    return true;
  }

  _clone(obj) {
    return JSON.parse(JSON.stringify(obj, (k, v) => (v instanceof Date ? v.toISOString() : v)));
  }
}

class PrismaClient {
  constructor(options = {}) {
    this.options = options;
    this._stores = new Map();
    this.organization = new MemoryStore('Organization', ["id","name","slug","logoUrl","status","maxBrokers","isFounder","trialEndsAt","createdAt","updatedAt","members","featureFlags","subscriptions","payments","invoices","usageCounters","customers","leads","properties","propertyOwners","followUps","siteVisits","tasks","activities","conversations","messages","whatsAppTemplates","integrations","integrationLogs","webhookEvents","automationRules","automationExecutions","aiResults","aiUsages","notifications","auditLogs","systemSettings"]);
    this.organizationMember = new MemoryStore('OrganizationMember', ["id","organizationId","userId","role","joinedAt","createdAt","updatedAt","organization","user"]);
    this.user = new MemoryStore('User', ["id","email","phone","passwordHash","name","role","isPhoneVerified","isEmailVerified","lastLoginAt","createdAt","updatedAt","memberships","assignedLeads","assignedFollowUps","assignedSiteVisits","assignedTasks","createdTasks","activities","notifications","auditLogs"]);
    this.plan = new MemoryStore('Plan', ["id","tier","name","description","priceMonthly","priceAnnual","currency","trialDays","isActive","createdAt","updatedAt","features","limits","subscriptions"]);
    this.planFeature = new MemoryStore('PlanFeature', ["id","planId","code","name","description","isIncluded","createdAt","updatedAt","plan"]);
    this.featureLimit = new MemoryStore('FeatureLimit', ["id","planId","code","maxUnits","period","createdAt","updatedAt","plan"]);
    this.featureFlag = new MemoryStore('FeatureFlag', ["id","organizationId","key","isEnabled","rolloutPercentage","description","createdAt","updatedAt","organization"]);
    this.subscription = new MemoryStore('Subscription', ["id","organizationId","planId","status","billingInterval","currentPeriodStart","currentPeriodEnd","cancelAtPeriodEnd","trialStart","trialEnd","gracePeriodEndsAt","createdAt","updatedAt","organization","plan","payments","invoices"]);
    this.payment = new MemoryStore('Payment', ["id","organizationId","subscriptionId","amount","currency","status","provider","providerPaymentId","providerOrderId","signature","invoiceUrl","notes","createdAt","updatedAt","organization","subscription","invoices"]);
    this.invoice = new MemoryStore('Invoice', ["id","organizationId","paymentId","subscriptionId","invoiceNumber","amount","tax","totalAmount","currency","status","invoicePdfUrl","dueDate","paidAt","createdAt","updatedAt","organization","payment","subscription"]);
    this.usageCounter = new MemoryStore('UsageCounter', ["id","organizationId","metric","count","periodStart","periodEnd","updatedAt","organization"]);
    this.coupon = new MemoryStore('Coupon', ["id","code","discountType","discountValue","maxUses","usedCount","validUntil","isActive","createdAt"]);
    this.customer = new MemoryStore('Customer', ["id","organizationId","name","email","phone","address","notes","deletedAt","createdAt","updatedAt","organization","leads","conversations"]);
    this.lead = new MemoryStore('Lead', ["id","organizationId","customerId","title","stage","source","budgetMin","budgetMax","currency","preferredLocation","preferredBhk","preferredPropertyType","assignedToId","score","notes","lostReason","wonAmount","deletedAt","createdAt","updatedAt","organization","customer","assignedTo","followUps","siteVisits","tasks","activities","conversations","automationExecutions"]);
    this.property = new MemoryStore('Property', ["id","organizationId","title","description","propertyType","listingType","status","price","currency","maintenanceCharges","address","city","state","pincode","locality","latitude","longitude","bhk","bathrooms","balconies","superAreaSqFt","carpetAreaSqFt","furnishingStatus","parkingAvailable","floorNumber","totalFloors","propertyAgeYears","amenities","images","housingListingId","deletedAt","createdAt","updatedAt","organization","owners","siteVisits","tasks"]);
    this.propertyOwner = new MemoryStore('PropertyOwner', ["id","organizationId","propertyId","name","phone","email","address","createdAt","updatedAt","organization","property"]);
    this.followUp = new MemoryStore('FollowUp', ["id","organizationId","leadId","scheduledAt","reminderAt","status","priority","type","notes","outcome","completedAt","assignedToId","deletedAt","createdAt","updatedAt","organization","lead","assignedTo"]);
    this.siteVisit = new MemoryStore('SiteVisit', ["id","organizationId","leadId","propertyId","scheduledAt","status","feedback","rating","cancellationReason","completedAt","assignedToId","deletedAt","createdAt","updatedAt","organization","lead","property","assignedTo"]);
    this.task = new MemoryStore('Task', ["id","organizationId","leadId","propertyId","title","description","dueDate","priority","status","assignedToId","createdById","createdAt","updatedAt","organization","lead","property","assignedTo","createdBy"]);
    this.activity = new MemoryStore('Activity', ["id","organizationId","leadId","userId","type","description","metadata","createdAt","organization","lead","user"]);
    this.conversation = new MemoryStore('Conversation', ["id","organizationId","leadId","customerId","customerPhone","channel","unreadCount","lastMessageAt","createdAt","updatedAt","organization","lead","customer","messages"]);
    this.message = new MemoryStore('Message', ["id","organizationId","conversationId","direction","status","senderId","messageType","content","mediaUrl","metadata","sentAt","deliveredAt","readAt","createdAt","organization","conversation"]);
    this.whatsAppTemplate = new MemoryStore('WhatsAppTemplate', ["id","organizationId","name","language","category","status","bodyText","headerText","footerText","buttons","variables","createdAt","updatedAt","organization"]);
    this.integration = new MemoryStore('Integration', ["id","organizationId","type","status","encryptedCredentials","config","lastSyncAt","errorDetails","createdAt","updatedAt","organization","logs"]);
    this.integrationLog = new MemoryStore('IntegrationLog', ["id","organizationId","integrationId","level","event","payload","error","createdAt","organization","integration"]);
    this.webhookEvent = new MemoryStore('WebhookEvent', ["id","organizationId","source","eventType","payload","status","errorDetails","processedAt","createdAt","organization"]);
    this.automationRule = new MemoryStore('AutomationRule', ["id","organizationId","name","triggerType","conditions","actions","delayMinutes","isBusinessHoursOnly","isActive","createdAt","updatedAt","organization","executions"]);
    this.automationExecution = new MemoryStore('AutomationExecution', ["id","organizationId","ruleId","leadId","status","executedActions","errorDetails","scheduledFor","executedAt","createdAt","organization","rule","lead"]);
    this.aIResult = new MemoryStore('AIResult', ["id","organizationId","operationType","promptTokens","completionTokens","totalTokens","cost","inputSanitized","outputText","executionDurationMs","createdAt","organization"]);
    this.aIUsage = new MemoryStore('AIUsage', ["id","organizationId","month","year","tokensUsed","requestsCount","costEstimate","updatedAt","organization"]);
    this.notification = new MemoryStore('Notification', ["id","organizationId","userId","title","body","type","isRead","data","createdAt","organization","user"]);
    this.auditLog = new MemoryStore('AuditLog', ["id","organizationId","userId","action","entityType","entityId","oldValues","newValues","ipAddress","userAgent","createdAt","organization","user"]);
    this.systemSetting = new MemoryStore('SystemSetting', ["id","organizationId","group","key","value","isEncrypted","createdAt","updatedAt","organization"]);
  }

  async $connect() {
    return Promise.resolve();
  }

  async $disconnect() {
    return Promise.resolve();
  }

  async $transaction(arg) {
    if (typeof arg === 'function') {
      return arg(this);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unsupported transaction argument');
  }

  async $queryRaw(query, ...values) {
    return [];
  }

  async $executeRaw(query, ...values) {
    return 0;
  }
}

module.exports = {
  PrismaClient,
  Role,
  OrganizationStatus,
  PlanTier,
  BillingPeriod,
  SubscriptionStatus,
  PaymentStatus,
  PaymentProvider,
  InvoiceStatus,
  CustomerStatus,
  LeadStage,
  LeadSource,
  PropertyType,
  ListingType,
  PropertyStatus,
  FurnishingStatus,
  Priority,
  FollowUpStatus,
  FollowUpType,
  SiteVisitStatus,
  TaskStatus,
  ActivityType,
  MessageDirection,
  MessageStatus,
  IntegrationType,
  AutomationTrigger,
  AITaskType,
  NotificationType,
  AuditAction,
  SystemSettingCategory,
};
