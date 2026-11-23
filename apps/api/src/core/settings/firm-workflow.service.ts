import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const key = 'workflow.options';
type Options = { freeOnly: boolean; ownerAuto: boolean };

@Injectable()
export class FirmWorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(organizationId: string | null | undefined): Promise<Options> {
    if (!organizationId) return { freeOnly: false, ownerAuto: false };
    const [firm, setting] = await Promise.all([
      this.db.organization.findUnique({ where: { id: organizationId }, select: { slug: true } }),
      this.db.orgSetting.findUnique({ where: { organizationId_key: { organizationId, key } }, select: { value: true } }),
    ]);
    const options = setting?.value as Partial<Options> | undefined;
    return { freeOnly: options?.freeOnly ?? firm?.slug === 'olive-state', ownerAuto: options?.ownerAuto === true };
  }

  async configure(input: Partial<Options> & { confirmCharges?: boolean }, user: RequestUser) {
    if (user.role !== 'BROKER_ADMIN' || user.delegatedActor) throw new ForbiddenException('Only your Broker Admin can change firm settings.');
    const organizationId = requireOrg(user);
    if (input.freeOnly === false && !input.confirmCharges) throw new BadRequestException('Confirm that the provider may charge for messages.');
    const value = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
      const firm = await tx.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
      if (!firm) throw new NotFoundException('Firm not found');
      const record = await tx.orgSetting.findUnique({ where: { organizationId_key: { organizationId, key } } });
      const prior = (record?.value ?? {}) as Partial<Options>;
      const options = {
        freeOnly: input.freeOnly ?? prior.freeOnly ?? firm.slug === 'olive-state',
        ownerAuto: input.ownerAuto ?? prior.ownerAuto === true,
      };
      await tx.orgSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        create: { organizationId, key, value: options, updatedById: user.id },
        update: { value: options, updatedById: user.id },
      });
      return options;
    });
    await this.audit.log(user, 'firm.workflow.update', 'Organization', organizationId, value);
    return value;
  }
}
