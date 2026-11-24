import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators';
import { delegatedGrant, delegableModules, moduleForPath } from '@brokeriq/shared';
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
      if (path === '/connect/profile' && req.method === 'GET') return true;
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
        permission = kind === 'listing' ? { module: 'inventory', actions: [listingAction] } : null;
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
    if (user?.role === 'PROPERTY_OWNER') {
      const path = requestPath.replace(/\/+$/, '');
      if (!user.orgId) throw new ForbiddenException('Firm membership required');
      if (
        this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]) ||
        /^\/auth(?:\/|$)/.test(path) ||
        /^\/owner\/properties(?:\/|$)/.test(path) ||
        path === '/connect/profile' ||
        /^\/media\/property-video(?:\/|$)/.test(path) ||
        (path === '/me/uploads/sign' && req.method === 'POST' && req.body?.kind === 'listing')
      )
        return true;
      throw new ForbiddenException('Property Owner accounts can access their linked properties');
    }
    if (!env().BROKER_FIRST) return true;
    if (user && !['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER'].includes(user.role))
      throw new ForbiddenException('यह role अभी launch में उपलब्ध नहीं है।');
    if (user && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && !user.orgId) throw new ForbiddenException('Firm membership required');
    const path = requestPath;
    const key = moduleForPath(path, 'api');
    if (!user && path.startsWith('/webhooks/') && this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    if (!user && key === 'consumer' && !this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]))
      throw new ForbiddenException('Login required');
    const publicSlots =
      !user &&
      key === 'slot_booking' &&
      /^\/listings\/[^/]+\/slots$/.test(path) &&
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    await this.modules.assertPath(path, publicSlots ? 'USER' : (user?.role ?? 'PUBLIC'));
    return true;
  }
}
