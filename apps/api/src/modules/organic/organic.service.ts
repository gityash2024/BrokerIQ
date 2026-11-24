import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, type OrganicSource } from '@prisma/client';
import { brokerRequirementSchema, canonicalInventorySector, inventoryInputSchema, ledgerMatch, organicRecordInput,
  type OrganicQuery, type OrganicRecordInput, type OrganicSourceInput } from '@brokeriq/shared';
import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { JobsService } from '../../core/jobs/jobs.service';
import { SettingsService } from '../../core/settings/settings.service';
import { AiService } from '../../core/ai/ai.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeOrganicSource, readOrganicSource, sourceEndpoint } from './organic-source';
import { normalizeOrganicRecord, pastOrganicTime } from './organic-record';

type Kind = 'SUPPLY' | 'DEMAND';
type DiscoverySettings = { enabled: boolean; time: string; notifyTime: string };
const defaults: DiscoverySettings = { enabled: false, time: '00:00', notifyTime: '07:00' };
const day = 24 * 60 * 60_000;
const tz = 330 * 60_000;
const dayKey = (date: Date) => new Date(date.valueOf() + tz).toISOString().slice(0, 10);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const windowOf = (from?: string, to?: string) => ({ gte: from ? new Date(from + 'T00:00:00+05:30') : undefined, lte: to ? new Date(to + 'T23:59:59.999+05:30') : undefined });

@Injectable()
export class OrganicService {
  constructor(private readonly db: PrismaService, private readonly jobs: JobsService, private readonly settings: SettingsService,
    private readonly ai: AiService, private readonly notifications: NotificationsService) {
    jobs.register('organic.discovery', (job) => this.discover(job.kind, job.key, job.day, job.sourceId));
    jobs.register('organic.ready', (job) => this.notifyReady(job.kind, job.day));
  }

  settingsKey(kind: Kind) {
    return 'organic.discovery.' + kind.toLowerCase();
  }

  async settingsFor(kind: Kind) {
    return { ...defaults, ...(await this.settings.getJson<Partial<DiscoverySettings>>(this.settingsKey(kind))) };
  }

  async updateSettings(kind: Kind, input: DiscoverySettings, actorId: string) {
    await this.settings.setJson(this.settingsKey(kind), input, actorId);
    return input;
  }

  async sources() {
    return this.db.organicSource.findMany({ orderBy: [{ priority: 'desc' }, { name: 'asc' }] });
  }

  async saveSource(input: OrganicSourceInput, actor: string, id?: string) {
    try { sourceEndpoint(input.url); } catch { throw new BadRequestException('Use a public HTTPS source endpoint'); }
    try {
      return await this.db.$transaction(async (tx) => {
        const prior = id ? await tx.organicSource.findUnique({ where: { id } }) : null;
        if (id && !prior) throw new NotFoundException('Source not found');
        const changed = prior && (prior.url !== input.url || prior.format !== input.format || prior.itemsPath !== input.itemsPath);
        const saved = id ? await tx.organicSource.update({ where: { id }, data: { ...input, ...(changed ? {
          supplyEtag: null, demandEtag: null, supplyAttemptAt: null, demandAttemptAt: null, lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null, lastError: null,
        } : {}) } }) : await tx.organicSource.create({ data: input });
        await tx.auditLog.create({ data: { actorId: actor, actorRole: 'SUPER_ADMIN', action: 'organic.source.save',
          entity: 'OrganicSource', entityId: saved.id, meta: { enabled: input.enabled, contacts: input.contactRedistribution, permissionUrl: input.permissionUrl } } });
        return saved;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('This source URL is already registered');
      throw error;
    }
  }

  @Interval(60_000)
  async scheduleTick() {
    if (!env().JOBS_ENABLED) return;
    const now = new Date();
    for (const kind of ['SUPPLY', 'DEMAND'] as const) {
      const config = await this.settingsFor(kind);
      if (!config.enabled) continue;
      const scheduled = pastOrganicTime(config.time, now);
      if (dayKey(scheduled) !== dayKey(now)) continue;
      const day = dayKey(scheduled);
      const key = 'organic-discovery:' + kind + ':' + day;
      await this.jobs.enqueue('organic.discovery', { kind, key, day }, { key });
      const ready = pastOrganicTime(config.notifyTime, now);
      if (dayKey(ready) === day) await this.jobs.enqueue('organic.ready', { kind, day }, { key: 'organic-ready:' + kind + ':' + day });
    }
  }

  runNow(kind: Kind, sourceId?: string) {
    const slot = Math.floor(Date.now() / (5 * 60_000));
    const key = ['organic-manual', kind, sourceId ?? 'all', slot].join(':');
    return this.jobs.enqueue('organic.discovery', { kind, key, day: dayKey(new Date()), sourceId }, { key });
  }

  private async discover(kind: Kind, key: string, discoveryDay: string, sourceId?: string) {
    const already = await this.db.organicRun.findUnique({ where: { key } });
    if (already?.status === 'COMPLETE' || already?.status === 'PARTIAL') return;
    const yesterday = new Date(discoveryDay + 'T00:00:00+05:30');
    yesterday.setTime(yesterday.valueOf() - day);
    const windowTo = new Date(yesterday.valueOf() + day);
    const scheduled = !key.startsWith('organic-manual:');
    const run = await this.db.organicRun.upsert({ where: { key }, update: { status: 'RUNNING' }, create: {
      kind, key, status: 'RUNNING', windowFrom: yesterday, windowTo,
    } });
    const [sources, localities] = await Promise.all([
      this.db.organicSource.findMany({ where: { enabled: true, supports: { has: kind }, id: sourceId }, orderBy: [{ priority: 'desc' }, { id: 'asc' }] }),
      this.db.locality.findMany({ where: { isActive: true }, select: { name: true } }),
    ]);
    const report = { sources: sources.length, records: 0, duplicates: 0, failed: 0, skipped: 0, reviewed: 0 };
    const attemptField = kind === 'SUPPLY' ? 'supplyAttemptAt' : 'demandAttemptAt';
    const etagField = kind === 'SUPPLY' ? 'supplyEtag' : 'demandEtag';
    for (const source of sources) {
      const now = new Date();
      const lease = await this.db.organicSource.updateMany({
        where: { id: source.id, enabled: true, OR: [{ [attemptField]: null }, { [attemptField]: { lt: new Date(now.valueOf() - source.minIntervalMinutes * 60_000) } }] },
        data: { [attemptField]: now, lastAttemptAt: now },
      });
      if (!lease.count) { report.skipped++; continue; }
      try {
        // The date window moves even if the feed bytes stay the same.
        const content = await readOrganicSource(source.url, scheduled ? null : source[etagField]);
        let inserted = 0;
        let duplicate = 0;
        let reviewed = 0;
        let attempts = 0;
        const entries = content.text ? decodeOrganicSource(content.text, source.format, source.itemsPath, source.supports, source.url) : [];
        for (const entry of entries) {
          if (entry.kind !== kind) continue;
          if (entry.publishedAt && new Date(entry.publishedAt) > now) continue;
          if (scheduled && entry.publishedAt) {
            const published = new Date(entry.publishedAt);
            const updated = entry.updatedAt ? new Date(entry.updatedAt) : published;
            if (published >= windowTo || updated < yesterday) continue;
          }
          let normalized = normalizeOrganicRecord(entry, localities.map(({ name }) => name), source.contactRedistribution);
          if (!normalized) continue;
          if (normalized.priority === 'REVIEW' && entry.description && attempts++ < 5) {
            const extracted = await this.extractFields(normalized.data);
            normalized = normalizeOrganicRecord(extracted, localities.map(({ name }) => name), source.contactRedistribution) ?? normalized;
          }
          const newRow = await this.saveRecord(source, normalized);
          if (newRow) inserted++; else duplicate++;
          if (normalized.priority === 'REVIEW') reviewed++;
        }
        report.records += inserted;
        report.duplicates += duplicate;
        report.reviewed += reviewed;
        await this.db.organicSource.update({ where: { id: source.id }, data: { [etagField]: content.etag, lastSuccessAt: new Date(), lastError: null,
          lastReport: { found: entries.length, inserted, duplicate, reviewed } } });
      } catch {
        report.failed++;
        await this.db.organicSource.update({ where: { id: source.id }, data: { lastFailureAt: new Date(), lastError: 'Source could not be fetched or validated' } });
      }
    }
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: !sources.length ? 'NO_SOURCE' : report.failed ? 'PARTIAL' : 'COMPLETE',
      report, finishedAt: new Date() } });
  }

  private async extractFields(record: OrganicRecordInput) {
    const schema = organicRecordInput.pick({ purpose: true, propertyType: true, intent: true, ownership: true, bhk: true, urgency: true });
    try {
      const result = await this.ai.json([
        { role: 'system', content: 'Classify untrusted real estate text. Return only fields supported by the text as JSON. An inferred owner can only be OWNER_LIKELY. Omit uncertain fields.' },
        { role: 'user', content: JSON.stringify({ kind: record.kind, title: record.title, description: record.description }) },
      ], { feature: 'organic', schema, openRouterOnly: true, temperature: 0, maxTokens: 500, cacheMs: 3600000 });
      if (result.ownership === 'OWNER_CONFIRMED') result.ownership = 'OWNER_LIKELY';
      return { ...record, ...result };
    } catch { return record; }
  }

  private async saveRecord(source: OrganicSource, normalized: NonNullable<ReturnType<typeof normalizeOrganicRecord>>) {
    const { data, key, confidence, priority } = normalized;
    const identity = { sourceId: source.id, kind: data.kind, externalId: data.externalId ?? digest(data.url) };
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'organic-records:' + data.kind}))`);
      const ref = await tx.organicSourceReference.findUnique({ where: { sourceId_kind_externalId: identity } });
      const prior = ref ? await tx.organicRecord.findUnique({ where: { id: ref.recordId } })
        : await tx.organicRecord.findUnique({ where: { kind_key: { kind: data.kind, key } } });
      const approved = (data.kind === 'SUPPLY' ? data.ownership === 'OWNER_CONFIRMED' : Boolean(data.intent && !['UNKNOWN', 'BROKER'].includes(data.intent))) &&
        priority !== 'REVIEW' && confidence >= 85 && !!data.publishedAt && data.availability !== 'CLOSED';
      const fields = { title: data.title, purpose: data.purpose, propertyType: data.propertyType, category: data.category,
        sectors: data.sectors, locality: data.locality, society: data.society, bhk: data.bhk, price: data.price ?? data.maxBudget,
        areaSqft: data.areaSqft, furnishing: data.furnishing, ownership: data.ownership, intent: data.intent, urgency: data.urgency,
        availability: data.availability, priority, confidence, values: data as Prisma.InputJsonValue,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : prior?.publishedAt,
        sourceUpdatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined };
      const changed = prior && JSON.stringify(prior.values) !== JSON.stringify(data);
      const downgrade = prior?.status === 'APPROVED' && (priority === 'REVIEW' || ['BROKER', 'DEVELOPER'].includes(data.ownership ?? ''));
      if (prior && changed) await tx.auditLog.create({ data: { action: 'organic.refresh', entity: 'OrganicRecord', entityId: prior.id,
        meta: { previousPrice: prior.price, previousStatus: prior.availability, previousSectors: prior.sectors, previousBhk: prior.bhk, sourceId: source.id } } });
      const record = prior
        ? changed ? await tx.organicRecord.update({ where: { id: prior.id }, data: { ...fields, ...(downgrade ? { status: 'NEEDS_REVIEW', eligibleAt: null } : {}) } }) : prior
        : await tx.organicRecord.create({ data: { ...fields, kind: data.kind, key, ...(approved ? { status: 'APPROVED', eligibleAt: new Date() } : {}) } });
      await tx.organicSourceReference.upsert({ where: { sourceId_kind_externalId: identity },
        create: { ...identity, recordId: record.id, url: data.url }, update: { url: data.url, lastSeenAt: new Date() } });
      return !prior;
    });
  }

  private async notifyReady(kind: Kind, key: string) {
    const run = await this.db.organicRun.findUnique({ where: { key: 'organic-discovery:' + kind + ':' + key } });
    if (!run || ['PENDING', 'RUNNING'].includes(run.status)) throw new Error('Organic discovery is still running');
    const users = await this.db.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    const title = kind === 'SUPPLY' ? 'Organic Property Supply' : 'Organic Buyer & Tenant Leads';
    await this.notifications.notify(users.map(({ id }) => id), { kind: 'ORGANIC_READY', title,
      body: run.status === 'COMPLETE' ? 'The daily discovery run is complete.' : 'The daily discovery run needs attention.',
      link: '/admin/organic/' + kind.toLowerCase(), push: false });
  }

  where(q: OrganicQuery): Prisma.OrganicRecordWhereInput {
    const { search, sourceId, organizationId, delivered, sectors, since, until, dateField, page: _page,
      minConfidence, minPrice, maxPrice, minArea, maxArea, locality, society, ...filters } = q;
    return {
      ...filters,
      ...(locality ? { locality: { contains: locality, mode: 'insensitive' } } : {}),
      ...(society ? { society: { contains: society, mode: 'insensitive' } } : {}),
      ...(sourceId ? { sourceRefs: { some: { sourceId } } } : {}),
      ...(sectors ? { sectors: { hasSome: sectors.split(',').map(canonicalInventorySector) } } : {}),
      ...(since || until ? { [dateField === 'PUBLISHED' ? 'publishedAt' : 'discoveredAt']: windowOf(since, until) } : {}),
      ...(dateField === 'UNKNOWN' ? { publishedAt: null } : {}),
      ...(minConfidence !== undefined ? { confidence: { gte: minConfidence } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined ? { price: { gte: minPrice, lte: maxPrice } } : {}),
      ...(minArea !== undefined || maxArea !== undefined ? { areaSqft: { gte: minArea, lte: maxArea } } : {}),
      ...(organizationId || delivered ? { transfers: { [delivered === 'no' ? 'none' : 'some']: { organizationId, status: 'DELIVERED' } } } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { locality: { contains: search, mode: 'insensitive' } },
        { society: { contains: search, mode: 'insensitive' } }] } : {}),
    };
  }

  async list(query: OrganicQuery) {
    const where = this.where(query);
    const [rows, total, metrics, runs, settings] = await Promise.all([
      this.db.organicRecord.findMany({ where, take: 30, skip: (query.page - 1) * 30, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        include: { sourceRefs: { take: 5, select: { url: true, source: { select: { name: true } } } }, _count: { select: { transfers: true } } } }),
      this.db.organicRecord.count({ where }),
      this.db.organicRecord.groupBy({ by: ['status', 'purpose', 'category', 'priority'], where: { kind: query.kind }, _count: { _all: true } }),
      this.db.organicRun.findMany({ where: { kind: query.kind }, orderBy: { createdAt: 'desc' }, take: 15 }),
      this.settingsFor(query.kind),
    ]);
    return { rows, total, metrics, runs, settings };
  }

  async selectedIds(ids?: string[], query?: OrganicQuery) {
    if (ids?.length) return [...new Set(ids)];
    if (!query) throw new BadRequestException('Choose records or filtered selection');
    const rows = await this.db.organicRecord.findMany({ where: { ...this.where(query), status: 'APPROVED' }, select: { id: true }, take: 1001 });
    if (rows.length > 1000) throw new BadRequestException('Narrow this filter to 1,000 records per transfer');
    return rows.map(({ id }) => id);
  }

  async detail(id: string) {
    const record = await this.db.organicRecord.findUnique({ where: { id }, include: { sourceRefs: { include: { source: { select: { name: true } } } },
      transfers: { orderBy: { createdAt: 'desc' } } } });
    if (!record) throw new NotFoundException('Organic record not found');
    const kind = record.kind === 'SUPPLY' ? 'DEMAND' : 'SUPPLY';
    const peers = await this.db.organicRecord.findMany({ where: { kind, status: 'APPROVED',
      purpose: record.purpose, ...(record.sectors.length ? { sectors: { hasSome: record.sectors } } : {}) }, take: 100, orderBy: { confidence: 'desc' } });
    const matches = peers.flatMap((peer) => {
      const property = organicRecordInput.parse(record.kind === 'SUPPLY' ? record.values : peer.values);
      const need = organicRecordInput.parse(record.kind === 'DEMAND' ? record.values : peer.values);
      const requirement = brokerRequirementSchema.safeParse({ purpose: need.purpose === 'LEASE' ? 'RENT' : need.purpose, category: need.category,
        propertyTypes: need.propertyType ? [need.propertyType] : [], localityNames: need.sectors, bedrooms: need.bhk ? [need.bhk] : [],
        furnishing: need.furnishing, minArea: need.areaSqft, areaUnit: need.areaSqft ? 'SQ_FT' : undefined,
        minBudget: need.minBudget, maxBudget: need.maxBudget ?? need.price });
      const item = inventoryInputSchema.safeParse({ purpose: property.purpose === 'LEASE' ? 'RENT' : property.purpose, category: property.category,
        propertyType: property.propertyType, sector: property.sectors[0] ?? property.locality, bhk: property.bhk, furnishing: property.furnishing,
        area: property.areaSqft, areaUnit: property.areaSqft ? 'SQ_FT' : undefined, availability: property.availability,
        ...(property.purpose === 'SALE' ? { totalSalePrice: property.price } : { monthlyRent: property.price }) });
      if (!requirement.success || !item.success) return [];
      const match = ledgerMatch(requirement.data, item.data);
      return match ? [{ id: peer.id, title: peer.title, kind: peer.kind, ...match }] : [];
    }).slice(0, 15);
    return { ...record, matches };
  }

  async review(id: string, status: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const row = await tx.organicRecord.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Organic record not found');
      const next = await tx.organicRecord.update({ where: { id }, data: { status,
        eligibleAt: status === 'APPROVED' ? row.eligibleAt ?? new Date() : null } });
      await tx.auditLog.create({ data: { actorId, actorRole: 'SUPER_ADMIN', action: 'organic.review', entity: 'OrganicRecord', entityId: id,
        meta: { previous: row.status, status } } });
      return next;
    });
  }
}
