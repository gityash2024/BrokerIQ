import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, PropertyType } from '@prisma/client';
import {
  type InventoryInput,
  type BrokerRequirementInput,
  ledgerMatch,
  areaSqft,
  normalizeIndianPhone,
  propertyDetailsSchema,
  PROPERTY_FIELDS,
  INVENTORY_SORTS,
  type InventoryPublishInput,
  PROPERTY_TYPE_CATEGORY,
  RENTABLE_TYPES,
  publicationDecision,
  slugify,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { ModulesService } from '../../core/features/modules.service';
import type { RequestUser } from '../../common/decorators';
import { SettingsService } from '../../core/settings/settings.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import type { InventoryFilterQuery } from './inventory.dto';

const include = {
  contacts: true,
  publishedListing: {
    select: { id: true, slug: true, title: true, status: true, purpose: true, reviewRequiredRole: true, rejectionReason: true, updatedAt: true },
  },
  sourceEntry: { select: { id: true, rawText: true, pageNo: true, bbox: true, batch: { select: { id: true, sourceType: true, fileName: true } } } },
  assignedTo: { select: { id: true, name: true, phone: true, email: true, role: true, avatarUrl: true } },
  createdBy: { select: { id: true, name: true } },
} as const;
export function ledgerJson<T extends Record<string, any>>(item: T) {
  const result: Record<string, any> = { ...item };
  for (const key of ['monthlyRent', 'totalSalePrice', 'ratePerArea', 'area', 'minBudget', 'maxBudget', 'minArea', 'maxArea', 'price', 'ratePerSqft'])
    if (result[key] != null) result[key] = Number(result[key]);
  return result;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly modules: ModulesService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}
  orgId(user: RequestUser, requested?: string, required = true) {
    const id = user.role === 'SUPER_ADMIN' ? requested : user.orgId;
    if (!id && (required || user.role !== 'SUPER_ADMIN')) throw new ForbiddenException('Organization required');
    return id || undefined;
  }
  private scope(user: RequestUser, requested?: string): Prisma.InventoryItemWhereInput {
    const base: Prisma.InventoryItemWhereInput = { organizationId: this.orgId(user, requested, false), deletedAt: null };
    if (user.role === 'BROKER_AGENT') {
      base.OR = [{ createdById: user.id }, { assignedToId: user.id }];
    }
    return base;
  }
  async findAll(q: InventoryFilterQuery, user: RequestUser) {
    const where: Prisma.InventoryItemWhereInput = {
      organizationId: this.orgId(user, q.organizationId, false),
      deletedAt: null,
    };
    const and: Prisma.InventoryItemWhereInput[] = [];
    if (q.review === 'publication')
      and.push({ publishedListing: { is: { status: 'PENDING_REVIEW', ...(user.role === 'BROKER_ADMIN' ? { reviewRequiredRole: 'BROKER_ADMIN' } : {}) } } });
    if (user.role === 'BROKER_AGENT') {
      and.push({ OR: [{ createdById: user.id }, { assignedToId: user.id }] });
    } else {
      if (q.onlyMine === 'true') {
        and.push({ OR: [{ createdById: user.id }, { assignedToId: user.id }] });
      }
      if (q.assignedToId) {
        and.push({ assignedToId: q.assignedToId });
      }
    }
    if (q.sector) where.sector = { equals: q.sector, mode: 'insensitive' };
    if (q.houseNo) where.houseNo = { contains: q.houseNo, mode: 'insensitive' };
    for (const key of ['bhk', 'status', 'purpose', 'propertyType', 'category', 'furnishing', 'roomKind', 'availability', 'sourceType'] as const)
      if (q[key] != null) (where as any)[key] = q[key];
    if (q.search)
      and.push({
        OR: ['houseNo', 'sector', 'ownerName', 'ownerPhone', 'notes', 'address', 'unitLabel'].map((key) => ({
          [key]: { contains: q.search, mode: 'insensitive' },
        })),
      });
    const csv = (value: string) =>
      value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 100);
    if (q.localities) and.push({ sector: { in: csv(q.localities), mode: 'insensitive' } });
    if (q.propertyTypes) and.push({ propertyType: { in: csv(q.propertyTypes) } });
    if (q.roomKinds) and.push({ roomKind: { in: csv(q.roomKinds) } });
    if (q.floor) where.floor = { equals: q.floor, mode: 'insensitive' };
    if (q.verificationStatus) where.verificationStatus = q.verificationStatus;
    if (q.hasPhotos) and.push({ photoUrls: { isEmpty: q.hasPhotos === 'false' } });
    if (q.hasVideos) and.push({ videoUrls: { isEmpty: q.hasVideos === 'false' } });
    if (q.amenities) and.push({ amenities: { hasEvery: csv(q.amenities) } });
    if (q.minRate != null || q.maxRate != null)
      where.ratePerSqft = { ...(q.minRate != null ? { gte: q.minRate } : {}), ...(q.maxRate != null ? { lte: q.maxRate } : {}) };
    if (q.detailFilters) {
      let details: Record<string, unknown>;
      try {
        details = JSON.parse(q.detailFilters);
      } catch {
        throw new BadRequestException('Invalid property filters');
      }
      if (!details || Array.isArray(details) || typeof details !== 'object') throw new BadRequestException('Invalid property filters');
      for (const [key, value] of Object.entries(details)) {
        const field = PROPERTY_FIELDS.find((f) => f.key === key);
        if (!field) throw new BadRequestException(`Unknown property filter: ${key}`);
        if (value == null || value === '') continue;
        if (field.kind === 'number') {
          const range = value as { min?: number; max?: number };
          if (!range || typeof range !== 'object' || Object.keys(range).some((k) => !['min', 'max'].includes(k)))
            throw new BadRequestException('Invalid numeric range');
          for (const [bound, amount] of Object.entries(range)) {
            if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < (field.min ?? 0) || amount > (field.max ?? 1e13))
              throw new BadRequestException('Invalid numeric filter');
            and.push({ details: bound === 'min' ? { path: [key], gte: amount } : { path: [key], lte: amount } });
          }
        } else if (field.kind === 'text') {
          if (typeof value !== 'string' || value.length > 200) throw new BadRequestException('Invalid text filter');
          and.push({ details: { path: [key], string_contains: value, mode: 'insensitive' } });
        } else {
          const values = Array.isArray(value) ? value : [value];
          if (values.length > 100) throw new BadRequestException('Too many filter choices');
          for (const v of values) if (!propertyDetailsSchema.safeParse({ [key]: v }).success) throw new BadRequestException('Invalid property filter choice');
          and.push({ OR: values.map((v) => ({ details: { path: [key], equals: v as Prisma.InputJsonValue } })) });
        }
      }
    }
    if (q.minBudget != null || q.maxBudget != null) {
      const range = { ...(q.minBudget != null ? { gte: q.minBudget } : {}), ...(q.maxBudget != null ? { lte: q.maxBudget } : {}) };
      and.push({
        OR: [
          { purpose: 'RENT', monthlyRent: range },
          { purpose: 'SALE', totalSalePrice: range },
        ],
      });
    }
    if (q.minArea != null || q.maxArea != null) {
      if (!q.areaUnit) throw new BadRequestException('Area unit required');
      const units = ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'];
      and.push({
        OR: units.map((unit) => ({
          areaUnit: unit,
          area: {
            ...(q.minArea != null ? { gte: areaSqft(q.minArea, q.areaUnit!)! / areaSqft(1, unit)! } : {}),
            ...(q.maxArea != null ? { lte: areaSqft(q.maxArea, q.areaUnit!)! / areaSqft(1, unit)! } : {}),
          },
        })),
      });
    } else if (q.areaUnit) where.areaUnit = q.areaUnit;
    if (and.length) where.AND = and;
    if (q.dateFrom || q.dateTo) where.date = { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) };
    if (q.sort && !INVENTORY_SORTS.some((s) => s.value === q.sort)) throw new BadRequestException('Invalid sort');
    const [sortField, sortDirection] = q.sort?.split(':') ?? [];
    const order = sortField ?? (q.sortBy === 'rent' ? 'monthlyRent' : q.sortBy);
    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include,
        orderBy: [
          {
            [order]: ['price', 'ratePerSqft', 'monthlyRent', 'totalSalePrice'].includes(order)
              ? { sort: sortDirection ?? q.sortOrder, nulls: 'last' }
              : (sortDirection ?? q.sortOrder),
          },
          { id: 'asc' },
        ],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    // Fast lead matching calculation for items
    let requirements: { purpose: string | null; bedrooms: number[]; minBudget: number | null; maxBudget: number | null }[] = [];
    const orgIdForLeads = (where.organizationId as string) || (items[0]?.organizationId as string | undefined);
    if (orgIdForLeads && items.length > 0) {
      try {
        requirements = await this.prisma.leadRequirement.findMany({
          where: {
            lead: {
              organizationId: orgIdForLeads,
              ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
              stage: { in: ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION'] },
              deletedAt: null,
            },
          },
          select: {
            purpose: true,
            bedrooms: true,
            minBudget: true,
            maxBudget: true,
          },
        });
      } catch {
        requirements = [];
      }
    }

    const itemsWithMatches = items.map((r) => {
      const item = ledgerJson(r);
      if (requirements.length > 0) {
        const itemPrice = item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : item.totalSalePrice;
        let matchCount = 0;
        for (const req of requirements) {
          if (req.purpose && item.purpose && req.purpose !== item.purpose) continue;
          if (req.bedrooms && req.bedrooms.length > 0 && item.bhk && !req.bedrooms.includes(item.bhk)) continue;
          if (itemPrice != null) {
            if (req.minBudget != null && itemPrice < req.minBudget) continue;
            if (req.maxBudget != null && itemPrice > req.maxBudget) continue;
          }
          matchCount++;
        }
        item.matchingLeadsCount = matchCount;
      } else {
        item.matchingLeadsCount = 0;
      }
      return item;
    });

    return { items: itemsWithMatches, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  }
  async get(id: string, user: RequestUser) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { ...this.scope(user), id }, include });
    if (!item) throw new NotFoundException('Inventory item not found');
    return ledgerJson(item);
  }
  async getStats(user: RequestUser, organizationId?: string) {
    const where = this.scope(user, organizationId);
    const [total, statuses, availability, reviewed, published] = await Promise.all([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.groupBy({ by: ['status'], where, _count: { id: true } }),
      this.prisma.inventoryItem.groupBy({ by: ['availability'], where, _count: { id: true } }),
      this.prisma.inventoryItem.count({ where: { ...where, verificationStatus: 'VERIFIED' } }),
      this.prisma.inventoryItem.count({
        where: { ...where, status: 'ACTIVE', availability: 'AVAILABLE', publishedListing: { is: { status: 'ACTIVE', deletedAt: null } } },
      }),
    ]);
    const count = (state: string) => statuses.find((x) => x.status === state)?._count.id ?? 0;
    const avail = (state: string) => availability.find((x) => x.availability === state)?._count.id ?? 0;
    return {
      total,
      draft: count('DRAFT'),
      active: count('ACTIVE'),
      inactive: count('INACTIVE'),
      rented: avail('RENTED'),
      sold: avail('SOLD'),
      available: avail('AVAILABLE'),
      unknown: avail('UNKNOWN'),
      reviewed,
      published,
    };
  }
  async getSectors(user: RequestUser, organizationId?: string) {
    const rows = await this.prisma.inventoryItem.groupBy({
      by: ['sector'],
      where: { ...this.scope(user, organizationId), sector: { not: null } },
      _count: { id: true },
      orderBy: { sector: 'asc' },
    });
    return rows.map((r) => ({ sector: r.sector, count: r._count.id }));
  }
  private fields(input: InventoryInput, previous?: any) {
    const { contacts: _contacts, organizationId: _org, expectedRevision: _revision, details: _details, ...data } = input;
    const monthly = input.monthlyRent !== undefined ? input.monthlyRent : input.rent;
    const primaryPhone = input.ownerPhone === undefined ? undefined : input.ownerPhone ? normalizeIndianPhone(input.ownerPhone) : null;
    if (input.ownerPhone && !primaryPhone) throw new BadRequestException('Invalid Indian phone number');
    const effective = { ...previous, ...data, ...(monthly !== undefined ? { monthlyRent: monthly, rent: monthly } : {}) };
    const details = input.details ? { ...(previous?.details ?? {}), ...input.details } : undefined;
    const price = effective.purpose === 'RENT' ? (effective.monthlyRent ?? effective.rent) : effective.purpose === 'SALE' ? effective.totalSalePrice : null;
    const size = effective.area != null && effective.areaUnit ? areaSqft(Number(effective.area), effective.areaUnit) : null;
    const rate =
      effective.ratePerArea != null && effective.rateAreaUnit
        ? Number(effective.ratePerArea) / areaSqft(1, effective.rateAreaUnit)!
        : size && price != null
          ? Number(price) / size
          : null;
    const effectiveAssignedToId = data.assignedToId === '' ? null : data.assignedToId;
    return {
      ...data,
      ...(data.assignedToId !== undefined ? { assignedToId: effectiveAssignedToId } : {}),
      price: price == null ? null : Number(price),
      ratePerSqft: rate,
      ...(details ? { details: details as Prisma.InputJsonValue } : {}),
      ownerPhone: primaryPhone,
      ...(monthly !== undefined ? { monthlyRent: monthly, rent: monthly } : {}),
      ...(input.date ? { date: new Date(input.date) } : {}),
      ...(input.availability ? { availabilityAt: new Date() } : {}),
    };
  }
  private contacts(input: InventoryInput) {
    return (
      input.contacts ??
      (input.ownerName || input.ownerPhone
        ? [{ name: input.ownerName ?? null, phone: input.ownerPhone ? normalizeIndianPhone(input.ownerPhone) : null, role: 'OWNER' }]
        : [])
    );
  }
  async create(input: InventoryInput, user: RequestUser, transaction?: Prisma.TransactionClient) {
    const db = transaction ?? this.prisma;
    const organizationId = this.orgId(user, input.organizationId)!;
    if (input.clientMutationId) {
      const existing = await db.inventoryItem.findUnique({
        where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
        include,
      });
      if (existing) {
        if (user.role === 'BROKER_AGENT' && existing.createdById !== user.id && existing.assignedToId !== user.id)
          throw new ForbiddenException('Inventory belongs to another member');
        return ledgerJson(existing);
      }
    }
    if (!input.sector && !input.address) throw new BadRequestException('Sector/locality or address required');
    const rawAssigned = input.assignedToId === '' ? null : input.assignedToId;
    const assignedToId = user.role === 'BROKER_AGENT' ? user.id : user.role === 'SUPER_ADMIN' && rawAssigned == null ? null : rawAssigned || user.id;
    if (assignedToId) {
      const assignee = await db.user.findFirst({
        where: { id: assignedToId, organizationId },
      });
      if (!assignee) throw new BadRequestException('Assigned user not found in organization');
    }
    const creation = {
      data: {
        ...this.fields(input),
        organizationId,
        createdById: user.id,
        assignedToId,
        verificationStatus: input.verificationStatus ?? 'VERIFIED',
        contacts: { create: this.contacts(input) },
      },
      include,
    };
    const item = input.clientMutationId
      ? await db.inventoryItem.upsert({
          where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
          create: creation.data,
          update: {},
          include,
        })
      : await db.inventoryItem.create(creation);
    if (user.role === 'BROKER_AGENT' && item.createdById !== user.id && item.assignedToId !== user.id)
      throw new ForbiddenException('Inventory belongs to another member');
    if (!transaction) await this.audit.log(user, 'inventory.create', 'InventoryItem', item.id);
    return ledgerJson(item);
  }
  async update(id: string, input: InventoryInput, user: RequestUser) {
    if (input.assignedToId !== undefined) {
      if (input.assignedToId && input.assignedToId !== '') {
        if (user.role === 'BROKER_AGENT' && input.assignedToId !== user.id) {
          throw new ForbiddenException('Only Broker Admins can re-assign properties');
        }
        const organizationId = this.orgId(user, input.organizationId, false);
        const assignee = await this.prisma.user.findFirst({
          where: { id: input.assignedToId, ...(organizationId ? { organizationId } : {}) },
        });
        if (!assignee) throw new BadRequestException('Assigned user not found in organization');
      } else if (user.role === 'BROKER_AGENT') {
        throw new ForbiddenException('Only Broker Admins can unassign properties');
      }
    }
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!current) throw new NotFoundException('Inventory item not found');
      const changed = await tx.inventoryItem.updateMany({
        where: { id, deletedAt: null, revision: input.expectedRevision ?? current.revision },
        data: { ...this.fields(input, current), revision: { increment: 1 } },
      });
      if (!changed.count) throw new ConflictException('Property changed. Reload before saving.');
      if (input.contacts !== undefined) {
        await tx.inventoryContact.deleteMany({ where: { inventoryId: id } });
        if (input.contacts.length) await tx.inventoryContact.createMany({ data: input.contacts.map((c) => ({ ...c, inventoryId: id })) });
      } else if (input.ownerPhone !== undefined || input.ownerName !== undefined) {
        const owner = await tx.inventoryContact.findFirst({ where: { inventoryId: id, role: 'OWNER' } });
        const contact = {
          name: input.ownerName !== undefined ? input.ownerName : current.ownerName,
          phone: input.ownerPhone !== undefined ? (input.ownerPhone ? normalizeIndianPhone(input.ownerPhone) : null) : current.ownerPhone,
          role: 'OWNER',
        };
        if (owner) await tx.inventoryContact.update({ where: { id: owner.id }, data: contact });
        else if (contact.name || contact.phone) await tx.inventoryContact.create({ data: { ...contact, inventoryId: id } });
      }
      const updated = await tx.inventoryItem.findUniqueOrThrow({ where: { id }, include });
      if (updated.availability !== 'AVAILABLE' || updated.status !== 'ACTIVE' || !['RENT', 'SALE'].includes(updated.purpose || ''))
        await this.withdrawLinked(tx, current);
      else if (Object.keys(input).some((key) => !['expectedRevision', 'clientMutationId'].includes(key))) await this.withdrawLinked(tx, current);
      return current.publishedListingId ? tx.inventoryItem.findUniqueOrThrow({ where: { id }, include }) : updated;
    });
    await this.audit.log(user, 'inventory.update', 'InventoryItem', id, {
      fields: Object.keys(input).filter((k) => k !== 'contacts'),
      revision: item.revision,
    });
    return ledgerJson(item);
  }
  async delete(id: string, user: RequestUser) {
    await this.get(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const item = await tx.inventoryItem.update({ where: { id }, data: { deletedAt: new Date(), revision: { increment: 1 } } });
      await this.withdrawLinked(tx, item);
    });
    await this.audit.log(user, 'inventory.archive', 'InventoryItem', id);
    return { ok: true };
  }
  async publishToListing(id: string, input: InventoryPublishInput, user: RequestUser) {
    await this.modules.assertPath('/listings', user.role);
    const app = await this.settings.getAppConfig();
    const hash = createHash('sha256')
      .update(JSON.stringify({ actor: user.id, role: user.role, input }))
      .digest('hex');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const item = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!item) throw new NotFoundException('Inventory item not found');
      const existing = item.publishedListingId ? await tx.listing.findUnique({ where: { id: item.publishedListingId } }) : null;
      if (existing && existing.organizationId !== item.organizationId) throw new ForbiddenException('Listing ownership mismatch');
      if (existing && item.publicationHash === hash && item.revision === input.expectedRevision + 1)
        return {
          id: existing.id,
          slug: existing.slug,
          status: existing.status,
          reviewRequiredRole: existing.reviewRequiredRole,
          organizationId: item.organizationId,
          duplicate: true,
        };
      if (item.revision !== input.expectedRevision) throw new ConflictException('Property changed. Reload the public preview.');
      if (item.availability !== 'AVAILABLE' || item.status !== 'ACTIVE' || !['RENT', 'SALE'].includes(item.purpose || ''))
        throw new BadRequestException('Confirm an active Rent/Sale property is available before publishing.');
      if (input.purpose && input.purpose !== item.purpose) throw new BadRequestException('Public purpose must match inventory');
      const purpose = item.purpose as 'RENT' | 'SALE';
      if (purpose === 'RENT' && !RENTABLE_TYPES.includes(input.propertyType)) throw new BadRequestException('Property type is not rentable');
      const locality = await tx.locality.findFirst({ where: { id: input.localityId, isActive: true } });
      if (!locality) throw new BadRequestException('Choose a real locality.');
      for (const photo of input.photos)
        if (/\/(imports|private|kyc|scan|chat)(\/|$)/i.test(new URL(photo.url).pathname))
          throw new BadRequestException('Private source images cannot be published.');
      if (!Object.values(PropertyType).includes(input.propertyType as PropertyType)) throw new BadRequestException('Unsupported property type');
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${item.organizationId} FOR SHARE`;
      const org = await tx.organization.findUniqueOrThrow({ where: { id: item.organizationId } });
      if (org.status !== 'ACTIVE') throw new ForbiddenException('Firm is not active');
      const decision = publicationDecision(user.role, org.verification);
      const active = decision.status === 'ACTIVE';
      const reviewRequiredRole = decision.reviewRequiredRole;
      const { confirmedAvailable, publicPreviewAccepted, expectedRevision, photos, purpose: _purpose, ...publicFields } = input;
      const data = {
        ...publicFields,
        propertyType: input.propertyType as PropertyType,
        purpose,
        category: PROPERTY_TYPE_CATEGORY[input.propertyType],
        pricePerSqft: input.carpetArea ? input.price / input.carpetArea : null,
        status: active ? ('ACTIVE' as const) : ('PENDING_REVIEW' as const),
        reviewRequiredRole,
        coverUrl: photos[0]?.url ?? null,
        rejectionReason: null,
        moderationFlags: [],
        publishedAt: active ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
        expiresAt: active ? new Date(Date.now() + app.listing.expiryDays * 86400_000) : null,
      };
      const listing = existing
        ? await tx.listing.update({ where: { id: existing.id }, data })
        : await tx.listing.create({
            data: {
              ...data,
              slug: slugify(input.title).slice(0, 65) + '-' + id,
              organizationId: item.organizationId,
              postedById: user.id,
              postedByType: 'BROKER',
              preferredTenants: [],
            },
          });
      await tx.listingMedia.deleteMany({ where: { listingId: listing.id } });
      if (photos.length)
        await tx.listingMedia.createMany({
          data: photos.map((photo, sortOrder) => ({ listingId: listing.id, ...photo, kind: photo.kind ?? 'PHOTO', sortOrder })),
        });
      await tx.inventoryItem.update({
        where: { id },
        data: { publishedListingId: listing.id, isPublished: active, publicationHash: hash, revision: { increment: 1 } },
      });
      return { id: listing.id, slug: listing.slug, status: listing.status, reviewRequiredRole, organizationId: item.organizationId, duplicate: false };
    });
    if (!result.duplicate) {
      await this.audit.log(user, result.status === 'ACTIVE' ? 'inventory.publish' : 'inventory.submit_public_listing', 'Listing', result.id, {
        inventoryId: id,
        reviewRequiredRole: result.reviewRequiredRole,
      });
      if (result.status === 'ACTIVE') this.events.emit('listing.published', { listingId: result.id });
      else {
        const reviewers = await this.prisma.user.findMany({
          where: {
            role: result.reviewRequiredRole as 'BROKER_ADMIN' | 'SUPER_ADMIN',
            status: 'ACTIVE',
            deletedAt: null,
            ...(result.reviewRequiredRole === 'BROKER_ADMIN' ? { organizationId: result.organizationId } : {}),
          },
          select: { id: true },
        });
        await this.notifications
          .notify(
            reviewers.map((x) => x.id),
            {
              kind: 'MODERATION',
              title: 'Property publication review',
              body: input.title,
              link: result.reviewRequiredRole === 'BROKER_ADMIN' ? '/broker/inventory?review=publication' : '/admin/moderation',
              data: { listingId: result.id },
              push: false,
            },
          )
          .catch(() => undefined);
      }
    }
    return result;
  }
  async reviewPublication(id: string, body: { action: 'approve' | 'reject'; reason?: string; expectedUpdatedAt: string }, user: RequestUser) {
    if (!['SUPER_ADMIN', 'BROKER_ADMIN'].includes(user.role)) throw new ForbiddenException('Admin review required');
    if (body.action === 'reject' && !body.reason?.trim()) throw new BadRequestException('Rejection reason required');
    const app = await this.settings.getAppConfig();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id=${id} FOR UPDATE`;
      const item = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!item?.publishedListingId) throw new NotFoundException('Publication not found');
      const listing = await tx.listing.findUniqueOrThrow({ where: { id: item.publishedListingId } });
      if (listing.organizationId !== item.organizationId) throw new ForbiddenException('Listing ownership mismatch');
      if (listing.status !== 'PENDING_REVIEW' || listing.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime())
        throw new ConflictException('Publication changed; reload review');
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${item.organizationId} FOR SHARE`;
      const org = await tx.organization.findUniqueOrThrow({ where: { id: item.organizationId } });
      if (user.role === 'BROKER_ADMIN' && (org.verification !== 'VERIFIED' || listing.reviewRequiredRole !== 'BROKER_ADMIN'))
        throw new ForbiddenException('Super Admin approval required');
      if (
        body.action === 'approve' &&
        (org.status !== 'ACTIVE' || item.status !== 'ACTIVE' || item.availability !== 'AVAILABLE' || item.purpose !== listing.purpose)
      )
        throw new BadRequestException('Property is no longer confirmed available for this purpose');
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data:
          body.action === 'approve'
            ? {
                status: 'ACTIVE',
                reviewRequiredRole: null,
                rejectionReason: null,
                publishedAt: listing.publishedAt ?? new Date(),
                expiresAt: new Date(Date.now() + app.listing.expiryDays * 86400_000),
              }
            : { status: 'REJECTED', rejectionReason: body.reason, reviewRequiredRole: null },
      });
      await tx.inventoryItem.update({ where: { id }, data: { isPublished: body.action === 'approve', revision: { increment: 1 } } });
      return updated;
    });
    await this.audit.log(user, 'inventory.publication.' + body.action, 'Listing', result.id, { inventoryId: id });
    if (result.status === 'ACTIVE') this.events.emit('listing.published', { listingId: result.id });
    await this.notifications
      .notify(result.postedById, {
        kind: body.action === 'approve' ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
        title: body.action === 'approve' ? 'Property is live' : 'Publication needs changes',
        body: body.reason || result.title,
        link: '/broker/inventory?item=' + id,
        push: false,
      })
      .catch(() => undefined);
    return { id: result.id, status: result.status, reviewRequiredRole: result.reviewRequiredRole };
  }
  async withdrawPublication(id: string, user: RequestUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id=${id} FOR UPDATE`;
      const item = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!item) throw new NotFoundException('Inventory item not found');
      await this.withdrawLinked(tx, item);
      await tx.inventoryItem.update({ where: { id }, data: { publicationHash: null, revision: { increment: 1 } } });
    });
    await this.audit.log(user, 'inventory.publication.withdraw', 'InventoryItem', id);
    return { ok: true };
  }
  async publicationQueue(user: RequestUser, page: number) {
    if (!['SUPER_ADMIN', 'BROKER_ADMIN'].includes(user.role)) throw new ForbiddenException('Admin review required');
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      status: 'PENDING_REVIEW',
      ...(user.role === 'BROKER_ADMIN' ? { organizationId: this.orgId(user), reviewRequiredRole: 'BROKER_ADMIN' } : { organizationId: { not: null } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * 10,
        take: 10,
        select: { id: true, slug: true, title: true, purpose: true, status: true, reviewRequiredRole: true, rejectionReason: true, updatedAt: true },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / 10) };
  }
  async reviewListingPublication(id: string, body: { action: 'approve' | 'reject'; reason?: string; expectedUpdatedAt: string }, user: RequestUser) {
    if (!['SUPER_ADMIN', 'BROKER_ADMIN'].includes(user.role)) throw new ForbiddenException('Admin review required');
    const origin = await this.prisma.inventoryItem.findFirst({ where: { publishedListingId: id, ...this.scope(user) }, select: { id: true } });
    if (origin) return this.reviewPublication(origin.id, body, user);
    if (body.action === 'reject' && !body.reason?.trim()) throw new BadRequestException('Rejection reason required');
    const app = await this.settings.getAppConfig();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id=${id} FOR UPDATE`;
      const listing = await tx.listing.findFirst({
        where: { id, deletedAt: null, ...(user.role === 'BROKER_ADMIN' ? { organizationId: this.orgId(user) } : {}) },
      });
      if (!listing?.organizationId) throw new NotFoundException('Firm publication not found');
      if (await tx.inventoryItem.count({ where: { publishedListingId: id } })) throw new ConflictException('Open the inventory publication review');
      if (listing.status !== 'PENDING_REVIEW' || listing.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime())
        throw new ConflictException('Publication changed; reload review');
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${listing.organizationId} FOR SHARE`;
      const org = await tx.organization.findUniqueOrThrow({ where: { id: listing.organizationId } });
      if (user.role === 'BROKER_ADMIN' && (org.verification !== 'VERIFIED' || listing.reviewRequiredRole !== 'BROKER_ADMIN'))
        throw new ForbiddenException('Super Admin approval required');
      if (org.status !== 'ACTIVE') throw new ForbiddenException('Firm is not active');
      return tx.listing.update({
        where: { id },
        data:
          body.action === 'approve'
            ? {
                status: 'ACTIVE',
                reviewRequiredRole: null,
                rejectionReason: null,
                publishedAt: listing.publishedAt ?? new Date(),
                expiresAt: new Date(Date.now() + app.listing.expiryDays * 86400_000),
              }
            : { status: 'REJECTED', reviewRequiredRole: null, rejectionReason: body.reason },
      });
    });
    await this.audit.log(user, 'listing.publication.' + body.action, 'Listing', id);
    if (result.status === 'ACTIVE') this.events.emit('listing.published', { listingId: id });
    return { id: result.id, status: result.status };
  }
  private async withdrawLinked(tx: Prisma.TransactionClient, item: { publishedListingId: string | null }, status: string = 'ARCHIVED') {
    if (item.publishedListingId) {
      await tx.listing.updateMany({ where: { id: item.publishedListingId, deletedAt: null }, data: { status: status as any, reviewRequiredRole: null } });
      await tx.inventoryItem.updateMany({ where: { publishedListingId: item.publishedListingId }, data: { isPublished: false } });
    }
  }
  async bulkCreate(items: InventoryInput[], user: RequestUser) {
    // Validation happens on the complete batch before any write. Every insert is atomic.
    const orgId = this.orgId(user, items[0]?.organizationId)!;
    if (items.some((i) => !i.sector && !i.address)) throw new BadRequestException('Every item needs a locality/address');
    const data = items.map((i) => ({
      ...this.fields(i),
      organizationId: orgId,
      createdById: user.id,
      verificationStatus: i.verificationStatus ?? 'VERIFIED',
      contacts: { create: this.contacts(i) },
    }));
    await this.prisma.$transaction(data.map((d) => this.prisma.inventoryItem.create({ data: d })));
    await this.audit.log(user, 'inventory.bulk_create', 'Organization', orgId, { count: items.length });
    return { count: items.length };
  }
  async bulkUpdate(ids: string[], input: Pick<InventoryInput, 'status' | 'availability'>, user: RequestUser) {
    const unique = [...new Set(ids)];
    const count = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "InventoryItem" WHERE id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`);
      const items = await tx.inventoryItem.findMany({
        where: { ...this.scope(user), id: { in: unique } },
        select: { id: true, organizationId: true, publishedListingId: true },
      });
      if (items.length !== unique.length || new Set(items.map((i) => i.organizationId)).size !== 1)
        throw new ForbiddenException('Select properties from one authorized firm only');
      for (const item of items) await this.withdrawLinked(tx, item);
      return tx.inventoryItem.updateMany({
        where: { id: { in: unique }, organizationId: items[0].organizationId },
        data: { ...input, ...(input.availability ? { availabilityAt: new Date() } : {}), revision: { increment: 1 } },
      });
    });
    await this.audit.log(user, 'inventory.bulk_update', 'InventoryItem', unique.join(',').slice(0, 100), { count: count.count, ...input });
    return count;
  }
  async matching(requirement: BrokerRequirementInput, user: RequestUser) {
    await this.modules.assertPath('/inventory', user.role);
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        ...this.scope(user),
        status: { not: 'INACTIVE' },
        availability: { in: ['UNKNOWN', 'AVAILABLE'] },
        purpose: requirement.purpose ?? '__unknown__',
      },
      include,
    });
    const matches = rows
      .map((r) => {
        const item = ledgerJson(r);
        const match = ledgerMatch(requirement, item);
        return match ? { item, ...match } : null;
      })
      .filter((m) => m !== null);
    return { available: matches.filter((m) => m.availability === 'AVAILABLE'), unknown: matches.filter((m) => m.availability === 'UNKNOWN') };
  }
}
