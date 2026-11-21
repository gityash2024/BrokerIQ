import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { generateCsv } from '../../common/csv';
import { Prisma, PropertyType } from '@prisma/client';
import {
  inventoryInputSchema,
  inventoryUnitBatchRows,
  inventoryUnitConfigurationFields,
  type InventoryUnitBatch,
  ownerEditablePropertySchema,
  type OwnerCreatePropertyInput,
  type InventoryInput,
  type SurveyPhotoInput,
  type SurveyPhoneInput,
  type SurveyUnitsInput,
  type SurveyCallInput,
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
  inventoryDate,
  inventoryDateSchema,
  inventoryMonthLabel,
  inventoryRoomFolder,
  surveySectors,
  NAMED_INVENTORY_TYPES,
  missingInventoryFolderFields,
  readableValue,
  shareablePropertyPhotoUrls,
  type InventoryFolder,
  type InventoryFolders,
} from '@brokeriq/shared';
import { InventoryAccessService, activeInventoryGrant } from './inventory-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { ModulesService } from '../../core/features/modules.service';
import type { RequestUser } from '../../common/decorators';
import { SettingsService } from '../../core/settings/settings.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import type { InventoryFilterQuery } from './inventory.dto';

const pendingSurvey: Prisma.InventoryItemWhereInput = { sourceType: 'SURVEY', status: 'DRAFT' };

const include = {
  organization: { select: { id: true, name: true, slug: true } },
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
  if (result.agentCoverPhotoUrl && !result.photoUrls?.includes(result.agentCoverPhotoUrl)) result.agentCoverPhotoUrl = null;
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
    private readonly access: InventoryAccessService,
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
  private filterWhere(q: InventoryFilterQuery, user: RequestUser, today = inventoryDate()): Prisma.InventoryItemWhereInput {
    const where: Prisma.InventoryItemWhereInput = {
      organizationId: this.orgId(user, q.organizationId, false),
      deletedAt: null,
    };
    if (q.archived && q.archived !== 'exclude') {
      if (user.role === 'BROKER_AGENT') throw new ForbiddenException('Admin required for archived inventory');
      where.deletedAt = q.archived === 'only' ? { not: null } : undefined;
    }
    if (q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)) throw new BadRequestException('From date must precede through date');
    const and: Prisma.InventoryItemWhereInput[] = [];
    and.push(q.folderMode === 'SURVEY' ? pendingSurvey : { NOT: pendingSurvey });
    if (q.review === 'publication')
      and.push({ publishedListing: { is: { status: 'PENDING_REVIEW', ...(user.role === 'BROKER_ADMIN' ? { reviewRequiredRole: 'BROKER_ADMIN' } : {}) } } });
    if (user.role === 'BROKER_AGENT') {
      and.push(q.onlyMine === 'true' ? { OR: [{ createdById: user.id }, { assignedToId: user.id }] } : this.access.readScope(user));
    } else {
      if (q.onlyMine === 'true') {
        and.push({ OR: [{ createdById: user.id }, { assignedToId: user.id }] });
      }
      if (q.assignedToId) {
        and.push({ assignedToId: q.assignedToId });
      }
    }
    if (q.sector) where.sector = { equals: q.sector, mode: 'insensitive' };
    if (q.folderMode === 'SURVEY' && q.folderSector) and.push({ sector: q.folderSector === '__unset__' ? null : q.folderSector });
    if (q.houseNo) {
      where.houseNo = { contains: q.houseNo, mode: 'insensitive' };
      if (user.role === 'BROKER_AGENT')
        and.push({ OR: [{ createdById: user.id }, { assignedToId: user.id }, { detailAccess: { some: activeInventoryGrant(user.id) } }] });
    }
    for (const key of ['bhk', 'status', 'purpose', 'propertyType', 'category', 'furnishing', 'roomKind', 'availability', 'sourceType'] as const)
      if (q[key] != null) (where as any)[key] = q[key];
    if (q.search) {
      const search = {
        OR: [
          ...['houseNo', 'sector', 'ownerName', 'ownerPhone', 'notes', 'address', 'unitLabel'].map((key) => ({
            [key]: { contains: q.search, mode: 'insensitive' as const },
          })),
          { contacts: { some: { phone: { contains: q.search } } } },
        ],
      };
      and.push(
        user.role === 'BROKER_AGENT'
          ? {
              OR: [
                {
                  AND: [{ OR: [{ createdById: user.id }, { assignedToId: user.id }, { detailAccess: { some: activeInventoryGrant(user.id) } }] }, search],
                },
                // Locked records can be searched by their public configuration, never private addresses or contact numbers.
                { OR: ['propertyType', 'furnishing'].map((key) => ({ [key]: { contains: q.search, mode: 'insensitive' } })) },
                { sector: { equals: q.search, mode: 'insensitive' } },
              ],
            }
          : search,
      );
    }
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
          if (user.role === 'BROKER_AGENT' && !['possessionDate', 'availableFrom'].includes(key))
            and.push({ OR: [{ createdById: user.id }, { assignedToId: user.id }, { detailAccess: { some: activeInventoryGrant(user.id) } }] });
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
    // Use the same completeness fields as the editor so folder counts and paginated records agree.
    const complete: Prisma.InventoryItemWhereInput = {
      sector: { not: '' },
      category: { not: '' },
      propertyType: { not: '' },
      area: { gt: 0 },
      areaUnit: { not: '' },
      AND: [
        { OR: [{ address: { not: '' } }, { houseNo: { not: '' } }] },
        { OR: [{ category: { not: 'RESIDENTIAL' } }, { roomKind: { in: ['RK', 'STUDIO'] } }, { roomKind: 'BHK', bhk: { gt: 0 } }] },
        { OR: [{ category: { notIn: ['RESIDENTIAL', 'COMMERCIAL'] } }, { furnishing: { not: '' } }] },
        { OR: [{ propertyType: { not: 'BUILDER_FLOOR' } }, { floor: { not: '' } }, { unitLabel: { not: '' } }] },
        {
          OR: [
            { purpose: 'RENT', OR: [{ monthlyRent: { gt: 0 } }, { monthlyRent: null, rent: { gt: 0 } }] },
            { purpose: 'SALE', totalSalePrice: { gt: 0 } },
          ],
        },
      ],
    };
    const placed: Prisma.InventoryItemWhereInput = {
      directoryMonth: { not: null },
      status: 'ACTIVE',
      availability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
    };
    const rented: Prisma.InventoryItemWhereInput = { OR: [{ availability: 'RENTED' }, { status: 'RENTED' }] };
    if (q.folderMode === 'AVAILABLE') {
      and.push(placed, complete);
      if (q.currentInventory) {
        and.push({ directoryMonth: { lte: today.slice(0, 7) } });
      } else if (q.folderMonth) and.push({ directoryMonth: q.folderMonth });
      else if (q.folderYear) and.push({ directoryMonth: { startsWith: q.folderYear + '-' } });
      if (q.folderRoom && !q.folderRoom.startsWith('TYPE:'))
        and.push({ OR: [{ propertyType: null }, { propertyType: { notIn: ['PENTHOUSE', 'BUILDER_FLOOR', 'INDEPENDENT_HOUSE'] } }] });
      if (q.folderRoom === 'RK' || q.folderRoom === 'STUDIO') and.push({ roomKind: q.folderRoom });
      else if (q.folderRoom?.startsWith('BHK:')) and.push({ bhk: Number(q.folderRoom.slice(4)), OR: [{ roomKind: 'BHK' }, { roomKind: null }] });
      else if (q.folderRoom?.startsWith('TYPE:') && NAMED_INVENTORY_TYPES.some((type) => q.folderRoom === `TYPE:${type}`)) {
        and.push({ propertyType: q.folderRoom.slice(5) });
      } else if (q.folderRoom) {
        and.push({
          OR: [{ bhk: null, OR: [{ roomKind: null }, { roomKind: { notIn: ['RK', 'STUDIO'] } }] }, { roomKind: { notIn: ['BHK', 'RK', 'STUDIO'] } }],
        });
        and.push({ propertyType: q.folderRoom.startsWith('TYPE:') ? q.folderRoom.slice(5) : null });
      }
      if (q.folderFurnishing) and.push({ furnishing: q.folderFurnishing === 'OTHER' ? null : q.folderFurnishing });
    } else if (q.folderMode === 'RENTED') {
      and.push(rented, {
        OR: [
          { AND: [complete, { verificationStatus: 'VERIFIED' }] },
          { availability: 'RENTED', houseNo: { not: '' }, sector: { not: '' }, sourceEntry: { is: { reviewState: 'APPROVED' } } },
          { sourceType: 'SURVEY', availability: 'RENTED', houseNo: { not: '' }, sector: { not: '' } },
        ],
      });
      if (q.folderSector) and.push({ sector: q.folderSector === '__unset__' ? null : q.folderSector });
    } else if (q.folderMode === 'REVIEW') {
      and.push({
        OR: [{ directoryMonth: null }, { availability: { not: 'AVAILABLE' } }, { status: { not: 'ACTIVE' } }, { verificationStatus: { not: 'VERIFIED' } }],
      });
      and.push({ NOT: rented });
    }
    if (and.length) where.AND = and;
    if (q.dateFrom || q.dateTo) where.date = { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) };
    return where;
  }
  async getFolders(q: InventoryFilterQuery, user: RequestUser): Promise<InventoryFolders> {
    const today = inventoryDate();
    const current = today.slice(0, 7);
    const query = this.filterWhere(q, user, today);
    const root = this.filterWhere(
      { ...q, folderMode: 'AVAILABLE', folderYear: undefined, folderMonth: undefined, folderRoom: undefined, folderFurnishing: undefined },
      user,
      today,
    );
    const [months, photoCounts] = await Promise.all([
      this.prisma.inventoryItem.groupBy({ by: ['directoryMonth'], where: root, _count: { _all: true } }),
      this.countAvailablePhotos(q, user, query),
    ]);
    const years = [...new Set([current.slice(0, 4), ...months.flatMap((row) => row.directoryMonth?.slice(0, 4) ?? [])])].sort().reverse();
    const folders: InventoryFolder[] = [];
    if ((q.folderMode === 'RENTED' || q.folderMode === 'SURVEY') && !q.folderSector) {
      const rows = await this.prisma.inventoryItem.groupBy({ by: ['sector'], where: query, _count: { _all: true }, orderBy: { sector: 'asc' } });
      const sectors = new Map(rows.map(({ sector, _count }) => [sector, _count._all]));
      if (q.folderMode === 'SURVEY') {
        const locations = await this.prisma.locality.findMany({ where: { isActive: true }, select: { name: true } });
        for (const name of surveySectors(locations.map((item) => item.name))) if (!sectors.has(name)) sectors.set(name, 0);
      }
      folders.push(
        ...[...sectors]
          .map(([sector, count]) => ({ key: sector || '__unset__', label: sector || 'Sector not recorded', count }))
          .sort((a, b) => a.label.localeCompare(b.label, 'en-IN', { numeric: true })),
      );
    }
    if (q.folderMode === 'AVAILABLE' && !q.folderMonth && q.currentInventory) {
      folders.push({ key: current, label: inventoryMonthLabel(current), count: months.reduce((total, row) => total + row._count._all, 0) });
    } else if (q.folderMode === 'AVAILABLE' && !q.folderMonth) {
      const year = q.folderYear ?? current.slice(0, 4);
      const metadata = new Map(months.map((row) => [row.directoryMonth, row._count._all]));
      for (let month = 1; month <= 12; month += 1) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const label = inventoryMonthLabel(key);
        folders.push({ key, label, count: metadata.get(key) ?? 0 });
      }
    } else if (q.folderMode === 'AVAILABLE' && !q.folderRoom) {
      const rows = await this.prisma.inventoryItem.groupBy({ by: ['bhk', 'roomKind', 'propertyType'], where: query, _count: { _all: true } });
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = inventoryRoomFolder(row);
        counts.set(key, (counts.get(key) ?? 0) + row._count._all);
      }
      for (const [key, count] of [...counts].sort(([a], [b]) => a.localeCompare(b, 'en-IN', { numeric: true }))) {
        const label = key.startsWith('BHK:')
          ? `${key.slice(4)} BHK`
          : key === 'TYPE:BUILDER_FLOOR'
            ? 'Independent floor'
            : key === 'TYPE:APARTMENT'
              ? 'Flat / apartment'
              : key.startsWith('TYPE:')
                ? readableValue(key.slice(5))
                : key === 'OTHER'
                  ? 'Type not recorded'
                  : key === 'RK'
                    ? 'RK'
                    : 'Studio';
        folders.push({ key, label, count });
      }
    } else if (q.folderMode === 'AVAILABLE' && !q.folderFurnishing) {
      const rows = await this.prisma.inventoryItem.groupBy({ by: ['furnishing'], where: query, _count: { _all: true }, orderBy: { furnishing: 'asc' } });
      folders.push(
        ...rows.map(({ furnishing, _count }) => ({
          key: furnishing || 'OTHER',
          label: furnishing ? readableValue(furnishing) : 'Furnishing not recorded',
          count: _count._all,
        })),
      );
    }
    return { folders, years, ...(photoCounts && { photoCounts }) };
  }
  private async countAvailablePhotos(q: InventoryFilterQuery, user: RequestUser, where: Prisma.InventoryItemWhereInput) {
    if (q.folderMode !== 'AVAILABLE' || user.role === 'BROKER_AGENT') return;
    const [withPhotos, withoutPhotos] = await this.prisma.$transaction(
      [
        this.prisma.inventoryItem.count({ where: { AND: [where, { photoUrls: { isEmpty: false } }] } }),
        this.prisma.inventoryItem.count({ where: { AND: [where, { photoUrls: { isEmpty: true } }] } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { withPhotos, withoutPhotos };
  }
  private orderBy(q: InventoryFilterQuery): Prisma.InventoryItemOrderByWithRelationInput[] {
    if (q.sort && !INVENTORY_SORTS.some((s) => s.value === q.sort)) throw new BadRequestException('Invalid sort');
    const [sortField, sortDirection] = q.sort?.split(':') ?? [];
    const order = sortField ?? (q.sortBy === 'rent' ? 'monthlyRent' : q.sortBy);
    return [
      ...(q.folderMode === 'SURVEY' ? [{ surveyNoAnswerAt: { sort: 'asc', nulls: 'first' } } as const] : []),
      {
        [order]: ['price', 'ratePerSqft', 'monthlyRent', 'totalSalePrice'].includes(order)
          ? { sort: sortDirection ?? q.sortOrder, nulls: 'last' }
          : (sortDirection ?? q.sortOrder),
      },
      { id: 'asc' },
    ];
  }
  async findAll(q: InventoryFilterQuery, user: RequestUser) {
    const where = this.filterWhere(q, user);
    const [items, total, photoCounts] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include,
        orderBy: this.orderBy(q),
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
      this.countAvailablePhotos(q, user, where),
    ]);

    // Fast lead matching calculation for items
    let requirements: { lead: { organizationId: string }; purpose: string | null; bedrooms: number[]; minBudget: number | null; maxBudget: number | null }[] =
      [];
    const organizationIds = [...new Set(items.map((item) => item.organizationId))];
    if (organizationIds.length > 0) {
      try {
        requirements = await this.prisma.leadRequirement.findMany({
          where: {
            lead: {
              organizationId: { in: organizationIds },
              ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
              stage: { in: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'PHOTOS_SHARED', 'SITE_VISIT', 'SHORTLISTED', 'NEGOTIATION'] },
              deletedAt: null,
            },
          },
          select: {
            lead: { select: { organizationId: true } },
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
      if (requirements.length > 0 && q.folderMode !== 'SURVEY') {
        const itemPrice = item.purpose === 'RENT' ? (item.monthlyRent ?? item.rent) : item.totalSalePrice;
        let matchCount = 0;
        for (const req of requirements) {
          if (req.lead.organizationId !== r.organizationId) continue;
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

    return {
      items: await this.access.present(itemsWithMatches, user),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
      ...(photoCounts && { photoCounts }),
    };
  }
  /** All filtered rows in one consistent snapshot; never silently export only the UI page. */
  async exportCsv(q: InventoryFilterQuery, user: RequestUser, ids?: string[]) {
    const where = this.filterWhere(q, user);
    if (ids) where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { id: { in: ids } }];
    const rows = await this.prisma.$transaction(
      async (tx) => {
        const total = await tx.inventoryItem.count({ where });
        if (total > 50000) throw new BadRequestException('Export exceeds 50,000 records. Narrow the firm/date filters; no partial file was generated.');
        return tx.inventoryItem.findMany({
          where,
          orderBy: this.orderBy(q),
          select: {
            id: true,
            organization: { select: { name: true } },
            sector: true,
            houseNo: true,
            unitLabel: true,
            floor: true,
            purpose: true,
            propertyType: true,
            bhk: true,
            monthlyRent: true,
            totalSalePrice: true,
            area: true,
            areaUnit: true,
            availability: true,
            status: true,
            verificationStatus: true,
            date: true,
            deletedAt: true,
            sourceType: true,
            pageNo: true,
            assignedTo: { select: { name: true } },
            ownerName: true,
            ownerPhone: true,
            contacts: { select: { name: true, phone: true, role: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
    );
    await this.audit.log(user, 'inventory.export', 'InventoryItem', undefined, {
      count: rows.length,
      organizationId: q.organizationId ?? user.orgId ?? null,
      selected: !!ids,
    });
    return generateCsv(
      [
        'ID',
        'Firm',
        'Sector',
        'House',
        'Unit',
        'Floor',
        'Transaction',
        'Property type',
        'BHK',
        'Monthly rent INR',
        'Sale price INR',
        'Area',
        'Area unit',
        'Availability',
        'Status',
        'Verification',
        'Date',
        'Source',
        'Page',
        'Assignee',
        'Owner',
        'Owner phone',
        'Contacts',
        'Archived at',
      ],
      (await this.access.present(rows, user)).map((r) => [
        r.id,
        r.organization.name,
        r.sector,
        r.houseNo,
        r.unitLabel,
        r.floor,
        r.purpose,
        r.propertyType,
        r.bhk,
        r.monthlyRent?.toString(),
        r.totalSalePrice?.toString(),
        r.area?.toString(),
        r.areaUnit,
        r.availability,
        r.status,
        r.verificationStatus,
        r.date?.toISOString(),
        r.sourceType,
        r.pageNo,
        r.assignedTo?.name,
        r.ownerName,
        r.ownerPhone,
        r.contacts
          .map((c: { name?: string | null; phone?: string | null; role?: string | null }) => [c.name, c.phone, c.role].filter(Boolean).join(' · '))
          .join(' | '),
        r.deletedAt?.toISOString(),
      ]),
    );
  }
  async hierarchy(kind: 'organizations' | 'members', q: { search?: string; organizationId?: string; page: number }, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Super Admin required');
    const paging = { take: 30, skip: (q.page - 1) * 30, orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }] };
    if (kind === 'organizations') {
      const where = q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {};
      const [items, total] = await this.prisma.$transaction([
        this.prisma.organization.findMany({ where, ...paging, select: { id: true, name: true, status: true } }),
        this.prisma.organization.count({ where }),
      ]);
      return { items, total, page: q.page, totalPages: Math.ceil(total / 30) };
    }
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      organizationId: q.organizationId ?? { not: null },
      role: { in: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'] },
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        ...paging,
        select: { id: true, name: true, role: true, status: true, organization: { select: { id: true, name: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: q.page, totalPages: Math.ceil(total / 30) };
  }
  async get(id: string, user: RequestUser) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { organizationId: this.orgId(user, undefined, false), deletedAt: null, ...this.access.readScope(user), id },
      include,
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return (await this.access.present([ledgerJson(item)], user))[0];
  }
  countPendingSurvey(user: RequestUser) {
    return this.prisma.inventoryItem.count({ where: { ...this.scope(user), ...pendingSurvey } });
  }
  async getStats(user: RequestUser, organizationId?: string) {
    const where = { organizationId: this.orgId(user, organizationId, false), deletedAt: null, ...this.access.readScope(user), NOT: pendingSurvey };
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
      where: {
        organizationId: this.orgId(user, organizationId, false),
        deletedAt: null,
        ...this.access.readScope(user),
        sector: { not: null },
        NOT: pendingSurvey,
      },
      _count: { id: true },
      orderBy: { sector: 'asc' },
    });
    return rows
      .filter((r) => user.role !== 'BROKER_AGENT' || !/\b(?:house|plot|unit|flat|door)\s+(?:no\.?\s*)?\d/i.test(r.sector ?? ''))
      .map((r) => ({ sector: r.sector, count: r._count.id }));
  }
  private fields(input: InventoryInput, previous?: any, quickSurvey = false) {
    const { contacts: _contacts, organizationId: _org, expectedRevision: _revision, details: _details, survey: _survey, ...data } = input;
    const monthly = input.monthlyRent !== undefined ? input.monthlyRent : input.rent;
    const primaryPhone = input.ownerPhone === undefined ? undefined : input.ownerPhone ? normalizeIndianPhone(input.ownerPhone) : null;
    if (input.ownerPhone && !primaryPhone) throw new BadRequestException('Invalid Indian phone number');
    const effective = { ...previous, ...data, ...(monthly !== undefined ? { monthlyRent: monthly, rent: monthly } : {}) };
    const details = input.details ? { ...(previous?.details ?? {}), ...input.details } : undefined;
    const isSurvey = input.survey || (previous?.sourceType === 'SURVEY' && previous.status === 'DRAFT');
    if (isSurvey) {
      if (!quickSurvey) {
        if (!effective.houseNo?.trim() || !effective.sector?.trim()) throw new BadRequestException('Survey needs a sector and house number');
        const possession = (details ?? previous?.details)?.possessionDate;
        if (!inventoryDateSchema.safeParse(possession).success && !(input.availability === 'RENTED' && input.status === 'RENTED'))
          throw new BadRequestException('Choose the possession date for this survey');
      }
      if (!input.directoryMonth && !(input.availability === 'RENTED' && input.status === 'RENTED')) {
        data.status = 'DRAFT';
        data.availability = 'UNKNOWN';
        data.verificationStatus = 'NEEDS_REVIEW';
      }
    }
    const markRented = input.availability === 'RENTED' && input.status === 'RENTED';
    if (markRented && !isSurvey) {
      const missing = missingInventoryFolderFields(effective);
      if (missing.length) throw new BadRequestException('Fill these fields to mark the property Rented out: ' + missing.join(', '));
      data.verificationStatus = 'VERIFIED';
    }
    if (input.directoryMonth) {
      const missing = missingInventoryFolderFields(effective);
      if (missing.length) throw new BadRequestException(`Fill these fields to make the property Available: ${missing.join(', ')}`);
      data.status = 'ACTIVE';
      data.availability = 'AVAILABLE';
      data.verificationStatus = 'VERIFIED';
    } else if (
      (previous?.directoryMonth && effective.status === 'ACTIVE' && effective.availability === 'AVAILABLE') ||
      (previous?.verificationStatus === 'VERIFIED' && effective.availability === 'RENTED')
    ) {
      const priorMissing = new Set(missingInventoryFolderFields(previous));
      const removed = missingInventoryFolderFields(effective).filter((field) => !priorMissing.has(field));
      if (removed.length) throw new BadRequestException(`Verified properties need: ${removed.join(', ')}`);
    }
    const availability = data.availability ?? previous?.availability;
    if (input.availableSince !== undefined && availability !== 'AVAILABLE') delete data.availableSince;
    if (
      availability === 'AVAILABLE' &&
      previous?.availability === 'AVAILABLE' &&
      previous?.availableSince &&
      input.availableSince !== undefined &&
      input.availableSince !== previous.availableSince
    ) {
      throw new BadRequestException('Available since is fixed while this property is available.');
    }
    if (data.availability === 'AVAILABLE' && previous?.availability !== 'AVAILABLE' && input.availableSince == null) {
      const today = inventoryDate();
      const folderStart = input.directoryMonth ? `${input.directoryMonth}-01` : today;
      data.availableSince = folderStart > today ? folderStart : today;
    }
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
      ...(input.photoUrls && previous?.agentCoverPhotoUrl && !input.photoUrls.includes(previous.agentCoverPhotoUrl) ? { agentCoverPhotoUrl: null } : {}),
      ...(data.assignedToId !== undefined ? { assignedToId: effectiveAssignedToId } : {}),
      price: price == null ? null : Number(price),
      ratePerSqft: rate,
      ...(details ? { details: details as Prisma.InputJsonValue } : {}),
      ownerPhone: primaryPhone,
      ...(monthly !== undefined ? { monthlyRent: monthly, rent: monthly } : {}),
      ...(input.date ? { date: new Date(input.date) } : {}),
      ...(data.availability ? { availabilityAt: new Date() } : {}),
      ...(!input.directoryMonth &&
      previous?.directoryMonth &&
      (effective.availability !== 'AVAILABLE' || effective.status !== 'ACTIVE' || effective.verificationStatus !== 'VERIFIED')
        ? { directoryMonth: null }
        : {}),
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
  createSurveyPhoto(input: SurveyPhotoInput, user: RequestUser) {
    return this.createRecord(
      { sector: input.sector, photoUrls: [input.photoUrl], clientMutationId: input.clientMutationId, survey: true, purpose: 'RENT' },
      user,
      { quickSurvey: true },
    );
  }
  createSurveyPhone(input: SurveyPhoneInput, user: RequestUser) {
    return this.createRecord(
      {
        sector: input.sector,
        ...('phone' in input ? { ownerPhone: input.phone } : { contacts: input.contacts }),
        directionsUrl: input.directionsUrl,
        clientMutationId: input.clientMutationId,
        survey: true,
        purpose: 'RENT',
      },
      user,
      { quickSurvey: true },
    );
  }
  async createSurveyUnits({ clientMutationId, sector, directionsUrl, houseNo, contacts, units }: SurveyUnitsInput, user: RequestUser) {
    const rows = units.map((unit): InventoryInput => ({
      sector,
      directionsUrl,
      houseNo,
      contacts,
      survey: true,
      purpose: 'RENT',
      furnishing: unit.furnishing,
      floor: unit.floor || undefined,
      unitLabel: unit.unitLabel || undefined,
      photoUrls: unit.photoUrls,
      ...inventoryUnitConfigurationFields(unit.configuration),
      ...(unit.configuration ? { category: 'RESIDENTIAL' } : {}),
    }));
    return this.createUnitRecords(rows, clientMutationId, user, true);
  }
  createUnits(input: InventoryUnitBatch, user: RequestUser) {
    return this.createUnitRecords(inventoryUnitBatchRows(input.property, input.units), input.clientMutationId, user, false);
  }
  private async createUnitRecords(rows: InventoryInput[], clientMutationId: string, user: RequestUser, quickSurvey: boolean) {
    const organizationId = this.orgId(user, rows[0].organizationId)!;
    const mutationPrefix = clientMutationId + (quickSurvey ? '-unit-' : '-property-unit-');
    const lock = `${quickSurvey ? 'survey-batch' : 'property-batch'}:${organizationId}:${clientMutationId}`;
    const { items, created } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lock}))`;
        const previousCount = await tx.inventoryItem.count({ where: { organizationId, clientMutationId: { startsWith: mutationPrefix } } });
        if (previousCount && previousCount !== rows.length) throw new ConflictException('This group of units was already saved. Start a new capture.');
        const items = [];
        for (const [index, row] of rows.entries()) {
          try {
            items.push(await this.createRecord({ ...row, clientMutationId: mutationPrefix + index }, user, { transaction: tx, quickSurvey }));
          } catch (error) {
            if (!quickSurvey && error instanceof BadRequestException) throw new BadRequestException(`Unit ${index + 1}: ${error.message}`);
            throw error;
          }
        }
        return { items, created: previousCount === 0 };
      },
      { timeout: 30_000 },
    );
    if (created)
      await this.audit.log(user, quickSurvey ? 'inventory.survey.units' : 'inventory.create.units', 'InventoryItem', items[0].id, {
        ids: items.map(({ id }) => id),
      });
    return { items };
  }

  async recordSurveyNoAnswer(id: string, input: SurveyCallInput, user: RequestUser) {
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const item = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id, ...pendingSurvey }, select: { notes: true, revision: true } });
      if (!item) throw new NotFoundException('Pending Survey property not found');
      if (item.revision !== input.expectedRevision) throw new ConflictException('Property changed. Reload before logging a call.');
      const surveyNoAnswerAt = new Date();
      const text = 'Survey call: No answer - ' + surveyNoAnswerAt.toISOString() + (input.note ? ' · ' + input.note.replace(/[\r\n]+/g, ' ') : '');
      const notes = [item.notes, text].filter(Boolean).join('\n');
      if (notes.length > 20000) throw new BadRequestException('Property notes are full. Shorten the existing notes to log a call.');
      return tx.inventoryItem.update({ where: { id }, data: { notes, surveyNoAnswerAt, revision: { increment: 1 } }, include });
    });
    await this.audit.log(user, 'inventory.survey.no_answer', 'InventoryItem', id);
    return ledgerJson(item);
  }
  create(
    input: InventoryInput,
    user: RequestUser,
    transaction?: Prisma.TransactionClient,
    source?: { sourceEntryId: string; sourceUnitKey: string; sourceType: string },
  ) {
    return this.createRecord(input, user, { transaction, source });
  }
  async createOwnerDraft(input: OwnerCreatePropertyInput, user: RequestUser, transaction: Prisma.TransactionClient) {
    if (user.role !== 'PROPERTY_OWNER') throw new ForbiddenException('Property Owner role required');
    const payload = inventoryInputSchema.parse(input);
    // The signed-in owner's own profile supplies the contact for a new submission.
    const member = await transaction.user.findFirst({
      where: { id: user.id, organizationId: user.orgId, role: 'PROPERTY_OWNER', status: 'ACTIVE', deletedAt: null },
      select: { name: true, phone: true },
    });
    if (!member) throw new ForbiddenException('Active Property Owner membership required');
    return this.createRecord(
      {
        ...payload,
        ownerName: member.name,
        ownerPhone: member.phone ? normalizeIndianPhone(member.phone) : null,
        clientMutationId: 'owner:' + user.id + ':' + input.clientMutationId,
        status: 'DRAFT',
        availability: 'UNKNOWN',
        verificationStatus: 'NEEDS_REVIEW',
      },
      user,
      { transaction, ownerUserId: user.id },
    );
  }
  private async createRecord(
    input: InventoryInput,
    user: RequestUser,
    {
      transaction,
      source,
      quickSurvey = false,
      ownerUserId,
    }: {
      transaction?: Prisma.TransactionClient;
      source?: { sourceEntryId: string; sourceUnitKey: string; sourceType: string };
      quickSurvey?: boolean;
      ownerUserId?: string;
    },
  ) {
    const organizationId = this.orgId(user, input.organizationId)!;
    const persist = async (db: Prisma.TransactionClient) => {
      if (input.clientMutationId) {
        // Nested contact writes make an empty-update Prisma upsert race on first creation.
        // Every keyed reader/writer takes the same transaction-scoped lock before lookup.
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inventory-create:${organizationId}:${input.clientMutationId}`}))`;
        const existing = await db.inventoryItem.findUnique({
          where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
          include,
        });
        if (existing) {
          if (ownerUserId && (existing.ownerUserId !== ownerUserId || existing.deletedAt)) throw new NotFoundException('Property not found');
          if (user.role === 'BROKER_AGENT' && existing.createdById !== user.id && existing.assignedToId !== user.id)
            throw new ForbiddenException('Inventory belongs to another member');
          return { item: existing, created: false };
        }
      }
      if (!input.sector && !input.address && !quickSurvey) throw new BadRequestException('Sector/locality or address required');
      const rawAssigned = input.assignedToId === '' ? null : input.assignedToId;
      const assignedToId = ownerUserId
        ? null
        : user.role === 'BROKER_AGENT'
          ? user.id
          : user.role === 'SUPER_ADMIN' && rawAssigned == null
            ? null
            : rawAssigned || user.id;
      if (assignedToId) {
        const assignee = await db.user.findFirst({
          where: { id: assignedToId, organizationId, role: { in: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'] }, status: 'ACTIVE', deletedAt: null },
        });
        if (!assignee) throw new BadRequestException('Assigned user not found in organization');
      }
      const item = await db.inventoryItem.create({
        data: {
          ...this.fields(input, undefined, quickSurvey),
          ...source,
          ...(input.survey ? { sourceType: 'SURVEY' } : {}),
          organizationId,
          ownerUserId,
          createdById: user.id,
          assignedToId,
          verificationStatus: input.directoryMonth ? 'VERIFIED' : input.survey ? 'NEEDS_REVIEW' : (input.verificationStatus ?? 'VERIFIED'),
          contacts: { create: this.contacts(input) },
        },
        include,
      });
      return { item, created: true };
    };
    const result = transaction
      ? await persist(transaction)
      : input.clientMutationId
        ? await this.prisma.$transaction(persist, { timeout: 30_000 })
        : await persist(this.prisma);
    if (!transaction && result.created) await this.audit.log(user, 'inventory.create', 'InventoryItem', result.item.id);
    return ledgerJson(result.item);
  }
  async update(id: string, input: InventoryInput, user: RequestUser, ownerReview?: { id: string; accept: boolean }) {
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!current) throw new NotFoundException('Inventory item not found');
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision)
        throw new ConflictException('Property changed. Reload before saving.');
      if (ownerReview) {
        const proposal = await tx.inventoryOwnerReport.findFirst({
          where: { id: ownerReview.id, inventoryId: id, ownerId: current.ownerUserId ?? '', reviewState: 'PENDING' },
        });
        if (!proposal) throw new ConflictException('Owner changes have already been reviewed or replaced. Reload the property.');
        await tx.inventoryOwnerReport.update({
          where: { id: proposal.id },
          data: { reviewState: ownerReview.accept ? 'APPLIED' : 'DECLINED' },
        });
        if (ownerReview.accept && proposal.baseRevision !== current.revision)
          throw new ConflictException(
            'This property was edited after the owner submitted these details. Ask the owner to resubmit or enter the changes in the property editor.',
          );
        if (!ownerReview.accept) return tx.inventoryItem.update({ where: { id }, data: { revision: { increment: 1 } }, include });
        input = { ...input, ...ownerEditablePropertySchema.parse(proposal.propertyChanges) };
      }
      const effectiveInput = { ...current, ...input };
      if (ownerReview && (!effectiveInput.houseNo?.trim() || (!effectiveInput.sector?.trim() && !effectiveInput.address?.trim())))
        throw new BadRequestException('House number and sector or address are required');
      if (input.survey) throw new BadRequestException('Use Survey when adding a new property');
      if (input.organizationId && input.organizationId !== current.organizationId) throw new BadRequestException('Property firm cannot be changed');
      const affectsPublicListing = Object.keys(input).some(
        (key) => !['expectedRevision', 'clientMutationId', 'directionsUrl', 'directoryMonth', 'availableSince'].includes(key),
      );
      if (affectsPublicListing && user.delegatedActor && current.publishedListingId && !user.delegatedPermissions?.includes('inventory:publish')) {
        const listing = await tx.listing.findUnique({ where: { id: current.publishedListingId }, select: { status: true, deletedAt: true } });
        if (listing && !listing.deletedAt && ['ACTIVE', 'PENDING_REVIEW'].includes(listing.status)) {
          throw new ForbiddenException('Editing this property also requires permission to withdraw its listing');
        }
      }
      if (input.assignedToId !== undefined) {
        if (user.role === 'BROKER_AGENT' && input.assignedToId !== user.id) throw new ForbiddenException('Only Admins can re-assign properties');
        if (input.assignedToId) {
          const assignee = await tx.user.findFirst({
            where: {
              id: input.assignedToId,
              organizationId: current.organizationId,
              role: { in: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'] },
              ...(input.assignedToId !== current.assignedToId ? { status: 'ACTIVE', deletedAt: null } : {}),
            },
          });
          if (!assignee) throw new BadRequestException('Assigned user not found in property firm');
        }
      }
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
      if (affectsPublicListing) await this.withdrawLinked(tx, current);
      return current.publishedListingId ? tx.inventoryItem.findUniqueOrThrow({ where: { id }, include }) : updated;
    });
    await this.audit.log(user, ownerReview ? 'inventory.owner.review' : 'inventory.update', 'InventoryItem', id, {
      ...(ownerReview ? { ownerReview } : {}),
      fields: Object.keys(input).filter((k) => k !== 'contacts'),
      revision: item.revision,
    });
    return ledgerJson(item);
  }
  async addPhoto(id: string, url: string, user: RequestUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id, deletedAt: null }, include });
      if (!current) throw new NotFoundException('Inventory item not found');
      if (current.photoUrls.includes(url)) return { item: current, changed: false };
      if (current.photoUrls.length >= 50) throw new BadRequestException('A property can have up to 50 photos');
      const item = await tx.inventoryItem.update({
        where: { id },
        data: { photoUrls: { push: url }, revision: { increment: 1 } },
        include,
      });
      return { item, changed: true };
    });
    if (result.changed) await this.audit.log(user, 'inventory.photo.add', 'InventoryItem', id, { revision: result.item.revision });
    return ledgerJson(result.item);
  }
  async setAgentCoverPhoto(id: string, input: { url: string | null; expectedRevision: number }, user: RequestUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id, deletedAt: null }, include });
      if (!current) throw new NotFoundException('Inventory item not found');
      if (input.url !== null && (!current.photoUrls.includes(input.url) || !shareablePropertyPhotoUrls([input.url]).length))
        throw new BadRequestException('Choose an eligible photo already saved to this property');
      if (current.agentCoverPhotoUrl === input.url) return { item: current, changed: false };
      if (current.revision !== input.expectedRevision) throw new ConflictException('Property changed. Reload before saving.');
      const item = await tx.inventoryItem.update({
        where: { id },
        data: { agentCoverPhotoUrl: input.url, revision: { increment: 1 } },
        include,
      });
      return { item, changed: true };
    });
    if (result.changed)
      await this.audit.log(user, 'inventory.agent_cover.update', 'InventoryItem', id, { revision: result.item.revision, selected: input.url !== null });
    return ledgerJson(result.item);
  }
  async delete(id: string, user: RequestUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!current) throw new NotFoundException('Inventory item not found');
      const item = await tx.inventoryItem.update({ where: { id }, data: { deletedAt: new Date(), revision: { increment: 1 } } });
      await this.withdrawLinked(tx, item);
    });
    await this.audit.log(user, 'inventory.archive', 'InventoryItem', id);
    return { ok: true };
  }
  async restore(id: string, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'BROKER_ADMIN') throw new ForbiddenException('Admin required');
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), deletedAt: { not: null }, id } });
      if (!current) throw new NotFoundException('Archived property not found');
      // Restoration preserves private data but requires a new explicit public preview.
      return tx.inventoryItem.update({ where: { id }, data: { deletedAt: null, revision: { increment: 1 } }, include });
    });
    await this.audit.log(user, 'inventory.restore', 'InventoryItem', id);
    return ledgerJson(item);
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
        where: { ...this.scope(user), id: { in: unique }, NOT: pendingSurvey },
        select: { id: true, organizationId: true, publishedListingId: true },
      });
      if (items.length !== unique.length || new Set(items.map((i) => i.organizationId)).size !== 1)
        throw new ForbiddenException('Select properties from one authorized firm only');
      for (const item of items) await this.withdrawLinked(tx, item);
      return tx.inventoryItem.updateMany({
        where: { id: { in: unique }, organizationId: items[0].organizationId },
        data: {
          ...input,
          ...(input.availability ? { availabilityAt: new Date() } : {}),
          ...((input.availability && input.availability !== 'AVAILABLE') || (input.status && input.status !== 'ACTIVE') ? { directoryMonth: null } : {}),
          revision: { increment: 1 },
        },
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
        NOT: pendingSurvey,
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
