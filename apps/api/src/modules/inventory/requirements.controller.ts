import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { brokerRequirementSchema, type BrokerRequirementInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { InventoryService, ledgerJson } from './inventory.service';
import { AuditService } from '../../core/audit/audit.service';

const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().max(200).optional(),
  leadId: z.string().max(100).optional(),
  organizationId: z.string().optional(),
});
@Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
@Controller('broker-requirements')
export class BrokerRequirementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}
  @Get() async list(@CurrentUser() user: RequestUser, @Query(new ZodPipe(paging)) q: z.infer<typeof paging>) {
    const where = {
      organizationId: this.inventory.orgId(user, q.organizationId, false),
      deletedAt: null,
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.search
        ? {
            OR: [
              { contactName: { contains: q.search, mode: 'insensitive' as const } },
              { notes: { contains: q.search, mode: 'insensitive' as const } },
              { contactPhone: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.brokerRequirement.findMany({ where, skip: (q.page - 1) * 30, take: 30, orderBy: { createdAt: 'desc' } }),
      this.prisma.brokerRequirement.count({ where }),
    ]);
    return { items: items.map(ledgerJson), total, page: q.page, totalPages: Math.ceil(total / 30) };
  }
  @Post() async create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(brokerRequirementSchema)) input: BrokerRequirementInput) {
    const organizationId = this.inventory.orgId(user)!;
    if (!input.purpose || !input.localityNames.length) throw new BadRequestException('Purpose and preferred locality required');
    if (input.leadId && !(await this.prisma.lead.findFirst({ where: { id: input.leadId, organizationId, deletedAt: null } })))
      throw new NotFoundException('Lead not found');
    const item = input.clientMutationId
      ? await this.prisma.brokerRequirement.upsert({
          where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
          create: { ...input, organizationId },
          update: {},
        })
      : await this.prisma.brokerRequirement.create({ data: { ...input, organizationId } });
    await this.audit.log(user, 'requirement.create', 'BrokerRequirement', item.id);
    return ledgerJson(item);
  }
  private async get(id: string, user: RequestUser) {
    const item = await this.prisma.brokerRequirement.findFirst({
      where: { id, organizationId: this.inventory.orgId(user, undefined, false), deletedAt: null },
    });
    if (!item) throw new NotFoundException('Requirement not found');
    return item;
  }
  @Get(':id/matches') async matches(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const item = await this.get(id, user);
    return this.inventory.matching(ledgerJson(item) as BrokerRequirementInput, { ...user, orgId: item.organizationId, role: 'BROKER_ADMIN' });
  }
  @Delete(':id') async archive(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.get(id, user);
    await this.prisma.brokerRequirement.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(user, 'requirement.archive', 'BrokerRequirement', id);
    return { ok: true };
  }
}
