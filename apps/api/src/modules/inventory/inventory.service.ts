import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/decorators';
import type { CreateInventoryItemDto, InventoryFilterQuery, UpdateInventoryItemDto } from './inventory.dto';

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveOrgId(user: RequestUser, requestedOrgId?: string): string | undefined {
    if (user.role === 'SUPER_ADMIN') {
      return requestedOrgId || undefined;
    }
    if (!user.orgId) {
      throw new ForbiddenException('User organization does not exist');
    }
    return user.orgId;
  }

  async findAll(query: InventoryFilterQuery, user: RequestUser) {
    const orgId = this.resolveOrgId(user, query.organizationId);

    const where: Prisma.InventoryItemWhereInput = {};
    if (orgId) {
      where.organizationId = orgId;
    }

    if (query.sector) {
      where.sector = { contains: query.sector, mode: 'insensitive' };
    }

    if (query.houseNo) {
      where.houseNo = { contains: query.houseNo, mode: 'insensitive' };
    }

    if (query.bhk) {
      where.bhk = Number(query.bhk);
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (query.purpose) {
      where.purpose = query.purpose.toUpperCase();
    }

    if (query.furnishing) {
      where.furnishing = query.furnishing.toUpperCase();
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { houseNo: { contains: s, mode: 'insensitive' } },
        { sector: { contains: s, mode: 'insensitive' } },
        { ownerPhone: { contains: s, mode: 'insensitive' } },
        { ownerName: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 15));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    // Status counts for tabs
    const statusWhere: Prisma.InventoryItemWhereInput = orgId ? { organizationId: orgId } : {};
    const [allCount, draftCount, activeCount, rentedCount] = await Promise.all([
      this.prisma.inventoryItem.count({ where: statusWhere }),
      this.prisma.inventoryItem.count({ where: { ...statusWhere, status: 'DRAFT' } }),
      this.prisma.inventoryItem.count({ where: { ...statusWhere, status: 'ACTIVE' } }),
      this.prisma.inventoryItem.count({ where: { ...statusWhere, status: 'RENTED' } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      statusCounts: {
        ALL: allCount,
        DRAFT: draftCount,
        ACTIVE: activeCount,
        RENTED: rentedCount,
      },
    };
  }

  async getStats(user: RequestUser, organizationId?: string) {
    const orgId = this.resolveOrgId(user, organizationId);
    const where: Prisma.InventoryItemWhereInput = orgId ? { organizationId: orgId } : {};

    const [total, draft, active, rented, published] = await Promise.all([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.count({ where: { ...where, status: 'DRAFT' } }),
      this.prisma.inventoryItem.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.inventoryItem.count({ where: { ...where, status: 'RENTED' } }),
      this.prisma.inventoryItem.count({ where: { ...where, isPublished: true } }),
    ]);

    return { total, draft, active, rented, published };
  }

  async getSectors(user: RequestUser, organizationId?: string) {
    const orgId = this.resolveOrgId(user, organizationId);
    const where: Prisma.InventoryItemWhereInput = orgId ? { organizationId: orgId } : {};

    const sectors = await this.prisma.inventoryItem.groupBy({
      by: ['sector'],
      where,
      _count: { id: true },
      orderBy: { sector: 'asc' },
    });

    return sectors.map((s) => ({ sector: s.sector, count: s._count.id }));
  }

  async create(dto: CreateInventoryItemDto, user: RequestUser) {
    const orgId = this.resolveOrgId(user);
    if (!orgId) throw new BadRequestException('Organization ID is required');

    // Try finding matching locality
    const locality = await this.prisma.locality.findFirst({
      where: { name: { contains: dto.sector, mode: 'insensitive' } },
    });

    return this.prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        createdById: user.id,
        sector: dto.sector,
        localityId: locality?.id ?? null,
        houseNo: dto.houseNo,
        ownerName: dto.ownerName ?? null,
        ownerPhone: dto.ownerPhone ?? null,
        propertyType: dto.propertyType ?? 'BUILDER_FLOOR',
        purpose: dto.purpose ? dto.purpose.toUpperCase() : 'RENT',
        bhk: dto.bhk ? Number(dto.bhk) : null,
        floor: dto.floor ?? null,
        furnishing: dto.furnishing ? dto.furnishing.toUpperCase() : null,
        rent: dto.rent != null ? Number(dto.rent) : null,
        securityDeposit: dto.securityDeposit != null ? Number(dto.securityDeposit) : null,
        brokerage: dto.brokerage ?? null,
        tenantPreference: dto.tenantPreference ?? null,
        amenities: dto.amenities ?? [],
        notes: dto.notes ?? null,
        status: (dto.status ?? 'DRAFT').toUpperCase(),
        date: dto.date ? new Date(dto.date) : new Date(),
        pageNo: dto.pageNo ? Number(dto.pageNo) : null,
      },
    });
  }

  async update(id: string, dto: UpdateInventoryItemDto, user: RequestUser) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');

    if (user.role !== 'SUPER_ADMIN' && item.organizationId !== user.orgId) {
      throw new ForbiddenException('Not permitted to edit this item');
    }

    const data: Prisma.InventoryItemUpdateInput = {};
    if (dto.sector !== undefined) data.sector = dto.sector;
    if (dto.houseNo !== undefined) data.houseNo = dto.houseNo;
    if (dto.ownerName !== undefined) data.ownerName = dto.ownerName;
    if (dto.ownerPhone !== undefined) data.ownerPhone = dto.ownerPhone;
    if (dto.propertyType !== undefined) data.propertyType = dto.propertyType;
    if (dto.purpose !== undefined) data.purpose = dto.purpose.toUpperCase();
    if (dto.bhk !== undefined) data.bhk = dto.bhk ? Number(dto.bhk) : null;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.furnishing !== undefined) data.furnishing = dto.furnishing ? dto.furnishing.toUpperCase() : null;
    if (dto.rent !== undefined) data.rent = dto.rent != null ? Number(dto.rent) : null;
    if (dto.securityDeposit !== undefined) data.securityDeposit = dto.securityDeposit != null ? Number(dto.securityDeposit) : null;
    if (dto.brokerage !== undefined) data.brokerage = dto.brokerage;
    if (dto.tenantPreference !== undefined) data.tenantPreference = dto.tenantPreference;
    if (dto.amenities !== undefined) data.amenities = dto.amenities;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status.toUpperCase();
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.pageNo !== undefined) data.pageNo = dto.pageNo ? Number(dto.pageNo) : null;

    return this.prisma.inventoryItem.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, user: RequestUser) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');

    if (user.role !== 'SUPER_ADMIN' && item.organizationId !== user.orgId) {
      throw new ForbiddenException('Not permitted to delete this item');
    }

    return this.prisma.inventoryItem.delete({ where: { id } });
  }

  /**
   * One-click move/publish inventory row to a public marketplace Listing
   */
  async publishToListing(id: string, user: RequestUser) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');

    if (user.role !== 'SUPER_ADMIN' && item.organizationId !== user.orgId) {
      throw new ForbiddenException('Not permitted to publish this item');
    }

    // Find locality
    let locality = item.localityId ? await this.prisma.locality.findUnique({ where: { id: item.localityId } }) : null;
    if (!locality) {
      locality = await this.prisma.locality.findFirst({
        where: { name: { contains: item.sector, mode: 'insensitive' } },
      });
    }
    if (!locality) {
      // Fallback to first gurgaon locality
      locality = await this.prisma.locality.findFirst();
    }

    const title = `${item.bhk ? `${item.bhk} BHK ` : ''}${item.floor ? `${item.floor} Floor ` : ''}${item.furnishing ? `${item.furnishing.replace(/_/g, ' ')} ` : ''}for ${item.purpose === 'SALE' ? 'Sale' : 'Rent'} in ${item.sector}`;
    const slug = `${slugify(title)}-${Math.random().toString(36).substring(2, 7)}`;

    const desc = [
      `House: ${item.houseNo}, ${item.sector}, Gurgaon`,
      item.notes ? `Details: ${item.notes}` : '',
      item.tenantPreference ? `Preference: ${item.tenantPreference}` : '',
      `Published directly from Olive State verified inventory.`,
    ].filter(Boolean).join('\n');

    // Create public Listing
    const listing = await this.prisma.listing.create({
      data: {
        title,
        slug,
        purpose: item.purpose === 'SALE' ? 'SALE' : 'RENT',
        category: item.propertyType === 'RESIDENTIAL_PLOT' ? 'PLOT' : 'RESIDENTIAL',
        propertyType: (item.propertyType as any) || 'BUILDER_FLOOR',
        status: 'ACTIVE',
        localityId: locality?.id ?? '',
        address: `House ${item.houseNo}, ${item.sector}, Gurgaon`,
        latitude: locality?.latitude,
        longitude: locality?.longitude,
        price: item.rent ?? 0,
        securityDeposit: item.securityDeposit ?? null,
        brokerageAmount: item.brokerage ? (item.rent ? item.rent / 2 : null) : null,
        brokerageType: item.brokerage ? 'DAYS_15' : 'NONE',
        bedrooms: item.bhk ?? null,
        bathrooms: item.bhk ?? 1,
        floor: item.floor ? parseInt(item.floor, 10) || null : null,
        furnishing: (item.furnishing as any) || null,
        description: desc,
        contactName: item.ownerName || 'Olive State',
        contactPhone: item.ownerPhone || '9899980802',
        postedByType: 'BROKER',
        postedById: user.id,
        organizationId: item.organizationId,
        isVerified: true,
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 86400000),
      },
    });

    // Mark inventory item as published
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        isPublished: true,
        publishedListingId: listing.id,
        status: 'ACTIVE',
      },
    });

    return { inventory: updated, listing };
  }

  async bulkCreate(items: CreateInventoryItemDto[], user: RequestUser) {
    const orgId = this.resolveOrgId(user);
    if (!orgId) throw new BadRequestException('Organization ID is required');

    let createdCount = 0;
    for (const dto of items) {
      await this.create(dto, user);
      createdCount++;
    }
    return { count: createdCount };
  }

  async bulkUpdate(ids: string[], dto: UpdateInventoryItemDto, user: RequestUser) {
    const orgId = this.resolveOrgId(user);
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const data: Prisma.InventoryItemUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status.toUpperCase();
    if (dto.sector !== undefined) data.sector = dto.sector;
    if (dto.purpose !== undefined) data.purpose = dto.purpose.toUpperCase();
    
    // Only allow updating simple fields in bulk for now, primarily status
    return this.prisma.inventoryItem.updateMany({
      where: {
        id: { in: ids },
        organizationId: user.role !== 'SUPER_ADMIN' ? user.orgId : undefined,
      },
      data,
    });
  }
}
