import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, type OrganicRun, type OrganicSource } from '@prisma/client';
import { brokerRequirementSchema, canonicalInventorySector, inventoryInputSchema, ledgerMatch, organicRecordInput, realeGurugramSource,
  type OrganicQuery, type OrganicRecordInput, type OrganicSourceInput } from '@brokeriq/shared';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { env } from '../../config/env';
import { JobDeferred, JobsService } from '../../core/jobs/jobs.service';
import { SettingsService } from '../../core/settings/settings.service';
import { AiService, OpenRouterQuotaDeferred } from '../../core/ai/ai.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeOrganicSource, readOrganicSource, sourceEndpoint } from './organic-source';
import { OrganicWebSearchService } from './organic-web-search.service';
import { discoveryPhases, nextOrganicTime, normalizeOrganicRecord, pastOrganicTime } from './organic-record';

type Kind = 'SUPPLY' | 'DEMAND';
type DiscoverySettings = { enabled: boolean; time: string; enrichTime?: string; resultsTime?: string; notifyTime: string };
type WorkflowConfig = { sourceIds: string[] | null; useAi: boolean; revision: number; searchWeb?: boolean };
const workflowKey = (kind: Kind) => 'organic.workflow.' + kind.toLowerCase();
const defaultWorkflow: WorkflowConfig = { sourceIds: null, useAi: true, revision: 0, searchWeb: false };
const terminal = ['COMPLETE', 'PARTIAL', 'NO_SOURCE', 'CANCELLED'];
const defaults: DiscoverySettings = { enabled: false, time: '00:00', notifyTime: '07:00' };
const day = 24 * 60 * 60_000;
const tz = 330 * 60_000;
const dayKey = (date: Date) => new Date(date.valueOf() + tz).toISOString().slice(0, 10);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const windowOf = (from?: string, to?: string) => ({ gte: from ? new Date(from + 'T00:00:00+05:30') : undefined, lte: to ? new Date(to + 'T23:59:59.999+05:30') : undefined });

@Injectable()
export class OrganicService {
  constructor(private readonly db: PrismaService, private readonly jobs: JobsService, private readonly settings: SettingsService,
    private readonly ai: AiService, private readonly notifications: NotificationsService,
    private readonly webSearch: OrganicWebSearchService) {
    jobs.register('organic.discovery', (job) => this.discover(job.kind, job.key, job.day, job.sourceId));
    jobs.register('organic.collect', (job) => this.collectScheduled(job.kind, job.key, job.day, job.sourceId, job.workflow));
    jobs.register('organic.enrich', (job) => this.enrichScheduled(job.kind, job.key, job.workflow));
    jobs.register('organic.publish', (job) => this.publishScheduled(job.kind, job.key));
    jobs.register('organic.ready', (job) => this.notifyReady(job.kind, job.day));
  }

  settingsKey(kind: Kind) {
    return 'organic.discovery.' + kind.toLowerCase();
  }

  async settingsFor(kind: Kind) {
    const config = { ...defaults, ...(await this.settings.getJson<Partial<DiscoverySettings>>(this.settingsKey(kind))) };
    return { ...config, ...discoveryPhases(config.time, config.notifyTime, config.enrichTime, config.resultsTime) };
  }

  async updateSettings(kind: Kind, input: DiscoverySettings, actorId: string) {
    await this.settings.setJson(this.settingsKey(kind), input, actorId);
    return input;
  }

  async workflowFor(kind: Kind): Promise<WorkflowConfig> {
    const row = await this.db.systemSetting.findUnique({ where: { key: workflowKey(kind) }, select: { value: true } });
    return { ...defaultWorkflow, ...(row?.value as Partial<WorkflowConfig> | undefined) };
  }

  async saveWorkflow(kind: Kind, input: WorkflowConfig, actorId: string) {
    const key = workflowKey(kind);
    const sourceIds = input.sourceIds && [...new Set(input.sourceIds)];
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const saved = await tx.systemSetting.findUnique({ where: { key } });
      const previous = saved?.value as WorkflowConfig | undefined;
      if ((previous?.revision ?? 0) !== input.revision) throw new ConflictException('Workflow changed. Reload the steps before saving.');
      if (sourceIds && sourceIds.length !== await tx.organicSource.count({ where: { id: { in: sourceIds }, supports: { has: kind } } })) {
        throw new BadRequestException('Choose sources compatible with this workflow');
      }
      const workflow = { sourceIds, useAi: input.useAi, searchWeb: input.searchWeb ?? previous?.searchWeb ?? false, revision: input.revision + 1 };
      await tx.systemSetting.upsert({ where: { key }, create: { key, value: workflow, updatedById: actorId },
        update: { value: workflow, updatedById: actorId } });
      await tx.auditLog.create({ data: { actorId, actorRole: 'SUPER_ADMIN', action: 'organic.workflow.update',
        entity: 'OrganicWorkflow', entityId: kind, meta: workflow } });
      return workflow;
    });
  }

  async sources() {
    return this.db.organicSource.findMany({ orderBy: [{ priority: 'desc' }, { name: 'asc' }] });
  }

  async saveSource(input: OrganicSourceInput, actor: string, id?: string) {
    try { sourceEndpoint(input.url); } catch { throw new BadRequestException('Use a public HTTPS source endpoint'); }
    if (input.searchPathPrefix && input.format !== 'HTML') throw new BadRequestException('Discovered pages require an approved HTML source');
    if (input.format === 'RERA_PROJECTS' && (input.url !== realeGurugramSource.url || input.permissionUrl !== realeGurugramSource.permissionUrl ||
      input.contactRedistribution || input.supports.length !== 1 || input.supports[0] !== 'SUPPLY' || input.minIntervalMinutes < realeGurugramSource.minIntervalMinutes)) {
      throw new BadRequestException('Use the licensed Gurugram registry profile without contact redistribution');
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const prior = id ? await tx.organicSource.findUnique({ where: { id } }) : null;
        if (id && !prior) throw new NotFoundException('Source not found');
        const changed = prior && (prior.url !== input.url || prior.format !== input.format || prior.itemsPath !== input.itemsPath || (input.searchPathPrefix !== undefined && prior.searchPathPrefix !== input.searchPathPrefix));
        const saved = id ? await tx.organicSource.update({ where: { id }, data: { ...input, ...(changed ? {
          supplyEtag: null, demandEtag: null, supplyAttemptAt: null, demandAttemptAt: null, lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null, lastError: null,
        } : {}) } }) : await tx.organicSource.create({ data: input });
        await tx.auditLog.create({ data: { actorId: actor, actorRole: 'SUPER_ADMIN', action: 'organic.source.save',
          entity: 'OrganicSource', entityId: saved.id, meta: { enabled: input.enabled, searchPathPrefix: saved.searchPathPrefix, contacts: input.contactRedistribution, permissionUrl: input.permissionUrl } } });
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
      await this.scheduleRun(kind, config, scheduled);
    }
  }

  private async scheduleRun(kind: Kind, config: Awaited<ReturnType<OrganicService['settingsFor']>>, scheduled: Date) {
    const discoveryDay = dayKey(scheduled);
    const key = 'organic-discovery:' + kind + ':' + discoveryDay;
    const legacy = await this.db.job.findUnique({ where: { key }, select: { id: true } });
    let payload = { kind, key, day: discoveryDay, workflow: await this.workflowFor(kind) };
    const notifyAt = nextOrganicTime(config.notifyTime, scheduled);
    if (!legacy) {
      const collect = await this.jobs.enqueue('organic.collect', payload, { key: key + ':collect', runAt: scheduled });
      payload = collect.payload as unknown as typeof payload;
      const enrichAt = nextOrganicTime(config.enrichTime, new Date(scheduled.valueOf() - 1));
      await this.jobs.enqueue('organic.enrich', payload, { key: key + ':enrich', runAt: enrichAt });
      const publishAt = nextOrganicTime(config.resultsTime, new Date(enrichAt.valueOf() - 1));
      await this.jobs.enqueue('organic.publish', payload, { key: key + ':publish', runAt: publishAt });
    }
    await this.jobs.enqueue('organic.ready', payload, { key: 'organic-ready:' + kind + ':' + discoveryDay, runAt: notifyAt, maxAttempts: 10 });
  }

  private sourceState(source: OrganicSource) {
    return digest(JSON.stringify([source.url, source.format, source.itemsPath, source.permissionUrl, source.contactRedistribution, source.supports,
      ...(source.searchPathPrefix ? [source.searchPathPrefix] : [])]));
  }

  private async collectScheduled(kind: Kind, key: string, discoveryDay: string, sourceId?: string, workflow = defaultWorkflow) {
    const manual = key.startsWith('organic-manual:');
    const cutoff = new Date(discoveryDay + 'T00:00:00+05:30');
    const run = await this.db.organicRun.upsert({ where: { key }, update: {}, create: {
      kind, key, status: 'COLLECTING',
      ...(manual ? {} : { windowFrom: new Date(cutoff.valueOf() - day), windowTo: cutoff }),
    } });
    if (run.status !== 'COLLECTING' || !(await this.continueScheduled(kind, run))) return;
    const sources = await this.db.organicSource.findMany({ where: { id: sourceId ?? (workflow.sourceIds !== null ? { in: workflow.sourceIds } : undefined), enabled: true, supports: { has: kind } },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }] });
    if (!sourceId && workflow.searchWeb) await this.webSearch.run(run.id, kind, discoveryDay, manual);
    const localities = await this.localityNames();
    const attemptField = kind === 'SUPPLY' ? 'supplyAttemptAt' : 'demandAttemptAt';
    for (const source of sources) {
      const identity = { runId: run.id, sourceId: source.id };
      const sourceState = this.sourceState(source);
      if (await this.db.organicSourceBatch.findUnique({ where: { runId_sourceId: identity }, select: { status: true } })) continue;
      const now = new Date();
      const leased = await this.db.organicSource.updateMany({
        where: { id: source.id, enabled: true, OR: [{ [attemptField]: null }, { [attemptField]: { lt: new Date(now.valueOf() - source.minIntervalMinutes * 60_000) } }] },
        data: { [attemptField]: now, lastAttemptAt: now },
      });
      if (!leased.count) {
        await this.db.organicSourceBatch.create({ data: { ...identity, sourceState, status: 'SKIPPED' } });
        continue;
      }
      try {
        const { entries } = await this.readSource(source);
        if (!sourceId && workflow.searchWeb && source.searchPathPrefix) {
          const urls = await this.webSearch.pagesForSource(run.id, source.url, source.searchPathPrefix);
          const recentSince = run.windowFrom ?? new Date(cutoff.valueOf() - day);
          for (const url of urls) {
            await delay(350);
            try {
              const { text } = await readOrganicSource(url);
              if (!text) continue;
              const candidates = decodeOrganicSource(text, 'HTML', '', source.supports, url);
              entries.push(...candidates.filter((entry) => entry.kind === kind && entry.publishedAt &&
                new URL(entry.url).href === url && this.inWindow(entry, now, recentSince, run.windowTo ?? undefined)));
            } catch {
              // A single stale or unreachable page does not discard the approved feed.
            }
          }
        }
        const rows = entries.flatMap((entry) => {
          if (entry.kind !== kind || !this.inWindow(entry, now, run.windowFrom ?? undefined, run.windowTo ?? undefined)) return [];
          const normalized = normalizeOrganicRecord(entry, localities, source.contactRedistribution);
          return normalized ? [normalized.data] : [];
        });
        await this.db.organicSourceBatch.create({ data: { ...identity, sourceState, status: 'COLLECTED', rows: rows as Prisma.InputJsonValue } });
      } catch {
        await this.db.organicSourceBatch.create({ data: { ...identity, sourceState, status: 'FAILED' } });
        await this.recordSourceFailure(source.id);
      }
    }
    const report = await this.batchReport(run.id);
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: 'COLLECTED', report } });
  }

  private async enrichScheduled(kind: Kind, key: string, workflow = defaultWorkflow) {
    const run = await this.db.organicRun.findUnique({ where: { key } });
    if (!run || run.status === 'COLLECTING') {
      await this.waitForPhase(key, 'collect', run, 'Source collection is still running');
      return;
    }
    if (terminal.includes(run.status) || run.status === 'ENRICHED' || !(await this.continueScheduled(kind, run))) return;
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: 'ENRICHING' } });
    const batches = await this.db.organicSourceBatch.findMany({ where: { runId: run.id, status: 'COLLECTED' } });
    const localities = await this.localityNames();
    for (const batch of batches) {
      const where = { runId_sourceId: { runId: run.id, sourceId: batch.sourceId } };
      const source = await this.db.organicSource.findUnique({ where: { id: batch.sourceId } });
      if (!source?.enabled || this.sourceState(source) !== batch.sourceState) {
        await this.db.organicSourceBatch.update({ where, data: { status: 'SKIPPED', rows: Prisma.DbNull } });
        continue;
      }
      const rows = organicRecordInput.array().parse(batch.rows);
      const enriched: OrganicRecordInput[] = [];
      let attempts = 0;
      for (const row of rows) {
        const normalized = normalizeOrganicRecord(row, localities, source.contactRedistribution);
        if (!normalized) continue;
        const enrich = workflow.useAi && normalized.priority === 'REVIEW' && !row.registryReference && row.description && attempts++ < 5;
        enriched.push(enrich ? await this.extractFields(normalized.data, true) : normalized.data);
      }
      await this.db.organicSourceBatch.update({ where, data: { status: 'ENRICHED', rows: enriched as Prisma.InputJsonValue } });
    }
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: 'ENRICHED', report: await this.batchReport(run.id) } });
  }

  private async publishScheduled(kind: Kind, key: string) {
    const run = await this.db.organicRun.findUnique({ where: { key } });
    if (!run || ['COLLECTING', 'COLLECTED', 'ENRICHING'].includes(run.status)) {
      await this.waitForPhase(key, 'enrich', run, 'Discovery classification is still running');
      return;
    }
    if (terminal.includes(run.status) || !(await this.continueScheduled(kind, run))) return;
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: 'PUBLISHING' } });
    const batches = await this.db.organicSourceBatch.findMany({ where: { runId: run.id, status: 'ENRICHED' } });
    const localities = await this.localityNames();
    for (const batch of batches) {
      const where = { runId_sourceId: { runId: run.id, sourceId: batch.sourceId } };
      const source = await this.db.organicSource.findUnique({ where: { id: batch.sourceId } });
      if (!source?.enabled || this.sourceState(source) !== batch.sourceState) {
        await this.db.organicSourceBatch.update({ where, data: { status: 'SKIPPED', rows: Prisma.DbNull } });
        continue;
      }
      const rows = organicRecordInput.array().parse(batch.rows);
      for (const row of rows.slice(batch.processed)) {
        const normalized = normalizeOrganicRecord(row, localities, source.contactRedistribution);
        if (!normalized) {
          await this.db.organicSourceBatch.update({ where, data: { processed: { increment: 1 } } });
          continue;
        }
        await this.saveRecord(source, normalized, { runId: run.id, sourceId: batch.sourceId });
      }
      const result = await this.db.organicSourceBatch.update({ where, data: { status: 'PUBLISHED', rows: Prisma.DbNull } });
      await this.db.organicSource.update({ where: { id: source.id }, data: { lastSuccessAt: new Date(), lastError: null,
        lastReport: { found: rows.length, inserted: result.inserted, duplicate: result.duplicates, reviewed: result.reviewed } } });
    }
    const report = await this.batchReport(run.id);
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: !report.sources ? 'NO_SOURCE' : report.failed ? 'PARTIAL' : 'COMPLETE',
      report, finishedAt: new Date() } });
  }

  private async continueScheduled(kind: Kind, run: OrganicRun) {
    if (run.key.startsWith('organic-manual:') || (await this.settingsFor(kind)).enabled) return true;
    await this.db.$transaction([
      this.db.organicSourceBatch.updateMany({ where: { runId: run.id, status: { in: ['COLLECTED', 'ENRICHED'] } }, data: { rows: Prisma.DbNull, status: 'SKIPPED' } }),
      this.db.organicRun.update({ where: { id: run.id }, data: { status: 'CANCELLED', finishedAt: new Date() } }),
    ]);
    return false;
  }

  private async batchReport(runId: string) {
    const batches = await this.db.organicSourceBatch.findMany({ where: { runId },
      select: { status: true, inserted: true, duplicates: true, reviewed: true } });
    return batches.reduce((report, batch) => ({
      sources: report.sources + 1, records: report.records + batch.inserted, duplicates: report.duplicates + batch.duplicates,
      reviewed: report.reviewed + batch.reviewed, failed: report.failed + Number(batch.status === 'FAILED'), skipped: report.skipped + Number(batch.status === 'SKIPPED'),
    }), { sources: 0, records: 0, duplicates: 0, reviewed: 0, failed: 0, skipped: 0 });
  }

  private async waitForPhase(key: string, phase: string, run: OrganicRun | null, pending: string) {
    const previous = await this.db.job.findUnique({ where: { key: key + ':' + phase }, select: { status: true } });
    if (previous?.status !== 'FAILED') throw new JobDeferred(pending, new Date(Date.now() + 60_000));
    if (!run) throw new Error('Discovery phase failed before opening its run');
    await this.db.$transaction([
      this.db.organicSourceBatch.updateMany({ where: { runId: run.id, status: { in: ['COLLECTED', 'ENRICHED'] } }, data: { rows: Prisma.DbNull, status: 'SKIPPED' } }),
      this.db.organicRun.update({ where: { id: run.id }, data: { status: 'PARTIAL', finishedAt: new Date() } }),
    ]);
  }

  private async readSource(source: OrganicSource, etag?: string | null) {
    const registry = source.format === 'RERA_PROJECTS';
    const content = await readOrganicSource(source.url, registry ? null : etag);
    const decode = (body: string) => decodeOrganicSource(body, source.format, source.itemsPath, source.supports, source.url);
    const entries = content.text ? decode(content.text) : [];
    if (registry && content.text) {
      // Validate the configured registry before generating further public requests.
      if (source.url !== realeGurugramSource.url) throw new Error('Unexpected RERA registry endpoint');
      const first = JSON.parse(content.text) as { pages?: number };
      if (typeof first.pages !== 'number' || !Number.isSafeInteger(first.pages) || first.pages < 1 || first.pages > 80) {
        throw new Error('Unsupported RERA project page count');
      }
      const url = new URL(source.url);
      for (let page = 2; page <= first.pages; page++) {
        await delay(350);
        url.searchParams.set('page', String(page));
        const next = await readOrganicSource(url.href);
        if (!next.text || (JSON.parse(next.text) as { page?: number }).page !== page) throw new Error('Invalid RERA project page');
        entries.push(...decode(next.text));
      }
    }
    return { entries, etag: content.etag };
  }

  private async localityNames() {
    return (await this.db.locality.findMany({ where: { isActive: true }, select: { name: true } })).map(({ name }) => name);
  }

  private inWindow(entry: OrganicRecordInput, now: Date, from?: Date, to?: Date) {
    if (!entry.publishedAt) return true;
    const published = new Date(entry.publishedAt);
    const updated = entry.updatedAt ? new Date(entry.updatedAt) : published;
    return published <= now && (!from || updated >= from) && (!to || published < to);
  }

  private recordSourceFailure(sourceId: string) {
    return this.db.organicSource.update({ where: { id: sourceId }, data: { lastFailureAt: new Date(), lastError: 'Source could not be fetched or validated' } });
  }

  async runNow(kind: Kind, sourceId?: string) {
    const now = new Date();
    const slot = Math.floor(now.valueOf() / (5 * 60_000));
    const key = ['organic-manual', kind, sourceId ?? 'all', slot].join(':');
    const legacy = await this.db.job.findUnique({ where: { key } });
    if (legacy) return legacy;
    if (sourceId && !(await this.db.organicSource.count({ where: { id: sourceId, enabled: true, supports: { has: kind } } })))
      throw new NotFoundException('This source is unavailable for the selected workflow');
    const payload = { kind, key, day: dayKey(now), sourceId, workflow: await this.workflowFor(kind) };
    const collect = await this.jobs.enqueue('organic.collect', payload, { key: key + ':collect', runAt: now });
    const saved = collect.payload as unknown as typeof payload;
    await this.jobs.enqueue('organic.enrich', saved, { key: key + ':enrich', runAt: new Date(now.valueOf() + 1000) });
    await this.jobs.enqueue('organic.publish', saved, { key: key + ':publish', runAt: new Date(now.valueOf() + 2000) });
    return collect;
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
      this.localityNames(),
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
        const { entries, etag } = await this.readSource(source, scheduled ? null : source[etagField]);
        let inserted = 0;
        let duplicate = 0;
        let reviewed = 0;
        let attempts = 0;
        for (const entry of entries) {
          if (entry.kind !== kind || !this.inWindow(entry, now, scheduled ? yesterday : undefined, scheduled ? windowTo : undefined)) continue;
          let normalized = normalizeOrganicRecord(entry, localities, source.contactRedistribution);
          if (!normalized) continue;
          if (normalized.priority === 'REVIEW' && !entry.registryReference && entry.description && attempts++ < 5) {
            const extracted = await this.extractFields(normalized.data);
            normalized = normalizeOrganicRecord(extracted, localities, source.contactRedistribution) ?? normalized;
          }
          const newRow = await this.saveRecord(source, normalized);
          if (newRow) inserted++; else duplicate++;
          if (normalized.priority === 'REVIEW') reviewed++;
        }
        report.records += inserted;
        report.duplicates += duplicate;
        report.reviewed += reviewed;
        await this.db.organicSource.update({ where: { id: source.id }, data: { [etagField]: etag, lastSuccessAt: new Date(), lastError: null,
          lastReport: { found: entries.length, inserted, duplicate, reviewed } } });
      } catch {
        report.failed++;
        await this.recordSourceFailure(source.id);
      }
    }
    await this.db.organicRun.update({ where: { id: run.id }, data: { status: !sources.length ? 'NO_SOURCE' : report.failed ? 'PARTIAL' : 'COMPLETE',
      report, finishedAt: new Date() } });
  }

  private async extractFields(record: OrganicRecordInput, deferWhenRateLimited = false) {
    const schema = organicRecordInput.pick({ purpose: true, propertyType: true, intent: true, ownership: true, bhk: true, urgency: true })
      .extend({ evidence: z.string().trim().min(3).max(220).optional() }).strict();
    try {
      const result = await this.ai.json([
        { role: 'system', content: 'Classify untrusted real estate text. Return only fields supported by the text as JSON. For any suggestion, include one verbatim evidence excerpt in evidence. An inferred owner can only be OWNER_LIKELY. Omit uncertain fields.' },
        { role: 'user', content: JSON.stringify({ kind: record.kind, title: record.title, description: record.description }) },
      ], { feature: 'organic', schema, openRouterOnly: true, deferWhenRateLimited, temperature: 0, maxTokens: 500, cacheMs: 3600000 });
      const { evidence, ...suggested } = result;
      const sourceText = [record.title, record.description].filter(Boolean).join(' ');
      if (!evidence || evidence.includes('[contact]') || !sourceText.toLowerCase().includes(evidence.toLowerCase())) return record;
      const patch: Partial<OrganicRecordInput> = {
        purpose: record.purpose ?? suggested.purpose,
        propertyType: record.propertyType ?? suggested.propertyType,
        intent: record.kind === 'DEMAND' && record.intent === 'UNKNOWN' ? suggested.intent ?? record.intent : record.intent,
        ownership: record.kind === 'SUPPLY' && record.ownership === 'UNKNOWN'
          ? suggested.ownership === 'OWNER_CONFIRMED' ? 'OWNER_LIKELY' : suggested.ownership ?? record.ownership : record.ownership,
        bhk: record.bhk ?? suggested.bhk,
        urgency: record.urgency ?? suggested.urgency,
      };
      return Object.entries(patch).some(([key, value]) => record[key as keyof OrganicRecordInput] !== value)
        ? { ...record, ...patch, modelEvidence: evidence } : record;
    } catch (error) {
      if (deferWhenRateLimited && error instanceof OpenRouterQuotaDeferred) throw new JobDeferred(error.message, error.until);
      return record;
    }
  }

  private async saveRecord(source: OrganicSource, normalized: NonNullable<ReturnType<typeof normalizeOrganicRecord>>, batch?: { runId: string; sourceId: string }) {
    const { key, confidence, priority } = normalized;
    const data = { ...normalized.data, contactSourceId: normalized.data.phone ? source.id : undefined };
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
      if (batch) await tx.organicSourceBatch.update({ where: { runId_sourceId: batch }, data: {
        processed: { increment: 1 }, inserted: { increment: Number(!prior) }, duplicates: { increment: Number(Boolean(prior)) },
        reviewed: { increment: Number(priority === 'REVIEW') },
      } });
      return !prior;
    });
  }

  private async notifyReady(kind: Kind, key: string) {
    const run = await this.db.organicRun.findUnique({ where: { key: 'organic-discovery:' + kind + ':' + key } });
    if (run?.status === 'CANCELLED') return;
    if (!run || !terminal.includes(run.status)) throw new Error('Organic discovery is still running');
    const users = await this.db.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    const title = kind === 'SUPPLY' ? 'Organic Property Supply' : 'Organic Buyer & Tenant Leads';
    await this.notifications.notify(users.map(({ id }) => id), { kind: 'ORGANIC_READY', title,
      body: run.status === 'COMPLETE' ? 'The daily discovery run is complete.' : 'The daily discovery run needs attention.',
      link: '/admin/organic/' + kind.toLowerCase(), push: false });
  }

  where(q: OrganicQuery): Prisma.OrganicRecordWhereInput {
    const { search, sourceId, organizationId, delivered, sectors, since, until, dateField, page: _page,
      minConfidence, minPrice, maxPrice, minArea, maxArea, locality, society, view, ...filters } = q;
    const selectedView: Prisma.OrganicRecordWhereInput =
      q.kind === 'SUPPLY' && !q.ownership && view === 'DIRECT_OWNERS' ? { ownership: 'OWNER_CONFIRMED' }
        : q.kind === 'SUPPLY' && !q.ownership && view === 'OWNER_REVIEW' ? { ownership: { in: ['OWNER_LIKELY', 'UNKNOWN'] } }
        : q.kind === 'DEMAND' && !q.intent && view === 'GENUINE_DEMAND'
          ? { intent: { in: ['BUYER', 'TENANT', 'COMMERCIAL_BUYER', 'COMMERCIAL_TENANT', 'INVESTOR', 'RELOCATION'] } }
          : {};
    return {
      ...filters,
      ...selectedView,
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
    return { rows, total, metrics, runs, settings, nextDiscoveryAt: settings.enabled ? nextOrganicTime(settings.time) : null };
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
    if (organicRecordInput.safeParse(record.values).data?.registryReference) return { ...record, matches: [] };
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
      if (status === 'APPROVED' && organicRecordInput.safeParse(row.values).data?.registryReference)
        throw new BadRequestException('A project registration needs a separate verified property listing before distribution');
      const next = await tx.organicRecord.update({ where: { id }, data: { status,
        eligibleAt: status === 'APPROVED' ? row.eligibleAt ?? new Date() : null } });
      await tx.auditLog.create({ data: { actorId, actorRole: 'SUPER_ADMIN', action: 'organic.review', entity: 'OrganicRecord', entityId: id,
        meta: { previous: row.status, status } } });
      return next;
    });
  }
}
