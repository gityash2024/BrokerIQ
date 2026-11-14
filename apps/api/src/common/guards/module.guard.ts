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
    if (user?.role === 'SUB_BROKER_ADMIN') {
      const registeredPath = req.route?.path;
      if (typeof registeredPath !== 'string') throw new ForbiddenException('This action is not assigned to your account');
      const path = registeredPath.replace(/^\/api(?=\/|$)/i, '').replace(/\/+$/, '').toLowerCase();
      if (!user.orgId) throw new ForbiddenException('Firm membership required');
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
      if (isPublic || /^\/auth(?:\/|$)/.test(path) || /^\/me(?:$|\/(?:privacy|consent|push-tokens|notifications)(?:\/|$))/.test(path)) return true;
      let permission = delegatedEndpoint(path, req.method, req.body);
      if (path === '/me/uploads/sign') {
        const kind = req.body?.kind;
        if (kind === 'avatar') return true;
        permission = kind === 'listing' ? { module: 'inventory', actions: ['edit'] }
          : kind === 'kyc' ? { module: 'kyc', actions: ['create'] } : null;
      }
      if (permission && ['inventory', 'leads'].includes(permission.module) &&
          req.body && Object.prototype.hasOwnProperty.call(req.body, 'assignedToId') && !permission.actions.includes('assign')) {
        permission.actions.push('assign');
      }
      const grants: string[] = req.delegatedPermissions ?? [];
      const catalog = delegableModules(await this.modules.all());
      const available = permission && catalog.find(({ key }) => key === permission.module);
      const has = (key: string, action: string) => catalog.some((module) => module.key === key && module.actions.some((item) => item === action)) && grants.includes(key + ':' + action);
      if (!permission || !available || !permission.actions.every((action) => available.actions.includes(action) && grants.includes(delegatedGrant(permission.module, action)))) {
        throw new ForbiddenException('This action is not assigned to your account');
      }
      // Existing services enforce Broker Admin's firm scoping. Delegated actions
      // must pass the check above before they can use that authorization context.
      if (path === '/broker-requirements/:id/convert' && !has('inventory', 'create'))
        throw new ForbiddenException('Inventory create permission is also required');
      if (path === '/imports/entries/:id/approve' && !has('leads', 'create'))
        throw new ForbiddenException('Leads create permission is also required');
      req.user = {
        ...user, role: 'BROKER_ADMIN', delegatedActor: true,
        delegatedPermissions: grants.filter((grant) => {
          const [key, action] = grant.split(':');
          return has(key, action);
        }),
      };
      return true;
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
