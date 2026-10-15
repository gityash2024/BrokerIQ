import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type InventoryInput, type BrokerRequirementInput, ledgerMatch, areaSqft, normalizeIndianPhone, propertyDetailsSchema, PROPERTY_FIELDS, INVENTORY_SORTS } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../common/decorators';
import type { InventoryFilterQuery } from './inventory.dto';

const include = {
  contacts: true,
  sourceEntry: { select: { id: true, rawText: true, pageNo: true, bbox: true, batch: { select: { id: true, sourceType: true, fileName: true } } } },
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
  ) {}
  orgId(user: RequestUser, requested?: string, required = true) {
    const id = user.role === 'SUPER_ADMIN' ? requested : user.orgId;
    if (!id && (required || user.role !== 'SUPER_ADMIN')) throw new ForbiddenException('Organization required');
    return id || undefined;
  }
  private scope(user: RequestUser, requested?: string): Prisma.InventoryItemWhereInput {
    return { organizationId: this.orgId(user, requested, false), deletedAt: null };
  }
  async findAll(q: InventoryFilterQuery, user: RequestUser) {
    const where = this.scope(user, q.organizationId);
    if (q.sector) where.sector = { equals: q.sector, mode: 'insensitive' };
    if (q.houseNo) where.houseNo = { contains: q.houseNo, mode: 'insensitive' };
    for (const key of ['bhk', 'status', 'purpose', 'propertyType', 'category', 'furnishing', 'roomKind', 'availability', 'sourceType'] as const)
      if (q[key] != null) (where as any)[key] = q[key];
    if (q.search)
      where.OR = ['houseNo', 'sector', 'ownerName', 'ownerPhone', 'notes', 'address', 'unitLabel'].map((key) => ({
        [key]: { contains: q.search, mode: 'insensitive' },
      }));
    const and: Prisma.InventoryItemWhereInput[] = [];
    const csv=(value:string)=>value.split(',').map((v)=>v.trim()).filter(Boolean).slice(0,100);
    if(q.localities)and.push({sector:{in:csv(q.localities),mode:'insensitive'}});
    if(q.propertyTypes)and.push({propertyType:{in:csv(q.propertyTypes)}});
    if(q.roomKinds)and.push({roomKind:{in:csv(q.roomKinds)}});
    if(q.floor)where.floor={equals:q.floor,mode:'insensitive'};
    if(q.verificationStatus)where.verificationStatus=q.verificationStatus;
    if(q.hasPhotos)and.push({photoUrls:{isEmpty:q.hasPhotos==='false'}});
    if(q.hasVideos)and.push({videoUrls:{isEmpty:q.hasVideos==='false'}});
    if(q.amenities)and.push({amenities:{hasEvery:csv(q.amenities)}});
    if(q.minRate!=null||q.maxRate!=null)where.ratePerSqft={...(q.minRate!=null?{gte:q.minRate}:{}),...(q.maxRate!=null?{lte:q.maxRate}:{})};
    if(q.detailFilters){
      let details:Record<string,unknown>;try{details=JSON.parse(q.detailFilters);}catch{throw new BadRequestException('Invalid property filters');}
      if(!details||Array.isArray(details)||typeof details!=='object')throw new BadRequestException('Invalid property filters');
      for(const [key,value] of Object.entries(details)){
        const field=PROPERTY_FIELDS.find((f)=>f.key===key);if(!field)throw new BadRequestException(`Unknown property filter: ${key}`);
        if(value==null||value==='')continue;
        if(field.kind==='number'){
          const range=value as {min?:number;max?:number};
          if(!range||typeof range!=='object'||Object.keys(range).some((k)=>!['min','max'].includes(k)))throw new BadRequestException('Invalid numeric range');
          for(const [bound,amount] of Object.entries(range)){
            if(typeof amount!=='number'||!Number.isFinite(amount)||amount<(field.min??0)||amount>(field.max??1e13))throw new BadRequestException('Invalid numeric filter');
            and.push({details:bound==='min'?{path:[key],gte:amount}:{path:[key],lte:amount}});
          }
        }else if(field.kind==='text'){
          if(typeof value!=='string'||value.length>200)throw new BadRequestException('Invalid text filter');
          and.push({details:{path:[key],string_contains:value,mode:'insensitive'}});
        }else{
          const values=Array.isArray(value)?value:[value];if(values.length>100)throw new BadRequestException('Too many filter choices');
          for(const v of values)if(!propertyDetailsSchema.safeParse({[key]:v}).success)throw new BadRequestException('Invalid property filter choice');
          and.push({OR:values.map((v)=>({details:{path:[key],equals:v as Prisma.InputJsonValue}}))});
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
    if(q.sort&&!INVENTORY_SORTS.some((s)=>s.value===q.sort))throw new BadRequestException('Invalid sort');
    const [sortField,sortDirection]=q.sort?.split(':')??[];
    const order = sortField ?? (q.sortBy === 'rent' ? 'monthlyRent' : q.sortBy);
    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include,
        orderBy: [{ [order]: ['price','ratePerSqft','monthlyRent','totalSalePrice'].includes(order)?{sort:sortDirection??q.sortOrder,nulls:'last'}:sortDirection??q.sortOrder }, { id: 'asc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return { items: items.map(ledgerJson), total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  }
  async get(id: string, user: RequestUser) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { ...this.scope(user), id }, include });
    if (!item) throw new NotFoundException('Inventory item not found');
    return ledgerJson(item);
  }
  async getStats(user: RequestUser, organizationId?: string) {
    const where = this.scope(user, organizationId);
    const [total, statuses, availability, reviewed] = await Promise.all([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.groupBy({ by: ['status'], where, _count: { id: true } }),
      this.prisma.inventoryItem.groupBy({ by: ['availability'], where, _count: { id: true } }),
      this.prisma.inventoryItem.count({ where: { ...where, verificationStatus: 'VERIFIED' } }),
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
      published: 0,
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
  private fields(input: InventoryInput, previous?:any) {
    const { contacts: _contacts, organizationId: _org, expectedRevision: _revision, details:_details, ...data } = input;
    const monthly = input.monthlyRent !== undefined ? input.monthlyRent : input.rent;
    const primaryPhone = input.ownerPhone === undefined ? undefined : input.ownerPhone ? normalizeIndianPhone(input.ownerPhone) : null;
    if (input.ownerPhone && !primaryPhone) throw new BadRequestException('Invalid Indian phone number');
    const effective={...previous,...data,...(monthly!==undefined?{monthlyRent:monthly}:{})};
    const details=input.details?{...(previous?.details??{}),...input.details}:undefined;
    const price=effective.purpose==='RENT'?effective.monthlyRent??effective.rent:effective.purpose==='SALE'?effective.totalSalePrice:null;
    const size=effective.area!=null&&effective.areaUnit?areaSqft(Number(effective.area),effective.areaUnit):null;
    const rate=effective.ratePerArea!=null&&effective.rateAreaUnit?Number(effective.ratePerArea)/areaSqft(1,effective.rateAreaUnit)!:size&&price!=null?Number(price)/size:null;
    return {
      ...data,
      price:price==null?null:Number(price),ratePerSqft:rate,
      ...(details?{details:details as Prisma.InputJsonValue}:{}),
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
  async create(input: InventoryInput, user: RequestUser) {
    const organizationId = this.orgId(user, input.organizationId)!;
    if (input.clientMutationId) {
      const existing = await this.prisma.inventoryItem.findUnique({
        where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
        include,
      });
      if (existing) return ledgerJson(existing);
    }
    if (!input.sector && !input.address) throw new BadRequestException('Sector/locality or address required');
    const creation = {
      data: {
        ...this.fields(input),
        organizationId,
        createdById: user.id,
        verificationStatus: input.verificationStatus ?? 'VERIFIED',
        contacts: { create: this.contacts(input) },
      },
      include,
    };
    const item = input.clientMutationId
      ? await this.prisma.inventoryItem.upsert({
          where: { organizationId_clientMutationId: { organizationId, clientMutationId: input.clientMutationId } },
          create: creation.data,
          update: {},
          include,
        })
      : await this.prisma.inventoryItem.create(creation);
    await this.audit.log(user, 'inventory.create', 'InventoryItem', item.id);
    return ledgerJson(item);
  }
  async update(id: string, input: InventoryInput, user: RequestUser) {
    const item = await this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findFirst({ where: { ...this.scope(user), id } });
      if (!current) throw new NotFoundException('Inventory item not found');
      const changed = await tx.inventoryItem.updateMany({
        where: { id, deletedAt: null, revision: input.expectedRevision ?? current.revision },
        data: { ...this.fields(input,current), revision: { increment: 1 } },
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
      return tx.inventoryItem.findUniqueOrThrow({ where: { id }, include });
    });
    await this.audit.log(user, 'inventory.update', 'InventoryItem', id, {
      fields: Object.keys(input).filter((k) => k !== 'contacts'),
      revision: item.revision,
    });
    return ledgerJson(item);
  }
  async delete(id: string, user: RequestUser) {
    await this.get(id, user);
    await this.prisma.inventoryItem.update({ where: { id }, data: { deletedAt: new Date(), revision: { increment: 1 } } });
    await this.audit.log(user, 'inventory.archive', 'InventoryItem', id);
    return { ok: true };
  }
  publishToListing() {
    throw new ForbiddenException({ statusCode: 403, code: 'FEATURE_DISABLED', message: 'Public marketplace publishing is coming soon.' });
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
      const items = await tx.inventoryItem.findMany({ where: { ...this.scope(user), id: { in: unique } }, select: { id: true, organizationId: true } });
      if (items.length !== unique.length || new Set(items.map((i) => i.organizationId)).size !== 1)
        throw new ForbiddenException('Select properties from one authorized firm only');
      return tx.inventoryItem.updateMany({
        where: { id: { in: unique }, organizationId: items[0].organizationId },
        data: { ...input, ...(input.availability ? { availabilityAt: new Date() } : {}), revision: { increment: 1 } },
      });
    });
    await this.audit.log(user, 'inventory.bulk_update', 'InventoryItem', unique.join(',').slice(0, 100), { count: count.count, ...input });
    return count;
  }
  async matching(requirement: BrokerRequirementInput, user: RequestUser) {
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
