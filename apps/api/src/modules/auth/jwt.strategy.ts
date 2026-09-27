import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, ROLE_PERMISSIONS } from '@brokeriq/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'brokeriq_super_secret_jwt_key_2026',
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const activeRole: Role = payload.activeRole || payload.role;
    const permissions = payload.permissions || ROLE_PERMISSIONS[activeRole] || [];

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      activeRole,
      availableRoles: payload.availableRoles || [payload.role],
      organizationId: payload.organizationId || null,
      permissions,
    };
  }
}