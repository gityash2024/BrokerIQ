import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  inventoryInputSchema,
  ownerEditablePropertySchema,
  ownerPropertyValues,
  type OwnerCreatePropertyInput,
  type OwnerEditPropertyInput,
  type OwnerReportInput,
} from '@brokeriq/shared';
import { isDeepStrictEqual } from 'node:util';
import { InventoryService, ledgerJson } from './inventory.service';
import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

const reportFields = { id: true, status: true, availableFrom: true, note: true, createdAt: true } as const;
const editableFields = Object.fromEntries(Object.keys(ownerEditablePropertySchema.shape).map((key) => [key, true])) as Record<
  keyof typeof ownerEditablePropertySchema.shape,
  true
>;
const propertyFields = { ...editableFields, id: true, revision: true, availability: true, verificationStatus: true } satisfies Prisma.InventoryItemSelect;
const proposalFields = { id: true, propertyChanges: true, createdAt: true } as const;
const proposalData = (row: { id: string; propertyChanges: Prisma.JsonValue; createdAt: Date } | undefined) =>
  row ? { id: row.id, changes: ownerEditablePropertySchema.parse(row.propertyChanges), createdAt: row.createdAt } : null;
const latest = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.InventoryOwnerReportOrderByWithRelationInput[];

@Injectable()
export class InventoryOwnerService {
  private readonly logger = new Logger(InventoryOwnerService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
  ) {}

  private ownerScope(user: RequestUser) {
    if (user.role !== 'PROPERTY_OWNER') throw new ForbiddenException('Property Owner role required');
    return { organizationId: requireOrg(user), ownerUserId: user.id, deletedAt: null };
  }

  private firmScope(user: RequestUser) {
    return { organizationId: requireOrg(user), deletedAt: null };
  }

  private shape(property: { verificationStatus: string; id: string } & Record<string, unknown>) {
    const { verificationStatus, ...record } = ledgerJson(property);
    return { ...record, needsReview: verificationStatus === 'NEEDS_REVIEW' };
  }

  async myProperties(user: RequestUser, page: number) {
    const rows = await this.db.inventoryItem.findMany({
      where: this.ownerScope(user),
      orderBy: [{ sector: 'asc' }, { houseNo: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * 25,
      take: 26,
      select: {
        id: true,
        revision: true,
        sector: true,
        houseNo: true,
        unitLabel: true,
        floor: true,
        furnishing: true,
        bhk: true,
        roomKind: true,
        propertyType: true,
        address: true,
        monthlyRent: true,
        totalSalePrice: true,
        availability: true,
        verificationStatus: true,
        ownerReports: {
          where: { ownerId: user.id, OR: [{ status: { not: null } }, { reviewState: 'PENDING' }] },
          orderBy: latest,
          select: { ...reportFields, reviewState: true },
        },
      },
    });
    return {
      items: rows
        .slice(0, 25)
        .map(({ ownerReports, ...property }) => ({
          ...this.shape(property),
          ownerReport: ownerReports.find(({ status }) => !!status) ?? null,
          hasPendingChanges: ownerReports.some(({ reviewState }) => reviewState === 'PENDING'),
        })),
      hasMore: rows.length > 25,
    };
  }

  async myProperty(id: string, user: RequestUser) {
    const property = await this.db.inventoryItem.findFirst({
      where: { id, ...this.ownerScope(user) },
      select: {
        ...propertyFields,
        ownerReports: { where: { ownerId: user.id }, orderBy: latest, select: { ...reportFields, ...proposalFields, reviewState: true } },
      },
    });
    if (!property) throw new NotFoundException('Linked property not found');
    const { ownerReports, ...record } = property;
    const availability = ownerReports.find(({ status }) => !!status);
    return {
      ...this.shape(record),
      ownerReport: availability
        ? {
            id: availability.id,
            status: availability.status,
            availableFrom: availability.availableFrom,
            note: availability.note,
            createdAt: availability.createdAt,
          }
        : null,
      pendingChanges: proposalData(ownerReports.find(({ reviewState }) => reviewState === 'PENDING')),
    };
  }

  private checkInput(input: unknown) {
    const parsed = inventoryInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0].message);
  }

  async create(input: OwnerCreatePropertyInput, user: RequestUser) {
    const scope = this.ownerScope(user);
    this.checkInput(input);
    const { id, notices } = await this.db.$transaction(async (tx) => {
      const key = 'owner:' + user.id + ':' + input.clientMutationId;
      // Lock the same request key as InventoryService before deciding whether to send a notification.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'inventory-create:' + scope.organizationId + ':' + key}))`;
      const prior = await tx.inventoryItem.findUnique({
        where: { organizationId_clientMutationId: { organizationId: scope.organizationId, clientMutationId: key } },
        select: { id: true },
      });
      const item = await this.inventory.createOwnerDraft(input, user, tx);
      const notices = prior ? [] : await this.notify(tx, user, item.id, null, 'New property from owner', 'Review the property details submitted by its owner.');
      return { id: item.id as string, notices };
    });
    this.dispatch(notices);
    return this.myProperty(id, user);
  }

  async edit(id: string, input: OwnerEditPropertyInput, user: RequestUser) {
    const scope = this.ownerScope(user);
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} AND "organizationId" = ${scope.organizationId} AND "ownerUserId" = ${user.id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { id, ...scope } });
      if (!current) throw new NotFoundException('Linked property not found');
      const key = { inventoryId: id, ownerId: user.id, clientMutationId: input.clientMutationId };
      const prior = await tx.inventoryOwnerReport.findUnique({ where: { inventoryId_ownerId_clientMutationId: key } });
      const changes = JSON.parse(JSON.stringify(input.changes)) as Prisma.InputJsonObject;
      if (prior) {
        if (!isDeepStrictEqual(prior.propertyChanges, changes)) throw new ConflictException('This update was already submitted.');
        return { proposal: prior, notices: [] };
      }
      if (input.expectedRevision !== current.revision) throw new ConflictException('The property changed. Reopen the editor before saving.');
      const effective = { ...ledgerJson(current), ...input.changes };
      if (!effective.houseNo?.trim() || (!effective.sector?.trim() && !effective.address?.trim()))
        throw new BadRequestException('Enter a house number and sector or address');
      this.checkInput(ownerPropertyValues(effective));
      await tx.inventoryOwnerReport.updateMany({ where: { inventoryId: id, reviewState: 'PENDING' }, data: { reviewState: 'SUPERSEDED' } });
      const proposal = await tx.inventoryOwnerReport.create({
        data: { ...key, propertyChanges: changes, reviewState: 'PENDING', baseRevision: current.revision + 1 },
      });
      await tx.inventoryItem.update({ where: { id }, data: { revision: { increment: 1 } } });
      const notices = await this.notify(
        tx,
        user,
        id,
        current.assignedToId,
        'Property details updated by owner',
        'Review the property details submitted by its owner.',
      );
      return { proposal, notices };
    });
    this.dispatch(result.notices);
    return proposalData(result.proposal);
  }

  private async notify(tx: Prisma.TransactionClient, user: RequestUser, id: string, assignedToId: string | null, title: string, body: string) {
    const recipients = await tx.user.findMany({
      where: {
        organizationId: requireOrg(user),
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { role: 'BROKER_ADMIN' },
          { role: 'SUB_BROKER_ADMIN', delegatedPermissions: { has: 'inventory:view' } },
          { role: 'BROKER_AGENT', id: assignedToId ?? '' },
        ],
      },
      select: { id: true },
    });
    return tx.notification.createManyAndReturn({
      data: recipients.map(({ id: userId }) => ({ userId, kind: 'SYSTEM', title, body, link: '/broker/inventory/' + id })),
    });
  }

  private dispatch(notices: Awaited<ReturnType<InventoryOwnerService['notify']>>) {
    for (const notice of notices) {
      void this.notifications.dispatchSaved(notice).catch(() => this.logger.warn('Owner update delivery failed for notification ' + notice.id));
    }
  }

  async report(id: string, input: OwnerReportInput, user: RequestUser) {
    const scope = this.ownerScope(user);
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const property = await tx.inventoryItem.findFirst({ where: { id, ...scope }, select: { assignedToId: true } });
      if (!property) throw new NotFoundException('Linked property not found');
      const key = { inventoryId: id, ownerId: user.id, clientMutationId: input.clientMutationId };
      const existing = await tx.inventoryOwnerReport.findUnique({ where: { inventoryId_ownerId_clientMutationId: key }, select: reportFields });
      const fields = { status: input.status, availableFrom: input.availableFrom ?? null, note: input.note || null };
      if (existing) {
        if (existing.status !== fields.status || existing.availableFrom !== fields.availableFrom || existing.note !== fields.note)
          throw new ConflictException('This update was already saved. Start a new update.');
        return { report: existing, notificationIds: [] };
      }
      const report = await tx.inventoryOwnerReport.create({ data: { ...key, ...fields }, select: reportFields });
      const notices = await this.notify(
        tx,
        user,
        id,
        property.assignedToId,
        'Property owner update',
        'Review the owner’s latest rental or availability information.',
      );
      return { report, notificationIds: notices };
    });
    this.dispatch(result.notificationIds);
    return result.report;
  }

  owners(user: RequestUser, search?: string) {
    return this.db.user.findMany({
      where: {
        organizationId: requireOrg(user),
        role: 'PROPERTY_OWNER',
        status: 'ACTIVE',
        deletedAt: null,
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, name: true, email: true },
      take: 50,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  private staffPropertyScope(user: RequestUser) {
    const scope = this.firmScope(user);
    return user.role === 'BROKER_AGENT' ? { ...scope, OR: [{ createdById: user.id }, { assignedToId: user.id }] } : scope;
  }

  async info(id: string, user: RequestUser) {
    const item = await this.db.inventoryItem.findFirst({
      where: { id, ...this.staffPropertyScope(user) },
      select: {
        ownerUser: { select: { id: true, name: true, status: true } },
        ownerUserId: true,
        verificationStatus: true,
        ownerReports: {
          where: { OR: [{ status: { not: null } }, { reviewState: 'PENDING' }] },
          orderBy: latest,
          select: { ...reportFields, ...proposalFields, reviewState: true, ownerId: true, owner: { select: { name: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException('Property not found');
    const own = item.ownerReports.filter(({ ownerId }) => ownerId === item.ownerUserId);
    const latestReport = own.find(({ status }) => !!status);
    return {
      owner: item.ownerUser,
      detailsNeedReview: item.verificationStatus === 'NEEDS_REVIEW',
      report: latestReport
        ? { ...Object.fromEntries(Object.keys(reportFields).map((key) => [key, latestReport[key as keyof typeof reportFields]])), owner: latestReport.owner }
        : null,
      pendingChanges: proposalData(own.find(({ reviewState }) => reviewState === 'PENDING')),
    };
  }

  async review(id: string, proposalId: string, expectedRevision: number, accept: boolean, user: RequestUser) {
    if (user.role !== 'BROKER_ADMIN') throw new ForbiddenException('Broker Admin scope required');
    await this.inventory.update(id, { expectedRevision }, user, { id: proposalId, accept });
    return this.info(id, user);
  }

  async link(id: string, ownerUserId: string | null, expectedRevision: number, user: RequestUser) {
    const scope = this.firmScope(user);
    await this.db.$transaction(async (tx) => {
      const prior = await tx.inventoryItem.findFirst({ where: { id, ...scope }, select: { ownerUserId: true } });
      if (!prior) throw new NotFoundException('Property not found');
      if (
        ownerUserId &&
        !(await tx.user.findFirst({
          where: { id: ownerUserId, organizationId: scope.organizationId, role: 'PROPERTY_OWNER', status: 'ACTIVE', deletedAt: null },
          select: { id: true },
        }))
      )
        throw new BadRequestException('Choose an active Property Owner from this firm');
      const updated = await tx.inventoryItem.updateMany({
        where: { id, revision: expectedRevision, ...scope },
        data: { ownerUserId, revision: { increment: 1 } },
      });
      if (!updated.count) throw new ConflictException('The property changed. Reload it before linking an owner.');
      if (prior.ownerUserId !== ownerUserId) {
        await tx.inventoryOwnerReport.updateMany({ where: { inventoryId: id, reviewState: 'PENDING' }, data: { reviewState: 'SUPERSEDED' } });
      }
    });
    await this.audit.log(user, 'inventory.owner.link', 'InventoryItem', id, { ownerUserId });
    return this.info(id, user);
  }
}
