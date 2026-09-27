import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@brokeriq/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User context not available for authorization');
    }

    const activeRole: Role | string = user.activeRole || user.role;

    // Super Admin bypasses role checks
    if (activeRole === Role.SUPER_ADMIN || user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Role equivalence: BROKER_AGENT is equivalent to BROKER_STAFF
    const matches = requiredRoles.some((role) => {
      if (role === activeRole) return true;
      if (
        (role === Role.BROKER_AGENT && activeRole === Role.BROKER_STAFF) ||
        (role === Role.BROKER_STAFF && activeRole === Role.BROKER_AGENT)
      ) {
        return true;
      }
      return false;
    });

    if (!matches) {
      throw new ForbiddenException(
        `Access denied. Requires one of [${requiredRoles.join(', ')}]. Active role: ${activeRole}`,
      );
    }

    return true;
  }
}