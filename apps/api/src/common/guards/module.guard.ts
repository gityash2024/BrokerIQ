import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, type RequestUser } from '../decorators';
import { delegatedGrant, delegableModules, moduleForPath, roleModulePermissions } from '@brokeriq/shared';
import { ModulesService } from '../../core/features/modules.service';
import { delegatedEndpoint } from './delegated-access';
import { env } from '../../config/env';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly modules: ModulesService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const requestPath = (req.path || req.url).replace(/^\/api(?=\/|$)/i, '');
    // APK delivery belongs to the signed-in profile, independently of Connect capture grants.
    if (user && req.method === 'GET' && /^\/connect\/profile\/?$/.test(requestPath)) return true;
    if (user?.role === 'BROKER_AGENT' && user.agentChatEnabled === false && /^\/(chat|whatsapp|messaging)(?:\/|$)/i.test(requestPath))
      throw new ForbiddenException('Inbox access has been removed by your Broker Admin');
    if (user?.role === 'SUB_BROKER_ADMIN') {
      const registeredPath = req.route?.path;
      if (typeof registeredPath !== 'string') throw new ForbiddenException('This action is not assigned to your account');
      const path = registeredPath
        .replace(/^\/api(?=\/|$)/i, '')
        .replace(/\/+$/, '')
        .toLowerCase();
      if (!user.orgId) throw new ForbiddenException('Firm membership required');
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
      if (isPublic || /^\/auth(?:\/|$)/.test(path) || /^\/me(?:$|\/(?:privacy|consent|push-tokens|notifications)(?:\/|$))/.test(path)) return true;
      // Personal KYC is bound to the signed-in identity. Team review still requires the firm's grants.
      if (
        (path === '/broker/team/agent-kyc/mine' && req.method === 'GET') ||
        (path === '/broker/team/agent-kyc' && req.method === 'POST') ||
        (path === '/broker/team/agent-kyc/history' && req.method === 'GET' && (!req.query?.member || req.query.member === user.id))
      )
        return true;
      let permission = delegatedEndpoint(path, req.method, req.body);
      if (
        path === '/time-logging/status' &&
        req.method === 'GET' &&
        (!req.query?.agentId || req.query.agentId === user.id) &&
        !(req.delegatedPermissions ?? []).includes('time_logging:view')
      ) {
        permission = { module: 'time_logging', actions: ['create'] };
      }
      if (path.startsWith('/media/property-video')) {
        const action = (req.delegatedPermissions ?? []).includes('inventory:edit') ? 'edit' : 'create';
        permission = { module: 'inventory', actions: [action] };
      }
      if (path === '/me/uploads/sign') {
        const kind = req.body?.kind;
        if (kind === 'avatar' || kind === 'kyc') return true;
        // Creating a property includes its media; signing an asset does not edit an existing record.
        const listingAction = (req.delegatedPermissions ?? []).includes('inventory:edit') ? 'edit' : 'create';
        permission = kind === 'listing' ? { module: 'inventory', actions: [listingAction] }
          : kind === 'whatsappattachment' ? { module: 'inbox', actions: ['view', 'send'] } : null;
      }
      if (
        permission &&
        ['inventory', 'leads'].includes(permission.module) &&
        req.body &&
        Object.prototype.hasOwnProperty.call(req.body, 'assignedToId') &&
        !permission.actions.includes('assign')
      ) {
        permission.actions.push('assign');
      }
      if (permission?.actions.some((action) => action === 'edit' || action === 'delete') && !permission.actions.includes('view')) {
        permission.actions.push('view');
      }
      const grants: string[] = req.delegatedPermissions ?? [];
      const catalog = delegableModules(await this.modules.all());
      const available = permission && catalog.find(({ key }) => key === permission.module);
      const has = (key: string, action: string) =>
        catalog.some((module) => module.key === key && module.actions.some((item) => item === action)) && grants.includes(key + ':' + action);
      // Without the team viewing grant, the service accepts only the document owner.
      if (path === '/media/kyc/:id' && ['GET', 'HEAD'].includes(req.method) && !has('kyc', 'view')) return true;
      if (
        !permission ||
        !available ||
        !permission.actions.every((action) => available.actions.includes(action) && grants.includes(delegatedGrant(permission.module, action)))
      ) {
        throw new ForbiddenException('This action is not assigned to your account');
      }
      if (path === '/broker/dashboard/records') {
        const chart = req.query?.chart;
        const module = ['availability', 'localities'].includes(chart) ? 'inventory' : ['leads', 'sources', 'pipeline'].includes(chart) ? 'leads' : null;
        if (!module || !has(module, 'view')) throw new ForbiddenException('This chart is not assigned to your account');
      }
      if (/^\/(leads|broker-requirements)\/:id\/matches$/.test(path) && !has('inventory', 'view'))
        throw new ForbiddenException('Inventory view permission is required for property matches');
      if (path.endsWith('/resolve-lead') && !has('leads', 'view'))
        throw new ForbiddenException('Leads view permission is required to open a lead conversation');
      // Existing services enforce Broker Admin's firm scoping. Delegated actions
      // must pass the check above before they can use that authorization context.
      if (path === '/broker-requirements/:id/convert' && !has('inventory', 'create'))
        throw new ForbiddenException('Inventory create permission is also required');
      req.user = {
        ...user,
        role: 'BROKER_ADMIN',
        delegatedActor: true,
        delegatedPermissions: grants.filter((grant) => {
          const [key, action] = grant.split(':');
          return has(key, action);
        }),
      };
      return true;
    }
    // The assistant uses the signed-in role when it calls product routes. Owner
    // access here leaves the linked-property scope of every downstream route intact.
    if (user && /^\/assistant\/(chat|confirm|cancel|transcribe)\/?$/.test(requestPath)) {
      if (user.rolePermissions) await this.requireFirmPermissions({ ...user, rolePermissions: user.rolePermissions }, req, requestPath, context);
      await this.modules.assertPath(requestPath, user.role === 'PROPERTY_OWNER' ? 'USER' : user.role);
      return true;
    }
    if (user?.role === 'PROPERTY_OWNER') {
      const path = requestPath.replace(/\/+$/, '');
      if (!user.orgId) throw new ForbiddenException('Firm membership required');
      if (req.method === 'POST' && /^\/assistant\/(?:chat|confirm|cancel|transcribe)$/.test(path)) {
        await this.modules.assertPath(path, 'USER');
        return true;
      }
      if (
        this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]) ||
        /^\/auth(?:\/|$)/.test(path) ||
        /^\/owner\/properties(?:\/|$)/.test(path) ||
        /^\/media\/property-video(?:\/|$)/.test(path) ||
        (path === '/me/uploads/sign' && req.method === 'POST' && req.body?.kind === 'listing')
      )
        return true;
      throw new ForbiddenException('Property Owner accounts can access their linked properties');
    }
    if (user?.rolePermissions) {
      await this.requireFirmPermissions({ ...user, rolePermissions: user.rolePermissions }, req, requestPath, context);
    }
    if (!env().BROKER_FIRST) return true;
    if (user && !['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER'].includes(user.role))
      throw new ForbiddenException('यह role अभी launch में उपलब्ध नहीं है।');
    if (user && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && !user.orgId) throw new ForbiddenException('Firm membership required');
    const path = requestPath;
    // The Connect handset routes enforce device, consent and CRM scope. Agents
    // can use those routes while firm automation settings remain admin-only.
    const agentConnect = user?.role === 'BROKER_AGENT' &&
      /^\/connect\/(?:devices(?:\/[^/]+)?|settings|directory|calls|events(?:\/[^/]+(?:\/(?:recording|review))?)?|recordings)\/?$/.test(path);
    const key = moduleForPath(path, 'api');
    if (!user && path.startsWith('/webhooks/') && this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    if (!user && key === 'consumer' && !this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]))
      throw new ForbiddenException('Login required');
    const publicSlots =
      !user &&
      key === 'slot_booking' &&
      /^\/listings\/[^/]+\/slots$/.test(path) &&
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    await this.modules.assertPath(path, agentConnect ? 'BROKER_ADMIN' : publicSlots ? 'USER' : (user?.role ?? 'PUBLIC'));
    return true;
  }
  private async requireFirmPermissions(user: Pick<RequestUser, 'role' | 'id'> & { rolePermissions: string[] }, request: any, path: string, context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return;
    const route = String(request.route?.path ?? path).replace(/^\/api(?=\/|$)/i, '').replace(/\/+$/, '').toLowerCase();
    // Full firm admins alone can control who may log in or change the authorization ceiling.
    if (!['GET', 'HEAD'].includes(request.method) && (
      /^\/broker\/team\/(?:invite(?:s)?(?:\/|$)|members\/|:[^/]+$)/.test(route) ||
      route === '/connect/firm-policy'
    )) throw new ForbiddenException('Full Broker Admin access is required to manage authorization');
    if (/^\/auth(?:\/|$)/.test(route) || /^\/me(?:$|\/(?:privacy|consent|push-tokens|notifications)(?:\/|$))/.test(route)) return;

    const has = (key: string, action: string) => user.rolePermissions.includes(key + ':' + action);
    if (route === '/broker/dashboard/records') {
      const module = ['availability', 'localities'].includes(request.query?.chart) ? 'inventory' : 'leads';
      if (!has(module, 'view')) throw new ForbiddenException('This chart is not assigned to your account');
    }
    if (/^\/(leads|broker-requirements)\/:id\/matches$/.test(route) && !has('inventory', 'view'))
      throw new ForbiddenException('Inventory view permission is required for property matches');
    if (route.endsWith('/resolve-lead') && !has('leads', 'view'))
      throw new ForbiddenException('Leads view permission is required to open a lead conversation');
    if (route === '/broker-requirements/:id/convert' && (!has('inventory', 'create') || !has('inventory', 'view')))
      throw new ForbiddenException('Inventory create permission is also required');
    if (route === '/me/uploads/sign' && request.body?.kind === 'listing' &&
      (!has('inventory', 'view') || (!has('inventory', 'create') && !has('inventory', 'edit')))) {
      throw new ForbiddenException('Inventory media requires create or edit permission');
    }
    const explicitlyMapped = delegatedEndpoint(route, request.method, request.body);
    const key = explicitlyMapped?.module ?? (
      /^\/chat(?:\/|$)/.test(route) ? 'inbox' : /^\/media\/property-video(?:\/|$)/.test(route) ? 'inventory' : moduleForPath(path, 'api')
    );
    const catalog = key && roleModulePermissions(await this.modules.all(), user.role).find((module) => module.key === key);
    if (!catalog) return;
    const actions = explicitlyMapped?.actions ?? (
      request.method === 'DELETE' ? ['delete'] : request.method === 'POST' ? ['create'] :
        ['PATCH', 'PUT'].includes(request.method) ? ['edit'] : ['view']
    );
    const assignment = request.body && Object.prototype.hasOwnProperty.call(request.body, 'assignedToId') &&
      (key === 'inventory' || key === 'leads') && user.role === 'BROKER_ADMIN' ? ['assign'] : [];
    const available: readonly string[] = catalog.actions;
    const required = [...new Set(['view', ...actions, ...assignment])].filter((action) => available.includes(action));
    if (!required.every((action) => user.rolePermissions.includes(key + ':' + action))) {
      throw new ForbiddenException('This action is not assigned to your account');
    }
  }

}
