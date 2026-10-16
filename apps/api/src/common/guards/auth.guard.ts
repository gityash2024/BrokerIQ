import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { IS_PUBLIC, ROLES_KEY, type RequestUser } from '../decorators';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

/** Global guard: validates the Bearer access token unless the route is @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    let sessionVersion = 0;

    if (token) {
      try {
        const payload = this.jwt.verify(token, { secret: env().JWT_ACCESS_SECRET });
        sessionVersion = payload.sessionVersion ?? 0;
        if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0) throw new Error('Invalid session version');
        req.user = { id: payload.sub, role: payload.role, orgId: payload.orgId ?? null, email: payload.email } satisfies RequestUser;
      } catch {
        if (!isPublic) throw new UnauthorizedException('Session expired. Please log in again.');
      }
    }
    if (req.user) {
      const current = await this.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, role: true, organizationId: true, email: true, status: true, deletedAt: true, sessionVersion: true, organization: { select: { status: true } } },
      });
      if (!current || current.sessionVersion !== sessionVersion || current.deletedAt || current.status !== 'ACTIVE' || (current.role !== 'SUPER_ADMIN' && current.organization?.status === 'SUSPENDED')) {
        if (!isPublic) throw new UnauthorizedException('Account no longer active');
        delete req.user;
      } else {
        req.user = { id: current.id, role: current.role, orgId: current.organizationId, email: current.email } satisfies RequestUser;
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
