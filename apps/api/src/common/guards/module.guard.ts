import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators';
import { moduleForPath } from '@brokeriq/shared';
import { ModulesService } from '../../core/features/modules.service';
import { env } from '../../config/env';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly modules: ModulesService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http' || !env().BROKER_FIRST) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (user && !['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER'].includes(user.role)) throw new ForbiddenException('यह role अभी launch में उपलब्ध नहीं है।');
    if (user && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && !user.orgId) throw new ForbiddenException('Firm membership required');
    const path = (req.path || req.url).replace(/^\/api(?=\/|$)/, '');
    const key = moduleForPath(path, 'api');
    if (!user && path.startsWith('/webhooks/') && this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]))
      return true;
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
