import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ModulesService } from '../../core/features/modules.service';
import { env } from '../../config/env';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly modules: ModulesService) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http' || !env().BROKER_FIRST) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (user && !['SUPER_ADMIN', 'BROKER_ADMIN'].includes(user.role)) throw new ForbiddenException('यह role अभी launch में उपलब्ध नहीं है।');
    if (user?.role === 'BROKER_ADMIN' && !user.orgId) throw new ForbiddenException('Firm membership required');
    const path = (req.path || req.url).replace(/^\/api(?=\/|$)/, '');
    await this.modules.assertPath(path, user?.role ?? 'PUBLIC');
    return true;
  }
}
