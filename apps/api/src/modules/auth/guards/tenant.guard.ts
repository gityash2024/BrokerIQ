import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@brokeriq/shared';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return true;
    }

    const activeRole = user.activeRole || user.role;

    // Super Admin, Property Owner, and Seeker operate across or outside individual agency tenants
    if (
      activeRole === Role.SUPER_ADMIN ||
      user.role === Role.SUPER_ADMIN ||
      activeRole === Role.PROPERTY_OWNER ||
      activeRole === Role.SEEKER
    ) {
      return true;
    }

    // Check organization ID from header, path params, query or body
    const targetOrgId =
      request.headers?.['x-organization-id'] ||
      request.headers?.['x-tenant-id'] ||
      request.params?.organizationId ||
      request.query?.organizationId ||
      request.body?.organizationId;

    if (targetOrgId && user.organizationId && targetOrgId !== user.organizationId) {
      throw new ForbiddenException(
        'Tenant isolation violation: cross-organization access forbidden',
      );
    }

    return true;
  }
}