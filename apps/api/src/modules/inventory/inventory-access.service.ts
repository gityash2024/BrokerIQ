import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PROPERTY_AMENITIES, PROPERTY_FIELDS, clientPropertyShare, inventoryDateSchema, propertyDetailsSchema } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { requireOrg } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';

const catalogue = { availability: 'AVAILABLE', status: 'ACTIVE', verificationStatus: 'VERIFIED', directoryMonth: { not: null } } as const;
const overviewKeys = [
  'id',
  'organizationId',
  'organization',
  'date',
  'propertyType',
  'purpose',
  'category',
  'roomKind',
  'bhk',
  'furnishing',
  'area',
  'areaUnit',
  'monthlyRent',
  'rent',
  'totalSalePrice',
  'ratePerArea',
  'rateAreaUnit',
  'price',
  'ratePerSqft',
  'securityDeposit',
  'availability',
  'status',
  'verificationStatus',
  'availableSince',
  'directoryMonth',
  'revision',
  'sourceType',
  'createdAt',
  'updatedAt',
  'matchingLeadsCount',
] as const;
const reviewerWhere = {
  OR: [
    { role: 'BROKER_ADMIN' as const },
    { role: 'SUB_BROKER_ADMIN' as const, delegatedPermissions: { hasEvery: ['inventory:view', 'inventory:approve_details'] } },
  ],
};

@Injectable()
export class InventoryAccessService {
  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationsService,
    jobs: JobsService,
  ) {
    jobs.register('inventory.access-notification', async ({ notificationId }) => {
      const note = await this.db.notification.findUnique({ where: { id: notificationId }, include: { user: true } });
      if (!note || note.user.status !== 'ACTIVE' || note.user.deletedAt) return;
      await this.notifications.dispatchSaved(note);
    });
  }

  private organization(user: RequestUser) {
    return user.role === 'SUPER_ADMIN' ? undefined : requireOrg(user);
  }

  readScope(user: RequestUser): Prisma.InventoryItemWhereInput {
    if (user.role !== 'BROKER_AGENT') return {};
    return { OR: [{ createdById: user.id }, { assignedToId: user.id }, catalogue, { detailAccess: { some: { agentId: user.id, status: 'APPROVED' } } }] };
  }

  private reviewer(user: RequestUser) {
    return (
      user.role === 'SUPER_ADMIN' ||
      (user.role === 'BROKER_ADMIN' && (!user.delegatedActor || user.delegatedPermissions?.includes('inventory:approve_details')))
    );
  }

  /** Every response path, including CSV, uses the same field projection. */
  async present<T extends Record<string, any>>(items: T[], user: RequestUser): Promise<Record<string, any>[]> {
    if (user.role !== 'BROKER_AGENT') return items.map((item) => ({ ...item, canEdit: true, detailAccess: 'OWN' }));
    const ids = items.map((item) => item.id);
    const [owned, grants] = await Promise.all([
      this.db.inventoryItem.findMany({
        where: { id: { in: ids }, organizationId: this.organization(user), OR: [{ createdById: user.id }, { assignedToId: user.id }] },
        select: { id: true },
      }),
      this.db.inventoryDetailAccess.findMany({ where: { inventoryId: { in: ids }, agentId: user.id }, select: { inventoryId: true, status: true } }),
    ]);
    const editable = new Set(owned.map((item) => item.id));
    const statuses = new Map(grants.map((grant) => [grant.inventoryId, grant.status]));
    return items.map((item) => {
      const status = editable.has(item.id) ? 'OWN' : (statuses.get(item.id) ?? 'LOCKED');
      if (status === 'OWN' || status === 'APPROVED') return { ...item, canEdit: editable.has(item.id), detailAccess: status };
      const safe: Record<string, any> = Object.fromEntries(overviewKeys.filter((key) => key in item).map((key) => [key, item[key]]));
      const message = clientPropertyShare(item);
      safe.sector = message.match(/^📍 Location: (.+)$/m)?.[1] ?? null;
      safe.floor = message.match(/^🏢 Floor: (.+)$/m)?.[1] ?? null;
      const details = propertyDetailsSchema.safeParse(item.details ?? {});
      safe.details = details.success
        ? Object.fromEntries(
            Object.entries(details.data).filter(([key, value]) => {
              const field = PROPERTY_FIELDS.find((entry) => entry.key === key);
              return field && (field.kind !== 'text' || (['possessionDate', 'availableFrom'].includes(key) && inventoryDateSchema.safeParse(value).success));
            }),
          )
        : {};
      safe.amenities = (item.amenities ?? []).filter((value: string) => PROPERTY_AMENITIES.includes(value));
      return {
        ...safe,
        houseNo: null,
        unitLabel: null,
        address: null,
        ownerName: null,
        ownerPhone: null,
        notes: null,
        photoUrls: [],
        videoUrls: [],
        contacts: [],
        publishedListingId: null,
        publishedListing: null,
        directionsUrl: null,
        sourceEntry: null,
        sourceEntryId: null,
        sourceUnitKey: null,
        pageNo: null,
        createdById: null,
        assignedToId: null,
        assignedTo: null,
        createdBy: null,
        deletedAt: null,
        isPublished: false,
        detailAccess: status,
        canEdit: false,
      };
    });
  }

  async requests(id: string, user: RequestUser) {
    if (!this.reviewer(user)) return [];
    const item = await this.db.inventoryItem.findFirst({ where: { id, organizationId: this.organization(user), deletedAt: null }, select: { id: true } });
    if (!item) throw new NotFoundException('Property not found');
    return this.db.inventoryDetailAccess.findMany({
      where: { inventoryId: id, agent: { organizationId: this.organization(user), role: 'BROKER_AGENT', status: 'ACTIVE', deletedAt: null } },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  private async queue(tx: Prisma.TransactionClient, ids: string[], id: string, kind: string, title: string) {
    const notes = await tx.notification.createManyAndReturn({
      data: [...new Set(ids)].map((userId) => ({ userId, kind, title, link: '/broker/inventory/' + id, data: { inventoryId: id } })),
    });
    if (notes.length)
      await tx.job.createMany({
        data: notes.map((note) => ({
          type: 'inventory.access-notification',
          key: 'inventory-access:' + note.id,
          payload: { notificationId: note.id },
        })),
      });
  }

  async request(id: string, user: RequestUser) {
    if (user.role !== 'BROKER_AGENT') throw new ForbiddenException('Only an Agent can request property details');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id=${id} FOR UPDATE`;
      const item = await tx.inventoryItem.findFirst({ where: { id, organizationId: this.organization(user), deletedAt: null, ...this.readScope(user) } });
      if (!item) throw new NotFoundException('Available property not found');
      if (item.createdById === user.id || item.assignedToId === user.id) return { status: 'OWN' };
      const current = await tx.inventoryDetailAccess.findUnique({ where: { inventoryId_agentId: { inventoryId: id, agentId: user.id } } });
      if (current && ['PENDING', 'APPROVED'].includes(current.status)) return { status: current.status };
      const request = await tx.inventoryDetailAccess.upsert({
        where: { inventoryId_agentId: { inventoryId: id, agentId: user.id } },
        create: { inventoryId: id, agentId: user.id },
        update: { status: 'PENDING', requestedAt: new Date(), reviewedAt: null, reviewedById: null },
      });
      const reviewers = await tx.user.findMany({
        where: { organizationId: this.organization(user), status: 'ACTIVE', deletedAt: null, ...reviewerWhere },
        select: { id: true },
      });
      await this.queue(
        tx,
        reviewers.map((member) => member.id),
        id,
        'INVENTORY_ACCESS_REQUESTED',
        'Agent requested property details',
      );
      return { status: request.status };
    });
  }

  async review(id: string, agentId: string, input: { action: 'approve' | 'reject' | 'revoke'; expectedUpdatedAt: string }, user: RequestUser) {
    if (!this.reviewer(user)) throw new ForbiddenException('Property detail approval permission required');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id=${id} FOR UPDATE`;
      const item = await tx.inventoryItem.findFirst({ where: { id, organizationId: this.organization(user), deletedAt: null } });
      if (!item) throw new NotFoundException('Property not found');
      const access = await tx.inventoryDetailAccess.findFirst({
        where: { inventoryId: id, agentId, agent: { role: 'BROKER_AGENT', organizationId: item.organizationId, status: 'ACTIVE', deletedAt: null } },
      });
      if (!access) throw new NotFoundException('Agent access request not found');
      const status = input.action === 'approve' ? 'APPROVED' : input.action === 'reject' ? 'REJECTED' : 'REVOKED';
      if (access.status === status) return access;
      if (access.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException('This request changed. Refresh before reviewing.');
      if ((input.action === 'revoke' && access.status !== 'APPROVED') || (input.action !== 'revoke' && access.status !== 'PENDING'))
        throw new BadRequestException('This action is not available for the current access state');
      const updated = await tx.inventoryDetailAccess.update({ where: { id: access.id }, data: { status, reviewedById: user.id, reviewedAt: new Date() } });
      await this.queue(
        tx,
        [agentId],
        id,
        'INVENTORY_ACCESS_' + status,
        status === 'APPROVED' ? 'Property details access approved' : 'Property details access ' + status.toLowerCase(),
      );
      return updated;
    });
  }
}
