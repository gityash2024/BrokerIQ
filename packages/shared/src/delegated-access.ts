import { z } from 'zod';
import { PLATFORM_MODULES, moduleAllowed, defaultModulePolicies, type ModulePolicies } from './modules';

export const delegatedActions = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'approve',
  'assign',
  'publish',
  'send',
  'connection_status',
  'sync',
  'approve_details',
] as const;
export type DelegatedAction = (typeof delegatedActions)[number];

export const delegatedGrantSchema = z
  .array(z.string().regex(/^[a-z_]+:(view|create|edit|delete|export|approve|assign|publish|send|connection_status|sync|approve_details)$/))
  .max(350);
export const delegatedGrant = (module: string, action: DelegatedAction) => `${module}:${action}`;

const actionsByModule: Record<string, readonly DelegatedAction[]> = {
  assistant: ['view', 'edit'],
  today: ['view'],
  directory: ['view'],
  inventory: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'assign', 'publish', 'approve_details'],
  leads: ['view', 'create', 'edit', 'delete', 'export', 'assign', 'send'],
  inbox: ['view', 'create', 'edit', 'delete', 'approve', 'send'],
  automation: ['view', 'create', 'edit', 'delete', 'connection_status', 'sync'],
  owners: ['view', 'create', 'edit', 'delete', 'send'],
  deals: ['view', 'create', 'edit', 'delete', 'send'],
  team: ['view', 'edit', 'export'],
  kyc: ['view', 'create', 'approve'],
  time_logging: ['view', 'create'],
};

export function delegableModules(policies: ModulePolicies | undefined) {
  return PLATFORM_MODULES.filter((module) => actionsByModule[module.key] && moduleAllowed(policies, module.key, 'BROKER_ADMIN')).map((module) => ({
    ...module,
    actions: actionsByModule[module.key],
  }));
}

export const ROLE_PERMISSIONS_MARKER = '$role-permissions';
export type FirmPermissionsActor = { role: string; delegatedPermissions?: readonly string[]; rolePermissions?: readonly string[] };

export function roleModulePermissions(policies: ModulePolicies | undefined, role: string) {
  if (role === 'SUB_BROKER_ADMIN') return delegableModules(policies);
  if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(role)) return [];
  return PLATFORM_MODULES.flatMap((module) => {
    if (['consumer', 'legacy'].includes(module.key) || !moduleAllowed(policies, module.key, role)) return [];
    const actions = actionsByModule[module.key] ?? (['view', 'create', 'edit', 'delete'] as const);
    const adminActions: DelegatedAction[] = ['approve', 'publish', 'assign', 'approve_details', 'connection_status', 'sync'];
    return [{ ...module, actions: role === 'BROKER_AGENT' ? actions.filter((action) => !adminActions.includes(action)) : actions }];
  });
}

export function storedRolePermissions(role: string, grants: readonly string[] = []) {
  if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(role) || !grants.includes(ROLE_PERMISSIONS_MARKER)) return undefined;
  return grants.filter((grant) => grant !== ROLE_PERMISSIONS_MARKER);
}

export function roleModulePolicies(policies: ModulePolicies | undefined, actor: FirmPermissionsActor | null | undefined) {
  if (!actor?.rolePermissions) return policies;
  const next = { ...defaultModulePolicies(), ...policies };
  for (const module of roleModulePermissions(policies, actor.role)) {
    const current = next[module.key];
    const canLog = module.key === 'time_logging' && actor.rolePermissions.includes(delegatedGrant(module.key, 'create'));
    if (!canLog && !actor.rolePermissions.includes(delegatedGrant(module.key, 'view'))) {
      next[module.key] = { ...current, roles: current.roles.filter((role) => role !== actor.role) };
    }
  }
  return next;
}

/** For a delegated account, every requested action must be explicitly granted. */
export function hasDelegatedAccess(
  user: FirmPermissionsActor | null | undefined,
  module: string,
  ...actions: DelegatedAction[]
) {
  const grants = user?.role === 'SUB_BROKER_ADMIN' ? user.delegatedPermissions ?? [] : user?.rolePermissions;
  return !grants || actions.every((action) => grants.includes(delegatedGrant(module, action)));
}

export function delegatedModulePolicies(policies: ModulePolicies | undefined, grants: readonly string[]): ModulePolicies {
  return Object.fromEntries(
    PLATFORM_MODULES.map(({ key }) => {
      const permitted =
        !!actionsByModule[key] &&
        moduleAllowed(policies, key, 'BROKER_ADMIN') &&
        (grants.includes(delegatedGrant(key, 'view')) || (key === 'time_logging' && grants.includes('time_logging:create')));
      return [key, { state: permitted ? 'ACTIVE' : 'HIDDEN', roles: permitted ? ['BROKER_ADMIN'] : [] }];
    }),
  );
}

export function firmRoleLabel(role: string) {
  if (role === 'PROPERTY_OWNER') return 'Property Owner';
  return role === 'SUB_BROKER_ADMIN' ? 'Sub-Broker Admin' : role === 'BROKER_ADMIN' ? 'Admin' : 'Agent';
}

// Reapply only the choices changed in this editor after loading concurrent edits.
export function reapplySelectionChanges(baseline: string[], draft: string[], current: string[]) {
  return [
    ...current.filter((item) => !baseline.includes(item) || draft.includes(item)),
    ...draft.filter((item) => !baseline.includes(item) && !current.includes(item)),
  ];
}
