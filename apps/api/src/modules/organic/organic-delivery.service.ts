import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, PropertyType } from '@prisma/client';
import { canonicalInventorySector, normalizeIndianPhone, organicRecordInput, type OrganicDeliveryInput, type OrganicRecordInput, type OrganicTarget } from '@brokeriq/shared';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { nextOrganicTime } from './organic-record';

type Counters = { delivered: number; duplicate: number; skipped: number; failed: number };
const newCounters = (): Counters => ({ delivered: 0, duplicate: 0, skipped: 0, failed: 0 });
const recipient = { id: true, name: true } as const;

function initialDeliveryWindow(now: Date) {
  return new Date(now.valueOf() - 24 * 60 * 60_000);
}

@Injectable()
export class OrganicDeliveryService {
  constructor(private readonly db: PrismaService, private readonly jobs: JobsService, private readonly realtime: RealtimeGateway) {
    jobs.register('organic.delivery', (job) => this.deliverRun(job.scheduleId, job.cutoff));
    jobs.register('organic.manual-transfer', (job) => this.transferMany(job.ids, job.targets, job.actorId, job.runId));
  }

  async targets() {
    return this.db.organization.findMany({
      where: { status: 'ACTIVE', members: { some: { role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null } } },
      select: { id: true, name: true, status: true, localities: { select: { name: true } },
        members: { where: { role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null }, select: recipient, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  private async verifyTarget(db: Prisma.TransactionClient, target: OrganicTarget) {
    const user = await db.user.findFirst({ where: {
      id: target.brokerAdminId, organizationId: target.organizationId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null,
      organization: { status: 'ACTIVE' },
    }, select: recipient });
    if (!user) throw new BadRequestException('Choose an active Broker Admin of the selected firm');
  }

  async schedules() {
    const [rules, runs, firms] = await Promise.all([
      this.db.organicDeliverySchedule.findMany({ orderBy: { updatedAt: 'desc' } }),
      this.db.organicRun.findMany({ where: { kind: { in: ['DELIVERY', 'MANUAL'] } }, orderBy: { createdAt: 'desc' }, take: 40 }),
      this.targets(),
    ]);
    return { rules, runs, firms };
  }

  async preview(input: OrganicDeliveryInput) {
    await this.verifyTarget(this.db, input);
    const current = await this.db.organicDeliverySchedule.findUnique({ where: { organizationId: input.organizationId } });
    const sectors = input.sectors.map(canonicalInventorySector);
    const now = new Date();
    const earliest = initialDeliveryWindow(now);
    const since = !current || (!current.enabled && current.cursorFrom < earliest) ? earliest : current.cursorFrom;
    const eligible = this.eligible(since, now, { ...input, sectors });
    const [all, newCount] = await this.db.$transaction([
      this.db.organicRecord.count({ where: eligible }),
      this.db.organicRecord.count({ where: { ...eligible, transfers: { none: { organizationId: input.organizationId } } } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { windowFrom: since, qualifying: newCount, alreadyTransferred: all - newCount, nextRunAt: nextOrganicTime(input.time) };
  }

  async save(input: OrganicDeliveryInput, actorId: string) {
    await this.verifyTarget(this.db, input);
    const now = new Date();
    const { organizationId, ...options } = input;
    const data = { ...options, sectors: [...new Set(options.sectors.map(canonicalInventorySector))],
      nextRunAt: input.enabled ? nextOrganicTime(input.time, now) : null };
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'organic-schedule:' + organizationId}))`);
      const existing = await tx.organicDeliverySchedule.findUnique({ where: { organizationId } });
      const rule = await tx.organicDeliverySchedule.upsert({
        where: { organizationId }, create: { organizationId, ...data, cursorFrom: initialDeliveryWindow(now) },
        update: { ...data, ...(existing?.enabled === false && input.enabled && existing.cursorFrom < initialDeliveryWindow(now)
          ? { cursorFrom: initialDeliveryWindow(now) } : {}) },
      });
      await tx.auditLog.create({ data: { actorId, organizationId, action: 'organic.delivery.schedule', entity: 'OrganicDeliverySchedule',
        entityId: rule.id, meta: { enabled: rule.enabled, time: rule.time, sectors: rule.sectors, leadType: rule.leadType } } });
      return rule;
    });
  }

  @Interval(30_000)
  async scheduleTick() {
    if (!env().JOBS_ENABLED) return;
    const now = new Date();
    const due = await this.db.organicDeliverySchedule.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, take: 100, orderBy: { nextRunAt: 'asc' } });
    for (const rule of due) {
      if (!rule.nextRunAt) continue;
      const cutoff = rule.nextRunAt.toISOString();
      await this.jobs.enqueue('organic.delivery', { orgId: rule.organizationId, scheduleId: rule.id, cutoff },
        { key: 'organic-delivery:' + rule.id + ':' + cutoff, maxAttempts: 8 });
    }
  }

  private eligible(from: Date, to: Date, rule: { sectors: string[]; leadType: string }): Prisma.OrganicRecordWhereInput {
    return { kind: 'DEMAND', status: 'APPROVED', eligibleAt: { gt: from, lte: to }, availability: { notIn: ['CLOSED', 'STALE'] },
      sourceRefs: { some: { source: { enabled: true } } },
      ...(rule.sectors.length ? { sectors: { hasSome: rule.sectors } } : {}),
      ...(rule.leadType !== 'ALL' ? { intent: { in: rule.leadType === 'BUYER' ? ['BUYER', 'COMMERCIAL_BUYER', 'INVESTOR'] : ['TENANT', 'COMMERCIAL_TENANT', 'RELOCATION'] } } : {}),
    };
  }

  private async deliverRun(scheduleId: string, cutoffText: string) {
    const cutoff = new Date(cutoffText);
    const current = await this.db.organicDeliverySchedule.findUnique({ where: { id: scheduleId } });
    if (!current || !current.enabled || current.nextRunAt?.toISOString() !== cutoff.toISOString()) return;
    const key = 'delivery:' + scheduleId + ':' + cutoffText;
    const run = await this.db.organicRun.upsert({ where: { key }, update: { status: 'RUNNING' },
      create: { kind: 'DELIVERY', key, scheduleId, windowFrom: current.cursorFrom, windowTo: cutoff, status: 'RUNNING' } });
    let after: string | undefined;
    const report = newCounters();
    do {
      const rows = await this.db.organicRecord.findMany({
        where: { ...this.eligible(current.cursorFrom, cutoff, current), ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' }, select: { id: true }, take: 100,
      });
      for (const row of rows) {
        try {
          const result = await this.transfer(row.id, current, run.id);
          report[result]++;
        } catch { report.failed++; }
      }
      after = rows.length === 100 ? rows.at(-1)?.id : undefined;
    } while (after);

    const notification = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'organic-schedule:' + current.organizationId}))`);
      const actual = await tx.organicDeliverySchedule.findUnique({ where: { id: scheduleId } });
      if (!actual?.enabled || actual.nextRunAt?.toISOString() !== cutoffText) {
        await tx.organicRun.update({ where: { id: run.id }, data: { status: 'CANCELLED', report, finishedAt: new Date() } });
        return;
      }
      await tx.organicRun.update({ where: { id: run.id }, data: { status: report.failed ? 'PARTIAL' : 'COMPLETE', report, finishedAt: new Date() } });
      if (report.failed) return;
      await tx.organicDeliverySchedule.update({ where: { id: scheduleId }, data: { cursorFrom: cutoff, nextRunAt: nextOrganicTime(actual.time, cutoff) } });
      if (!report.delivered) return;
      return tx.notification.create({ data: { userId: actual.brokerAdminId, title: 'New organic leads and requirements',
        body: report.delivered + ' new records delivered to your firm', kind: 'ORGANIC_DELIVERY', link: '/broker/leads', data: { count: report.delivered },
      } });
    });
    if (notification) this.realtime.toUser(notification.userId, 'notification', notification);
    if (report.failed) throw new Error('Some organic lead transfers need retry');
  }

  private redistributablePhone(data: OrganicRecordInput, refs: { url: string; sourceId: string; source: { contactRedistribution: boolean } }[]) {
    const matching = refs.filter((ref) => data.contactSourceId ? ref.sourceId === data.contactSourceId : ref.url === data.url);
    return matching.length === 1 && matching[0].source.contactRedistribution ? normalizeIndianPhone(data.phone) : null;
  }

  async previewTransfer(ids: string[], targets: OrganicTarget[]) {
    const rows = await this.db.organicRecord.findMany({ where: { id: { in: ids }, status: 'APPROVED',
      availability: { notIn: ['CLOSED', 'STALE'] }, sourceRefs: { some: { source: { enabled: true } } } }, select: { id: true, values: true, kind: true,
        sourceRefs: { where: { source: { enabled: true } }, select: { url: true, sourceId: true, source: { select: { contactRedistribution: true } } } },
      } });
    return Promise.all(targets.map(async (target) => {
      await this.verifyTarget(this.db, target);
      const contacts = new Map(rows.filter(({ kind }) => kind === 'DEMAND').map(({ id, values, sourceRefs }) =>
        [id, this.redistributablePhone(organicRecordInput.parse(values), sourceRefs)]));
      const phones = [...contacts.values()].filter((phone): phone is string => Boolean(phone));
      const [previous, current] = await Promise.all([
        this.db.organicTransfer.findMany({ where: { recordId: { in: rows.map(({ id }) => id) }, organizationId: target.organizationId }, select: { recordId: true } }),
        this.db.lead.findMany({ where: { organizationId: target.organizationId, phone: { in: phones } }, select: { phone: true } }),
      ]);
      const duplicate = new Set(previous.map(({ recordId }) => recordId));
      const matched = new Set(current.map(({ phone }) => phone));
      for (const row of rows) {
        const phone = contacts.get(row.id);
        if (phone && matched.has(phone)) duplicate.add(row.id);
      }
      return { ...target, selected: ids.length, eligible: rows.length, duplicates: duplicate.size, newRecords: rows.length - duplicate.size };
    }));
  }

  async queueTransfer(ids: string[], targets: OrganicTarget[], actorId: string) {
    for (const target of targets) await this.verifyTarget(this.db, target);
    const run = await this.db.organicRun.create({ data: { kind: 'MANUAL', key: crypto.randomUUID(), status: 'PENDING' } });
    await this.jobs.enqueue('organic.manual-transfer', { ids, targets, actorId, runId: run.id }, { key: 'organic-manual-transfer:' + run.id });
    return { runId: run.id };
  }

  private async transferMany(ids: string[], targets: OrganicTarget[], actorId: string, runId: string) {
    for (const target of targets) await this.verifyTarget(this.db, target);
    const report = newCounters();
    await this.db.organicRun.update({ where: { id: runId }, data: { status: 'RUNNING' } });
    for (const target of targets) for (const id of ids) {
      try { report[await this.transfer(id, target, runId, actorId)]++; }
      catch { report.failed++; }
    }
    await this.db.organicRun.update({ where: { id: runId }, data: { status: report.failed ? 'PARTIAL' : 'COMPLETE', report, finishedAt: new Date() } });
    if (report.failed) throw new Error('Some organic transfers need retry');
  }

  private async transfer(recordId: string, target: OrganicTarget, runId: string, actorId?: string): Promise<'delivered' | 'duplicate' | 'skipped'> {
    return this.db.$transaction(async (tx) => {
      const { organizationId, brokerAdminId } = target;
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'organic-target:' + organizationId}))`);
      await this.verifyTarget(tx, target);
      const prior = await tx.organicTransfer.findUnique({ where: { recordId_organizationId: { recordId, organizationId } } });
      if (prior) return prior.runId === runId && prior.status === 'DELIVERED' ? 'delivered' : 'duplicate';
      const record = await tx.organicRecord.findFirst({
        where: { id: recordId, status: 'APPROVED', availability: { notIn: ['CLOSED', 'STALE'] } },
        include: { sourceRefs: { where: { source: { enabled: true } }, include: { source: { select: { contactRedistribution: true } } } } },
      });
      if (!record || !record.sourceRefs.length) return 'skipped';
      const data = organicRecordInput.parse(record.values);
      if (data.registryReference) return 'skipped';
      const phone = this.redistributablePhone(data, record.sourceRefs);
      const sourceUrl = record.sourceRefs[0].url;
      let targetId: string;
      let targetType: string;
      let duplicate = false;
      const note = [data.description, 'Source: ' + sourceUrl].filter(Boolean).join('\n');
      if (record.kind === 'SUPPLY') {
        const priorProperty = data.address && data.floor && data.areaSqft ? await tx.inventoryItem.findFirst({
          where: { organizationId, deletedAt: null, address: { equals: data.address, mode: 'insensitive' },
            floor: { equals: data.floor, mode: 'insensitive' }, area: data.areaSqft, ...(data.sectors[0] ? { sector: data.sectors[0] } : {}) },
          select: { id: true },
        }) : null;
        duplicate = !!priorProperty;
        targetId = priorProperty?.id ?? (await tx.inventoryItem.create({ data: {
          organizationId, createdById: brokerAdminId, assignedToId: brokerAdminId, sourceType: 'ORGANIC_SUPPLY',
          clientMutationId: 'organic:' + record.id, status: 'DRAFT', verificationStatus: 'NEEDS_REVIEW',
          sector: data.sectors[0] ?? data.locality, address: data.address ?? data.society, bhk: data.bhk,
          category: data.category, purpose: data.purpose, propertyType: data.propertyType,
          furnishing: data.furnishing, area: data.areaSqft, areaUnit: data.areaSqft == null ? undefined : 'SQ_FT',
          ...(data.purpose === 'RENT' ? { monthlyRent: data.price, rent: data.price } : data.purpose === 'SALE' ? { totalSalePrice: data.price } : {}),
          floor: data.floor, amenities: data.amenities, notes: note, ownerPhone: phone, ownerName: phone ? data.displayName : undefined,
          contacts: phone ? { create: { name: data.displayName, phone, role: 'OWNER' } } : undefined,
        }, select: { id: true } })).id;
        targetType = 'INVENTORY';
      } else if (phone) {
        const priorLead = await tx.lead.findUnique({ where: { organizationId_phone: { organizationId, phone } }, select: { id: true } });
        duplicate = !!priorLead;
        const localities = await tx.locality.findMany({ where: { name: { in: [...data.sectors, ...(data.locality ? [data.locality] : [])], mode: 'insensitive' } }, select: { id: true } });
        targetId = priorLead?.id ?? (await tx.lead.create({ data: {
          organizationId, name: data.displayName ?? data.title, phone, assignedToId: brokerAdminId,
          source: 'ORGANIC_DEMAND', sourceRef: record.id, sourceDetail: sourceUrl, notes: note, score: record.confidence,
          requirement: { create: { purpose: data.purpose === 'LEASE' ? 'RENT' : data.purpose, localityIds: localities.map(({ id }) => id),
            propertyTypes: data.propertyType && Object.hasOwn(PropertyType, data.propertyType) ? [data.propertyType as PropertyType] : [],
            minBudget: data.minBudget, maxBudget: data.maxBudget ?? data.price,
            bedrooms: data.bhk ? [data.bhk] : [], minArea: data.areaSqft, furnishing: data.furnishing, notes: note.slice(0, 2000) } },
          activities: { create: { organizationId, type: 'ENQUIRY', content: 'Organic Demand · ' + sourceUrl } },
        }, select: { id: true } })).id;
        targetType = 'LEAD';
      } else {
        targetId = (await tx.brokerRequirement.create({ data: { organizationId, createdById: brokerAdminId, assignedToId: brokerAdminId,
          clientMutationId: 'organic:' + record.id, title: data.title, intent: 'DEMAND', purpose: data.purpose,
          category: data.category, propertyTypes: data.propertyType ? [data.propertyType] : [],
          localityNames: [...new Set([...data.sectors, ...(data.locality ? [data.locality] : [])])], bedrooms: data.bhk ? [data.bhk] : [],
          minBudget: data.minBudget, maxBudget: data.maxBudget ?? data.price, furnishing: data.furnishing,
          minArea: data.areaSqft, areaUnit: data.areaSqft == null ? undefined : 'SQ_FT',
          notes: note, provenance: { source: 'Organic Demand', recordId, contactUrl: data.contactUrl ?? sourceUrl },
        }, select: { id: true } })).id;
        targetType = 'REQUIREMENT';
      }
      await tx.organicTransfer.create({ data: { recordId, organizationId, brokerAdminId, runId, targetId, targetType, status: duplicate ? 'DUPLICATE' : 'DELIVERED' } });
      await tx.auditLog.create({ data: { actorId, organizationId, actorRole: actorId ? 'SUPER_ADMIN' : undefined, action: 'organic.transfer',
        entity: 'OrganicRecord', entityId: recordId, meta: { targetId, targetType, duplicate, runId } } });
      return duplicate ? 'duplicate' : 'delivered';
    });
  }

  async retry(id: string) {
    const run = await this.db.organicRun.findFirst({ where: { id, kind: 'DELIVERY', status: 'PARTIAL' } });
    if (!run?.scheduleId || !run.windowTo) throw new NotFoundException('Delivery run is not available for retry');
    const cutoff = run.windowTo.toISOString();
    return this.jobs.enqueue('organic.delivery', { scheduleId: run.scheduleId, cutoff },
      { key: 'organic-delivery:' + run.scheduleId + ':' + cutoff, repeat: true, maxAttempts: 8 });
  }
}
