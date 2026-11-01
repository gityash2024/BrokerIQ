import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { brokerRequirementSchema, inventoryInputSchema, type BrokerRequirementInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { InventoryService, ledgerJson } from './inventory.service';
import { AuditService } from '../../core/audit/audit.service';
import { ModulesService } from '../../core/features/modules.service';

const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().max(200).optional(),
  leadId: z.string().max(100).optional(),
  organizationId: z.string().optional(),
  intent: z.enum(['DEMAND', 'OFFER', 'UNKNOWN']).optional(),
  converted: z.enum(['true', 'false']).optional(),
});
@Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
@Controller('broker-requirements')
export class BrokerRequirementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly modules: ModulesService,
  ) {}
  private scope(user: RequestUser, organizationId?: string): Prisma.BrokerRequirementWhereInput {
    return {
      organizationId: this.inventory.orgId(user, organizationId, false),
      deletedAt: null,
      ...(user.role === 'BROKER_AGENT' ? { OR: [{ createdById: user.id }, { assignedToId: user.id }] } : {}),
    };
  }
  @Get() async list(@CurrentUser() user: RequestUser, @Query(new ZodPipe(paging)) q: z.infer<typeof paging>) {
    const where: Prisma.BrokerRequirementWhereInput = {
      ...this.scope(user, q.organizationId),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.intent ? { intent: q.intent } : {}),
      ...(q.converted ? { convertedAt: q.converted === 'true' ? { not: null } : null } : {}),
      ...(q.search
        ? {
            AND: [
              {
                OR: [
                  { contactName: { contains: q.search, mode: 'insensitive' as const } },
                  { title: { contains: q.search, mode: 'insensitive' as const } },
                  { notes: { contains: q.search, mode: 'insensitive' as const } },
                  { contactPhone: { contains: q.search } },
                ],
              },
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
    const organizationId = this.inventory.orgId(user, input.organizationId)!;
    if (input.intent === 'DEMAND' && (!input.purpose || !input.localityNames.length)) throw new BadRequestException('Purpose and preferred locality required');
    if (
      input.leadId &&
      !(await this.prisma.lead.findFirst({
        where: { id: input.leadId, organizationId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
      }))
    )
      throw new NotFoundException('Lead not found');
    const { expectedRevision: _revision, organizationId: _org, offerDetails, ...fields } = input;
    const data = {
      ...fields,
      ...(offerDetails ? { offerDetails: offerDetails as Prisma.InputJsonValue } : {}),
      organizationId,
      createdById: user.id,
      assignedToId: user.role === 'BROKER_AGENT' ? user.id : null,
    };
    const item = await this.prisma.$transaction(async (tx) => {
      if (input.clientMutationId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ':' + input.clientMutationId}))`;
        const existing = await tx.brokerRequirement.findUnique({
          where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
        });
        if (existing) {
          if (!(await tx.brokerRequirement.findFirst({ where: { ...this.scope(user), id: existing.id } })))
            throw new ForbiddenException('Requirement belongs to another member');
          return existing;
        }
      }
      return tx.brokerRequirement.create({ data });
    });
    await this.audit.log(user, 'requirement.create', 'BrokerRequirement', item.id);
    return ledgerJson(item);
  }
  private async get(id: string, user: RequestUser) {
    const item = await this.prisma.brokerRequirement.findFirst({
      where: { ...this.scope(user), id },
    });
    if (!item) throw new NotFoundException('Requirement not found');
    return item;
  }
  @Get(':id') async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return ledgerJson(await this.get(id, user));
  }
  @Patch(':id') async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(brokerRequirementSchema)) input: BrokerRequirementInput,
  ) {
    if (!input.expectedRevision) throw new BadRequestException('Reload the requirement before editing');
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BrokerRequirement" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.brokerRequirement.findFirst({ where: { ...this.scope(user), id } });
      if (!current) throw new NotFoundException('Requirement not found');
      if (current.revision !== input.expectedRevision) throw new ConflictException('Requirement changed; reload before saving');
      if (
        input.leadId &&
        !(await tx.lead.findFirst({
          where: {
            id: input.leadId,
            organizationId: current.organizationId,
            deletedAt: null,
            ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
          },
        }))
      )
        throw new NotFoundException('Lead not found');
      const { organizationId: _org, clientMutationId: _mutation, expectedRevision: _revision, offerDetails, ...fields } = input;
      return tx.brokerRequirement.update({
        where: { id },
        data: { ...fields, offerDetails: offerDetails ? (offerDetails as Prisma.InputJsonValue) : Prisma.DbNull, revision: { increment: 1 } },
      });
    });
    await this.audit.log(user, 'requirement.update', 'BrokerRequirement', id, { revision: saved.revision });
    return ledgerJson(saved);
  }
  @Post(':id/convert') async convert(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(z.object({ expectedRevision: z.number().int().positive() }))) body: { expectedRevision: number },
  ) {
    await this.modules.assertPath('/inventory', user.role);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BrokerRequirement" WHERE id = ${id} FOR UPDATE`;
      const item = await tx.brokerRequirement.findFirst({ where: { ...this.scope(user), id } });
      if (!item) throw new NotFoundException('Requirement not found');
      if (item.convertedInventoryId) return { inventoryId: item.convertedInventoryId, convertedAt: item.convertedAt, duplicate: true };
      if (item.revision !== body.expectedRevision) throw new ConflictException('Requirement changed; review the latest details');
      if (item.intent !== 'OFFER' || !item.offerDetails || item.status !== 'OPEN')
        throw new BadRequestException('Only an open, reviewed available-property offer can become inventory');
      const details = inventoryInputSchema.parse(item.offerDetails);
      if (!details.purpose || (!details.sector && !details.address))
        throw new BadRequestException('Confirm the property purpose and locality/address before conversion');
      const inventory = await this.inventory.create(
        {
          ...details,
          organizationId: item.organizationId,
          clientMutationId: `requirement:${id}`,
          assignedToId: user.role === 'SUPER_ADMIN' ? item.assignedToId : undefined,
          verificationStatus: 'NEEDS_REVIEW',
          availability: details.availability ?? 'UNKNOWN',
        },
        { ...user, orgId: item.organizationId },
        tx,
      );
      const convertedAt = new Date();
      await tx.brokerRequirement.update({
        where: { id },
        data: { convertedInventoryId: inventory.id, convertedAt, convertedById: user.id, revision: { increment: 1 },
          provenance:{...((item.provenance && typeof item.provenance==='object' && !Array.isArray(item.provenance))?item.provenance:{}),conversion:{reviewedOffer:details,reviewedRevision:item.revision,inventoryId:inventory.id,convertedAt:convertedAt.toISOString(),convertedById:user.id}} as Prisma.InputJsonValue,
        },
      });
      return { inventoryId: inventory.id as string, convertedAt, duplicate: false };
    });
    if (!result.duplicate) await this.audit.log(user, 'requirement.convert', 'BrokerRequirement', id, { inventoryId: result.inventoryId });
    return result;
  }
  @Get(':id/matches') async matches(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const item = await this.get(id, user);
    if (item.intent !== 'DEMAND') throw new BadRequestException('Matching inventory is available for customer demand records');
    return this.inventory.matching(ledgerJson(item) as BrokerRequirementInput, { ...user, orgId: item.organizationId });
  }
  @Delete(':id') async archive(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "BrokerRequirement" WHERE id=${id} FOR UPDATE`;
      const item=await tx.brokerRequirement.findFirst({where:{...this.scope(user),id}});
      if(!item)throw new NotFoundException('Requirement not found');
      await tx.brokerRequirement.update({where:{id},data:{deletedAt:new Date(),revision:{increment:1}}});
    });
    await this.audit.log(user, 'requirement.archive', 'BrokerRequirement', id);
    return { ok: true };
  }
}
