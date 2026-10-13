import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { defaultModulePolicies, moduleAllowed, moduleForPath, modulePolicySchema, PLATFORM_MODULES, type ModulePolicies } from '@brokeriq/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { env } from '../../config/env';
import type { RequestUser } from '../../common/decorators';

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async enabled(key: string) {
    return !env().BROKER_FIRST || moduleAllowed(await this.all(), key, 'BROKER_ADMIN');
  }
  async all(): Promise<ModulePolicies> {
    const defaults = defaultModulePolicies();
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'platform.modules' } });
    if (!row) return defaults;
    const stored = row.value as Record<string, unknown>;
    for (const key of Object.keys(defaults)) {
      if (stored[key] !== undefined) defaults[key] = modulePolicySchema.parse(stored[key]);
    }
    return defaults;
  }
  async assertPath(path: string, role: string, surface: 'api' | 'job' = 'api') {
    if (!env().BROKER_FIRST) return;
    const key = moduleForPath(path, surface);
    if (key && !moduleAllowed(await this.all(), key, role))
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FEATURE_DISABLED',
        message: 'यह सुविधा अभी उपलब्ध नहीं है।',
        details: { module: key },
      });
  }
  async save(key: string, value: unknown, actor: RequestUser) {
    if (!PLATFORM_MODULES.some((m) => m.key === key)) throw new NotFoundException('Unknown module');
    const policy = modulePolicySchema.parse(value);
    // Lock the row to avoid lost updates when two admin tabs edit different modules.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(831042)`;
      const row = await tx.systemSetting.findUnique({ where: { key: 'platform.modules' } });
      const policies = { ...defaultModulePolicies(), ...((row?.value as Record<string, unknown>) ?? {}), [key]: policy };
      await tx.systemSetting.upsert({
        where: { key: 'platform.modules' },
        create: { key: 'platform.modules', value: policies as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: policies as Prisma.InputJsonValue, updatedById: actor.id },
      });
    });
    await this.audit.log(actor, 'module.update', 'Module', key, policy);
    return this.all();
  }
}
