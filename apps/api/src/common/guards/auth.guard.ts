import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { IS_PUBLIC, ROLES_KEY, type RequestUser } from '../decorators';
import { env } from '../../config/env';

/** Global guard: validates the Bearer access token unless the route is @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = this.jwt.verify(token, { secret: env().JWT_ACCESS_SECRET });
        req.user = { id: payload.sub, role: payload.role, orgId: payload.orgId ?? null, email: payload.email } satisfies RequestUser;
      } catch {
        if (!isPublic) throw new UnauthorizedException('Session expired. Please log in again.');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Login required');
    return true;
  }
}

/** Global guard: enforces @Roles(). SUPER_ADMIN passes every role check. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user: RequestUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new UnauthorizedException('Login required');
    if (user.role === 'SUPER_ADMIN' || roles.includes(user.role)) return true;
    throw new ForbiddenException('आपके account को यह access नहीं है');
  }
}
