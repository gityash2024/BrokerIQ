import { z } from 'zod';
import { PLATFORM_MODULES, moduleAllowed, type ModulePolicies } from './modules';

export const delegatedActions = ['view', 'create', 'edit', 'delete', 'export', 'approve', 'assign', 'publish', 'send'] as const;
export type DelegatedAction = (typeof delegatedActions)[number];

export const delegatedGrantSchema = z.array(z.string().regex(/^[a-z_]+:(view|create|edit|delete|export|approve|assign|publish|send)$/)).max(350);
export const delegatedGrant = (module: string, action: DelegatedAction) => `${module}:${action}`;

const actionsByModule: Record<string, readonly DelegatedAction[]> = {
  today: ['view'],
  directory: ['view'],
  inventory: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'assign', 'publish'],
  leads: ['view', 'create', 'edit', 'delete', 'export', 'assign', 'send'],
  inbox: ['view', 'create', 'edit', 'delete', 'approve', 'send'],
  automation: ['view', 'create', 'edit', 'delete'],
  deals: ['view', 'create', 'edit', 'send'],
  team: ['view', 'edit', 'export'],
  kyc: ['view', 'create', 'approve'],
  time_logging: ['view', 'create'],
};

export function delegableModules(policies: ModulePolicies | undefined) {
  return PLATFORM_MODULES.filter((module) => actionsByModule[module.key] && moduleAllowed(policies, module.key, 'BROKER_ADMIN'))
    .map((module) => ({ ...module, actions: actionsByModule[module.key] }));
}

export function delegatedModulePolicies(policies: ModulePolicies | undefined, grants: readonly string[]): ModulePolicies {
  return Object.fromEntries(
    PLATFORM_MODULES.map(({ key }) => {
      const permitted = !!actionsByModule[key] && moduleAllowed(policies, key, 'BROKER_ADMIN') && grants.some((grant) => grant.startsWith(key + ':'));
      return [key, { state: permitted ? 'ACTIVE' : 'HIDDEN', roles: permitted ? ['BROKER_ADMIN'] : [] }];
    }),
  );
}

export function firmRoleLabel(role: string) {
  return role === 'SUB_BROKER_ADMIN' ? 'Sub-Broker Admin' : role === 'BROKER_ADMIN' ? 'Admin' : 'Agent';
}
