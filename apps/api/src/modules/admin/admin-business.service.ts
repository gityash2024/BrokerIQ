import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ADMIN_BUSINESS_RESOURCES, type AdminBusinessQuery, type AdminBusinessResource, type AdminBusinessRow } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../common/decorators';

interface Resource {
  table: string;
  title: string;
  search: string[];
  fields: string[];
  status?: string;
  date?: string;
  member?: string;
  deleted?: string;
  org?: Prisma.Sql;
  joins?: Prisma.Sql;
}
// Only these explicit business columns can be selected. No raw provider payloads, settings,
// credential fields, KYC document numbers/keys, public invoice tokens or arbitrary delegates.
const resources: Record<AdminBusinessResource, Resource> = {
  leads: {
    table: 'Lead',
    title: 'name',
    search: ['name', 'phone', 'email', 'sourceDetail'],
    member: 'assignedToId',
    status: 'stage',
    deleted: 'deletedAt',
    fields: [
      'name',
      'phone',
      'alternatePhone',
      'email',
      'source',
      'sourceDetail',
      'stage',
      'temperature',
      'score',
      'assignedToId',
      'listingId',
      'notes',
      'lostReason',
      'nextFollowUpAt',
      'lastActivityAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  },
  requirements: {
    table: 'BrokerRequirement',
    title: 'title',
    search: ['title', 'contactName', 'contactPhone', 'notes'],
    member: 'assignedToId',
    status: 'status',
    deleted: 'deletedAt',
    fields: [
      'title',
      'intent',
      'purpose',
      'category',
      'contactName',
      'contactPhone',
      'assignedToId',
      'createdById',
      'leadId',
      'sourceEntryId',
      'convertedInventoryId',
      'convertedAt',
      'minBudget',
      'maxBudget',
      'roomKind',
      'furnishing',
      'minArea',
      'maxArea',
      'areaUnit',
      'notes',
      'status',
      'revision',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  },
  imports: {
    table: 'ImportBatch',
    title: 'fileName',
    search: ['fileName', 'groupName', 'senderName'],
    member: 'createdById',
    status: 'status',
    fields: ['fileName', 'sourceType', 'groupName', 'senderName', 'senderPhone', 'createdById', 'status', 'createdAt', 'updatedAt'],
  },
  sources: {
    table: 'SourceEntry',
    title: 'rawText',
    search: ['rawText', 'reviewNote'],
    status: 'reviewState',
    org: Prisma.sql`b."organizationId"`,
    member: 'b.createdById',
    joins: Prisma.sql`JOIN "ImportBatch" b ON b.id=t."batchId"`,
    fields: ['batchId', 'pageNo', 'rowNo', 'rawText', 'reviewState', 'reviewedById', 'reviewedAt', 'reviewNote', 'duplicateOfId', 'createdAt', 'updatedAt'],
  },
  inventory: {
    table: 'InventoryItem',
    title: 'houseNo',
    search: ['houseNo', 'sector', 'address', 'ownerName', 'ownerPhone', 'unitLabel'],
    member: 'assignedToId',
    status: 'availability',
    deleted: 'deletedAt',
    fields: [
      'houseNo',
      'sector',
      'address',
      'unitLabel',
      'ownerName',
      'ownerPhone',
      'purpose',
      'category',
      'propertyType',
      'bhk',
      'roomKind',
      'floor',
      'furnishing',
      'area',
      'areaUnit',
      'monthlyRent',
      'totalSalePrice',
      'ratePerArea',
      'rateAreaUnit',
      'availability',
      'availabilityAt',
      'verificationStatus',
      'status',
      'notes',
      'createdById',
      'assignedToId',
      'isPublished',
      'publishedListingId',
      'sourceEntryId',
      'details',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  },
  listings: {
    table: 'Listing',
    title: 'title',
    search: ['title', 'address', 'societyName', 'refNo'],
    member: 'postedById',
    status: 'status',
    deleted: 'deletedAt',
    fields: [
      'title',
      'slug',
      'refNo',
      'purpose',
      'category',
      'propertyType',
      'status',
      'price',
      'bedrooms',
      'bathrooms',
      'floor',
      'furnishing',
      'localityId',
      'societyName',
      'address',
      'postedById',
      'contactName',
      'contactPhone',
      'description',
      'publishedAt',
      'expiresAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  },
  conversations: {
    table: 'Conversation',
    title: 'contactName',
    search: ['contactName', 'contactPhone', 'lastPreview'],
    status: 'channel',
    member: 'l.assignedToId',
    joins: Prisma.sql`LEFT JOIN "Lead" l ON l.id=t."leadId"`,
    fields: [
      'channel',
      'contactName',
      'contactPhone',
      'leadId',
      'userId',
      'lastMessageAt',
      'lastInboundAt',
      'lastPreview',
      'unreadCount',
      'blockedAt',
      'blockedReason',
      'createdAt',
    ],
  },
  messages: {
    table: 'Message',
    title: 'body',
    search: ['body', 'externalId'],
    org: Prisma.sql`c."organizationId"`,
    status: 'status',
    member: 't.senderUserId',
    joins: Prisma.sql`JOIN "Conversation" c ON c.id=t."conversationId"`,
    fields: ['conversationId', 'direction', 'type', 'body', 'status', 'senderUserId', 'externalId', 'providerEventAt', 'createdAt'],
  },
  kyc: {
    table: 'KycDocument',
    title: 'docType',
    search: ['docType', 'reviewNote'],
    member: 'userId',
    status: 'status',
    deleted: 'supersededAt',
    fields: ['userId', 'docType', 'status', 'supersededAt', 'reviewNote', 'reviewedById', 'reviewedAt', 'createdAt'],
  },
  shifts: {
    table: 'AgentShift',
    title: 'status',
    search: ['punchInAddress', 'punchOutAddress'],
    member: 'userId',
    status: 'status',
    date: 'punchInAt',
    fields: [
      'userId',
      'punchInAt',
      'punchOutAt',
      'status',
      'pauseReason',
      'pausedAt',
      'totalMinutes',
      'punchInAddress',
      'punchInAccuracy',
      'punchOutAddress',
      'punchOutAccuracy',
      'createdAt',
      'updatedAt',
    ],
  },
  followups: {
    table: 'FollowUp',
    title: 'note',
    search: ['note'],
    member: 'assignedToId',
    status: 'status',
    fields: ['leadId', 'assignedToId', 'createdById', 'type', 'dueAt', 'note', 'status', 'completedAt', 'reminderSentAt', 'createdAt', 'updatedAt'],
  },
  visits: {
    table: 'SiteVisit',
    title: 'address',
    search: ['address', 'note', 'feedback'],
    member: 'assignedToId',
    status: 'status',
    fields: [
      'leadId',
      'inventoryId',
      'listingId',
      'assignedToId',
      'scheduledAt',
      'address',
      'propertySnapshot',
      'note',
      'status',
      'feedback',
      'rating',
      'checkInAt',
      'createdAt',
      'updatedAt',
    ],
  },
  invoices: {
    table: 'ClientInvoice',
    title: 'number',
    search: ['number', 'clientName', 'clientPhone', 'clientEmail'],
    member: 'createdById',
    status: 'status',
    fields: [
      'number',
      'leadId',
      'dealId',
      'clientName',
      'clientPhone',
      'clientEmail',
      'items',
      'subtotal',
      'gstPct',
      'total',
      'dueDate',
      'status',
      'paidAt',
      'paidMode',
      'paidRef',
      'notes',
      'createdById',
      'createdAt',
      'updatedAt',
    ],
  },
  automations: {
    table: 'AutomationRule',
    title: 'name',
    search: ['name'],
    status: 'isActive',
    fields: ['name', 'isActive', 'trigger', 'respectBusinessHours', 'runCount', 'lastRunAt', 'createdAt', 'updatedAt'],
  },
  runs: {
    table: 'AutomationRun',
    title: 'status',
    search: ['id', 'leadId', 'ruleId'],
    org: Prisma.sql`r."organizationId"`,
    member: 'l.assignedToId',
    status: 'status',
    joins: Prisma.sql`JOIN "AutomationRule" r ON r.id=t."ruleId" LEFT JOIN "Lead" l ON l.id=t."leadId"`,
    fields: ['ruleId', 'leadId', 'status', 'createdAt'],
  },
  webhooks: {
    table: 'WebhookEvent',
    title: 'provider',
    search: ['provider', 'externalId'],
    status: 'status',
    fields: ['provider', 'externalId', 'status', 'createdAt', 'processedAt'],
  },
  jobs: {
    table: 'Job',
    title: 'type',
    search: ['type', 'id'],
    status: 'status',
    org: Prisma.sql`coalesce(je."organizationId",jr."organizationId",jb."organizationId",jl."organizationId",nullif(t.payload->>'orgId',''),nullif(t.payload->>'organizationId',''))`,
    joins: Prisma.sql`LEFT JOIN "WebhookEvent" je ON je.id=t.payload->>'eventId' LEFT JOIN "AutomationRule" jr ON jr.id=t.payload->>'ruleId' LEFT JOIN "ImportBatch" jb ON jb.id=t.payload->>'batchId' LEFT JOIN "Lead" jl ON jl.id=t.payload->>'leadId'`,
    fields: ['type', 'status', 'attempts', 'maxAttempts', 'runAt', 'lockedAt', 'createdAt', 'updatedAt'],
  },
  ai: {
    table: 'AiUsage',
    title: 'feature',
    search: ['feature', 'provider', 'model'],
    member: 'userId',
    status: 'success',
    fields: ['userId', 'feature', 'provider', 'model', 'tokens', 'success', 'createdAt'],
  },
};
const field = (name: string) => {
  const [alias, column] = name.includes('.') ? name.split('.') : ['t', name];
  if (!/^(?:t|b|c|l|r|o|u)$/.test(alias) || !/^[A-Za-z][A-Za-z0-9]*$/.test(column)) throw new Error('Invalid internal business column');
  return Prisma.raw(`${alias}."${column}"`);
};
const table = (r: Resource) => Prisma.raw(`"${r.table}"`);

@Injectable()
export class AdminBusinessService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async validateHierarchy(q: AdminBusinessQuery) {
    if (q.organizationId && !(await this.db.organization.findUnique({ where: { id: q.organizationId }, select: { id: true } })))
      throw new NotFoundException('Firm not found');
    if (q.memberId) {
      const member = await this.db.user.findUnique({ where: { id: q.memberId }, select: { organizationId: true } });
      if (!member || (q.organizationId && member.organizationId !== q.organizationId))
        throw new BadRequestException('Member does not belong to the selected firm');
    }
  }
  async hierarchy(kind: 'organizations' | 'members', q: { organizationId?: string; search?: string; page: number }) {
    const skip = (q.page - 1) * 30;
    const contains = { contains: q.search ?? '', mode: 'insensitive' as const };
    if (kind === 'organizations') {
      const where = q.search ? { OR: [{ name: contains }, { slug: contains }] } : {};
      const [items, total] = await this.db.$transaction([
        this.db.organization.findMany({ where, select: { id: true, name: true, status: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 30, skip }),
        this.db.organization.count({ where }),
      ]);
      return { items, total, page: q.page, totalPages: Math.ceil(total / 30) };
    }
    const where = {
      ...(q.organizationId ? { organizationId: q.organizationId } : {}),
      ...(q.search ? { OR: [{ name: contains }, { email: contains }, { phone: contains }] } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: { id: true, name: true, role: true, status: true, organizationId: true, organization: { select: { id: true, name: true } } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 30,
        skip,
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total, page: q.page, totalPages: Math.ceil(total / 30) };
  }
  private statuses(r: Resource) {
    if (!r.status) return [];
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === r.table)!;
    const item = model.fields.find((f) => f.name === r.status)!;
    if (item.type === 'Boolean') return ['true', 'false'];
    return Prisma.dmmf.datamodel.enums.find((e) => e.name === item.type)?.values.map((v) => v.name) ?? [];
  }
  private sql(resource: AdminBusinessResource, q: AdminBusinessQuery, id?: string) {
    const r = resources[resource];
    const org = r.org ?? field('organizationId');
    const member = r.member ? field(r.member) : Prisma.sql`NULL::text`;
    const where: Prisma.Sql[] = [];
    if (q.organizationId) where.push(Prisma.sql`${org}=${q.organizationId}`);
    if (q.memberId) {
      if (!r.member) throw new BadRequestException('This record type has no member owner; clear member filter');
      where.push(Prisma.sql`${member}=${q.memberId}`);
    }
    if (q.status) {
      if (!r.status || !this.statuses(r).includes(q.status)) throw new BadRequestException('Invalid status for this record type');
      where.push(Prisma.sql`${field(r.status)}::text=${q.status}`);
    }
    if (q.archive !== 'all') {
      if (!r.deleted) throw new BadRequestException('This record type has no archive; clear archive filter');
      where.push(q.archive === 'archived' ? Prisma.sql`${field(r.deleted)} IS NOT NULL` : Prisma.sql`${field(r.deleted)} IS NULL`);
    }
    const date = field(r.date ?? 'createdAt');
    if (q.from) where.push(Prisma.sql`${date}>=${new Date(q.from)}`);
    if (q.to) where.push(Prisma.sql`${date}<=${new Date(q.to)}`);
    if (id) where.push(Prisma.sql`t.id=${id}`);
    if (q.q) {
      const pattern = '%' + q.q.replace(/[\\%_]/g, '\\$&') + '%';
      where.push(
        Prisma.sql`(${Prisma.join(
          ['id', ...r.search].map((k) => Prisma.sql`${field(k)}::text ILIKE ${pattern}`),
          ' OR ',
        )})`,
      );
    }
    const from = Prisma.sql`FROM ${table(r)} t ${r.joins ?? Prisma.empty} LEFT JOIN "Organization" o ON o.id=${org} LEFT JOIN "User" u ON u.id=${member}`;
    const filter = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
    const common = Prisma.sql`'id',t.id,'organizationId',${org},'firm',o.name,'memberId',${member},'member',u.name,'title',left(coalesce(${field(r.title)}::text,t.id),160),'status',${r.status ? Prisma.sql`${field(r.status)}::text` : Prisma.sql`NULL::text`},'createdAt',${date}`;
    const order = q.sort === 'oldest' ? Prisma.sql`${date} ASC,t.id ASC` : Prisma.sql`${date} DESC,t.id DESC`;
    return { r, from, filter, common, order, hasFilter: where.length > 0 };
  }
  async list(resource: AdminBusinessResource, q: AdminBusinessQuery, user: RequestUser) {
    await this.validateHierarchy(q);
    const x = this.sql(resource, q);
    const result = await this.db.$transaction(
      async (tx) => {
        const [{ total }] = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${x.from} ${x.filter}`;
        const rows = await tx.$queryRaw<
          { row: AdminBusinessRow }[]
        >`SELECT jsonb_build_object(${x.common}) AS row ${x.from} ${x.filter} ORDER BY ${x.order} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;
        return {
          items: rows.map((r) => r.row),
          total,
          page: q.page,
          pageSize: q.pageSize,
          totalPages: Math.ceil(total / q.pageSize),
          statuses: this.statuses(x.r),
          supportsMember: !!x.r.member,
          supportsArchive: !!x.r.deleted,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    await this.audit.log(user, 'ADMIN_BUSINESS_LIST', resource, null, {
      organizationId: q.organizationId ?? null,
      memberId: q.memberId ?? null,
      total: result.total,
      page: q.page,
    });
    return result;
  }
  async detail(resource: AdminBusinessResource, id: string, q: AdminBusinessQuery, user: RequestUser) {
    await this.validateHierarchy(q);
    const x = this.sql(resource, q, id);
    const pairs = x.r.fields.flatMap((k) => [Prisma.sql`${k}`, field(k)]);
    const rows = await this.db.$queryRaw<
      { row: Record<string, unknown> }[]
    >`SELECT jsonb_build_object(${x.common}) || jsonb_build_object(${Prisma.join(pairs, ',')}) AS row ${x.from} ${x.filter} LIMIT 1`;
    if (!rows.length) throw new NotFoundException('Business record not found');
    await this.audit.log(user, 'ADMIN_BUSINESS_DETAIL', resource, id, { organizationId: rows[0].row.organizationId ?? null });
    return rows[0].row;
  }
  async export(resource: AdminBusinessResource, q: AdminBusinessQuery, user: RequestUser, selected?: string[]) {
    await this.validateHierarchy(q);
    const x = this.sql(resource, q);
    const ids = selected ? [...new Set(selected)] : undefined;
    const filter = ids ? Prisma.sql`${x.filter} ${x.hasFilter ? Prisma.sql`AND` : Prisma.sql`WHERE`} t.id IN (${Prisma.join(ids)})` : x.filter;
    const rows = await this.db.$transaction(
      async (tx) => {
        const [{ total }] = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${x.from} ${filter}`;
        if (ids && total !== ids.length) throw new BadRequestException('Some selected records no longer match these filters; refresh the selection');
        if (total > 50000) throw new BadRequestException('Export is limited to 50,000 records; narrow the filters');
        return tx.$queryRaw<{ row: AdminBusinessRow }[]>`SELECT jsonb_build_object(${x.common}) AS row ${x.from} ${filter} ORDER BY ${x.order}`;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
    );
    const columns = ['id', 'organizationId', 'firm', 'memberId', 'member', 'title', 'status', 'createdAt'] as const;
    const cell = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    await this.audit.log(user, 'ADMIN_BUSINESS_EXPORT', resource, null, {
      organizationId: q.organizationId ?? null,
      memberId: q.memberId ?? null,
      rows: rows.length,
      selected: !!ids,
    });
    return [columns.map(cell).join(','), ...rows.map(({ row }) => columns.map((k) => cell(row[k])).join(','))].join('\r\n');
  }
  async counts(q: AdminBusinessQuery) {
    await this.validateHierarchy(q);
    const entries = await this.db.$transaction(
      async (tx) => {
        const values = [];
        for (const resource of Object.keys(resources) as AdminBusinessResource[]) {
          const r = resources[resource];
          if (q.memberId && !r.member) {
            values.push({ resource, label: ADMIN_BUSINESS_RESOURCES[resource], total: null, supportsMember: false });
            continue;
          }
          const x = this.sql(resource, { ...q, status: undefined, archive: 'all', q: undefined });
          const [{ total }] = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${x.from} ${x.filter}`;
          values.push({ resource, label: ADMIN_BUSINESS_RESOURCES[resource], total, supportsMember: !!r.member });
        }
        return values;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items: entries };
  }
}
