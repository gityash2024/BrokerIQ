import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { GrowthFeature } from '@brokeriq/shared';

export const IS_PUBLIC = 'isPublic';
/** Route does not require authentication (JWT is still parsed if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const FEATURE_KEY = 'feature';
/** Route belongs to a growth feature Super Admin can switch off (see GROWTH_FEATURES, FeatureGuard). */
export const Feature = (key: GrowthFeature) => SetMetadata(FEATURE_KEY, key);

export interface RequestUser {
  id: string;
  role: Role;
  orgId: string | null;
  email: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip)?.trim();
});
