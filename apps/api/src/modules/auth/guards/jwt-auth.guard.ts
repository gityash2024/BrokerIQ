import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role, ROLE_PERMISSIONS } from '@brokeriq/shared';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly jwtService?: JwtService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (user && !err) {
      return user;
    }

    // Validation fallback if passport strategy fails or is not executed
    const request = context.switchToHttp().getRequest();
    const authHeader = request?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && this.jwtService) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_ACCESS_SECRET || 'brokeriq_super_secret_jwt_key_2026',
        });
        if (payload && (payload.sub || payload.id)) {
          const activeRole: Role = payload.activeRole || payload.role;
          const resolvedUser = {
            id: payload.sub || payload.id,
            email: payload.email,
            name: payload.name,
            role: payload.role,
            activeRole,
            availableRoles: payload.availableRoles || [payload.role],
            organizationId: payload.organizationId || null,
            permissions: payload.permissions || ROLE_PERMISSIONS[activeRole] || [],
          };
          request.user = resolvedUser;
          return resolvedUser;
        }
      } catch {
        // Fall through to unauthorized
      }
    }

    throw err || new UnauthorizedException('Authentication token missing or invalid');
  }
}