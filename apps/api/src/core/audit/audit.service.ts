import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/decorators';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: Partial<RequestUser> | null | undefined, action: string, entity?: string, entityId?: string | null, meta?: unknown, ip?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          actorRole: actor?.role ?? null,
          organizationId: actor?.orgId ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
          ip,
        },
      });
    } catch (e) {
      this.logger.warn(`audit log failed: ${(e as Error).message}`);
    }
  }
}
