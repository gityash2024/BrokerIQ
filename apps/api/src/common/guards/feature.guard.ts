import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY, type RequestUser } from '../decorators';
import { FeaturesService } from '../../core/features/features.service';

/** Blocks `@Feature(key)` routes while Super Admin has that feature switched off (Super Admin itself is never blocked). */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    const key = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (!key) return true;
    const user: RequestUser | undefined = context.switchToHttp().getRequest().user;
    if (user?.role === 'SUPER_ADMIN') return true;
    await this.features.assertEnabled(key);
    return true;
  }
}
