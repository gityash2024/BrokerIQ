import { LeadStage, Role } from '../enums';

export const LEAD_STAGE_FLOW: Record<LeadStage, readonly LeadStage[]> = {
  [LeadStage.NEW]: [
    LeadStage.CONTACTED,
    LeadStage.NOT_INTERESTED,
    LeadStage.LOST,
  ],
  [LeadStage.CONTACTED]: [
    LeadStage.INTERESTED,
    LeadStage.FOLLOW_UP,
    LeadStage.NOT_INTERESTED,
    LeadStage.LOST,
  ],
  [LeadStage.INTERESTED]: [
    LeadStage.FOLLOW_UP,
    LeadStage.SITE_VISIT,
    LeadStage.NOT_INTERESTED,
    LeadStage.LOST,
  ],
  [LeadStage.FOLLOW_UP]: [
    LeadStage.INTERESTED,
    LeadStage.SITE_VISIT,
    LeadStage.NEGOTIATION,
    LeadStage.NOT_INTERESTED,
    LeadStage.LOST,
  ],
  [LeadStage.SITE_VISIT]: [
    LeadStage.FOLLOW_UP,
    LeadStage.NEGOTIATION,
    LeadStage.NOT_INTERESTED,
    LeadStage.LOST,
  ],
  [LeadStage.NEGOTIATION]: [
    LeadStage.WON,
    LeadStage.LOST,
    LeadStage.FOLLOW_UP,
  ],
  [LeadStage.WON]: [],
  [LeadStage.LOST]: [
    LeadStage.NEW,
  ],
  [LeadStage.NOT_INTERESTED]: [
    LeadStage.NEW,
  ],
} as const;

export const STAGE_TRANSITIONS = LEAD_STAGE_FLOW;

export function isValidLeadStageTransition(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return true;
  const allowed = LEAD_STAGE_FLOW[from] || [];
  return allowed.includes(to);
}

export type Permission =
  | 'organizations:manage'
  | 'organizations:view'
  | 'organizations:update_own'
  | 'users:manage'
  | 'users:view'
  | 'team:invite'
  | 'team:manage_roles'
  | 'plans:manage'
  | 'plans:view'
  | 'subscriptions:manage'
  | 'subscriptions:view'
  | 'billing:manage'
  | 'billing:view'
  | 'leads:view_all'
  | 'leads:view_assigned'
  | 'leads:create'
  | 'leads:update'
  | 'leads:delete'
  | 'leads:assign'
  | 'properties:view_all'
  | 'properties:view_assigned'
  | 'properties:create'
  | 'properties:update'
  | 'properties:delete'
  | 'properties:moderate'
  | 'properties:submit_owner'
  | 'properties:view_own'
  | 'follow_ups:view_all'
  | 'follow_ups:view_assigned'
  | 'follow_ups:manage'
  | 'site_visits:view_all'
  | 'site_visits:view_assigned'
  | 'site_visits:manage'
  | 'whatsapp:send'
  | 'whatsapp:templates_manage'
  | 'whatsapp:view'
  | 'housing:manage_credentials'
  | 'housing:sync'
  | 'ai:use'
  | 'ai:configure'
  | 'settings:global_manage'
  | 'settings:tenant_manage'
  | 'audit_logs:view_all'
  | 'audit_logs:view_tenant'
  | 'kyc:verify_all'
  | 'kyc:submit_own'
  | 'marketplace:search'
  | 'marketplace:save_properties'
  | 'marketplace:contact_seller'
  | 'boost_credits:manage';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.SUPER_ADMIN]: [
    'organizations:manage',
    'organizations:view',
    'organizations:update_own',
    'users:manage',
    'users:view',
    'team:invite',
    'team:manage_roles',
    'plans:manage',
    'plans:view',
    'subscriptions:manage',
    'subscriptions:view',
    'billing:manage',
    'billing:view',
    'leads:view_all',
    'leads:view_assigned',
    'leads:create',
    'leads:update',
    'leads:delete',
    'leads:assign',
    'properties:view_all',
    'properties:view_assigned',
    'properties:create',
    'properties:update',
    'properties:delete',
    'properties:moderate',
    'properties:submit_owner',
    'properties:view_own',
    'follow_ups:view_all',
    'follow_ups:view_assigned',
    'follow_ups:manage',
    'site_visits:view_all',
    'site_visits:view_assigned',
    'site_visits:manage',
    'whatsapp:send',
    'whatsapp:templates_manage',
    'whatsapp:view',
    'housing:manage_credentials',
    'housing:sync',
    'ai:use',
    'ai:configure',
    'settings:global_manage',
    'settings:tenant_manage',
    'audit_logs:view_all',
    'audit_logs:view_tenant',
    'kyc:verify_all',
    'kyc:submit_own',
    'marketplace:search',
    'marketplace:save_properties',
    'marketplace:contact_seller',
    'boost_credits:manage',
  ],
  [Role.BROKER_ADMIN]: [
    'organizations:view',
    'organizations:update_own',
    'users:manage',
    'users:view',
    'team:invite',
    'team:manage_roles',
    'plans:view',
    'subscriptions:manage',
    'subscriptions:view',
    'billing:manage',
    'billing:view',
    'leads:view_all',
    'leads:view_assigned',
    'leads:create',
    'leads:update',
    'leads:delete',
    'leads:assign',
    'properties:view_all',
    'properties:view_assigned',
    'properties:create',
    'properties:update',
    'properties:delete',
    'follow_ups:view_all',
    'follow_ups:view_assigned',
    'follow_ups:manage',
    'site_visits:view_all',
    'site_visits:view_assigned',
    'site_visits:manage',
    'whatsapp:send',
    'whatsapp:templates_manage',
    'whatsapp:view',
    'housing:manage_credentials',
    'housing:sync',
    'ai:use',
    'settings:tenant_manage',
    'audit_logs:view_tenant',
    'marketplace:search',
  ],
  [Role.BROKER_STAFF]: [
    'users:view',
    'plans:view',
    'leads:view_assigned',
    'leads:create',
    'leads:update',
    'properties:view_all',
    'properties:view_assigned',
    'properties:create',
    'properties:update',
    'follow_ups:view_assigned',
    'follow_ups:manage',
    'site_visits:view_assigned',
    'site_visits:manage',
    'whatsapp:send',
    'whatsapp:view',
    'ai:use',
    'marketplace:search',
  ],
  [Role.BROKER_AGENT]: [
    'users:view',
    'plans:view',
    'leads:view_assigned',
    'leads:create',
    'leads:update',
    'properties:view_all',
    'properties:view_assigned',
    'properties:create',
    'properties:update',
    'follow_ups:view_assigned',
    'follow_ups:manage',
    'site_visits:view_assigned',
    'site_visits:manage',
    'whatsapp:send',
    'whatsapp:view',
    'ai:use',
    'marketplace:search',
  ],
  [Role.PROPERTY_OWNER]: [
    'properties:submit_owner',
    'properties:view_own',
    'properties:update',
    'kyc:submit_own',
    'boost_credits:manage',
    'marketplace:search',
  ],
  [Role.SEEKER]: [
    'marketplace:search',
    'marketplace:save_properties',
    'marketplace:contact_seller',
  ],
} as const;

export const PERSONA_PORTAL_MAP: Record<Role, string> = {
  [Role.SUPER_ADMIN]: '/admin',
  [Role.BROKER_ADMIN]: '/agency',
  [Role.BROKER_AGENT]: '/agent',
  [Role.BROKER_STAFF]: '/agent',
  [Role.PROPERTY_OWNER]: '/owner',
  [Role.SEEKER]: '/portal',
};

export function hasPermission(role: Role, permission: Permission | string): boolean {
  let permissions = ROLE_PERMISSIONS[role];
  if (!permissions && role === Role.BROKER_AGENT) {
    permissions = ROLE_PERMISSIONS[Role.BROKER_STAFF];
  }
  if (!permissions) return false;
  return permissions.includes(permission as Permission);
}


export const REGEX_PATTERNS = {
  INDIAN_PHONE: /^(\+91[\-\s]?)?[6-9]\d{9}$/,
  INDIAN_PHONE_10_DIGIT: /^[6-9]\d{9}$/,
  INDIAN_PINCODE: /^[1-9][0-9]{5}$/,
  INDIAN_PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  INDIAN_GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
} as const;

export const INDIAN_PHONE_REGEX = REGEX_PATTERNS.INDIAN_PHONE;
export const INDIAN_PINCODE_REGEX = REGEX_PATTERNS.INDIAN_PINCODE;
export const INDIAN_PAN_REGEX = REGEX_PATTERNS.INDIAN_PAN;
export const INDIAN_GSTIN_REGEX = REGEX_PATTERNS.INDIAN_GSTIN;
