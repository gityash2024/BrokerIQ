import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { nextOrganicTime } from './organic-record';
import { OrganicService } from './organic.service';

const jobTypes = ['organic.collect', 'organic.enrich', 'organic.publish', 'organic.ready',
  'organic.discovery', 'organic.delivery', 'organic.manual-transfer'];
const jobSelect = { id: true, key: true, type: true, status: true, attempts: true, maxAttempts: true,
  runAt: true, lockedAt: true, createdAt: true, updatedAt: true, payload: true, lastError: true } as const;
const runSelect = { id: true, kind: true, key: true, scheduleId: true, status: true, report: true,
  createdAt: true, finishedAt: true, windowTo: true,
  sourceBatches: { select: { sourceId: true, status: true, processed: true, inserted: true, duplicates: true, reviewed: true } } } as const;
type Job = Prisma.JobGetPayload<{ select: typeof jobSelect }>;
type Run = Prisma.OrganicRunGetPayload<{ select: typeof runSelect }>;

function jobRunKey(job: Job, keyByRunId: Map<string, string>) {
  const payload = job.payload as { key?: string; scheduleId?: string; cutoff?: string; runId?: string };
  if (job.type === 'organic.delivery') return 'delivery:' + payload.scheduleId + ':' + payload.cutoff;
  if (job.type === 'organic.manual-transfer') return keyByRunId.get(payload.runId ?? '') ?? null;
  return payload.key ?? null;
}

function canRetryStep(type: string, status: string | undefined) {
  switch (type) {
    case 'organic.collect': return !status || status === 'COLLECTING';
    case 'organic.enrich': return status === 'COLLECTED' || status === 'ENRICHING';
    case 'organic.publish': return status === 'ENRICHED' || status === 'PUBLISHING';
    case 'organic.discovery': return !status || status === 'RUNNING';
    case 'organic.manual-transfer': return true;
    default: return false;
  }
}

@Injectable()
export class OrganicExecutionsService {
  constructor(private readonly db: PrismaService, private readonly organic: OrganicService) {}

  async snapshot() {
    const [recent, active, sources, rules, supply, demand] = await Promise.all([
      this.db.organicRun.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, select: runSelect }),
      this.db.job.findMany({ where: { type: { in: jobTypes }, status: { in: ['PENDING', 'RUNNING', 'FAILED'] },
        OR: [{ createdAt: { gte: new Date(Date.now() - 48 * 60 * 60_000) } }, { status: { in: ['PENDING', 'RUNNING'] } }] },
        select: jobSelect, orderBy: { createdAt: 'desc' }, take: 75 }),
      this.db.organicSource.findMany({ orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, enabled: true, supports: true, format: true, lastSuccessAt: true, lastFailureAt: true } }),
      this.db.organicDeliverySchedule.findMany({ where: { enabled: true }, orderBy: { nextRunAt: 'asc' },
        select: { id: true, organizationId: true, nextRunAt: true, leadType: true } }),
      this.organic.settingsFor('SUPPLY'),
      this.organic.settingsFor('DEMAND'),
    ]);
    const keyByRunId = new Map(recent.map(({ id, key }) => [id, key]));
    const runs = new Map<string, Run | null>(recent.map((run) => [run.key, run]));
    const activeKeys = [...new Set(active.flatMap((job) => jobRunKey(job, keyByRunId) ?? []))];
    const olderActive = activeKeys.filter((key) => !runs.has(key));
    if (olderActive.length) {
      const extra = await this.db.organicRun.findMany({ where: { key: { in: olderActive } }, select: runSelect });
      for (const key of olderActive) runs.set(key, null);
      for (const run of extra) {
        runs.set(run.key, run);
        keyByRunId.set(run.id, run.key);
      }
    }
    const relatedJobs = await this.db.job.findMany({ where: { type: { in: jobTypes }, OR: [
      { key: { in: [...runs.keys()].flatMap((key) => {
        if (key.startsWith('organic-discovery:') || key.startsWith('organic-manual:')) {
          const phases = [key, key + ':collect', key + ':enrich', key + ':publish'];
          return key.startsWith('organic-discovery:') ? [...phases, key.replace('organic-discovery:', 'organic-ready:')] : phases;
        }
        if (key.startsWith('delivery:')) return ['organic-' + key];
        return runs.get(key)?.kind === 'MANUAL' ? ['organic-manual-transfer:' + runs.get(key)?.id] : [key];
      }) } },
      { id: { in: active.map(({ id }) => id) } },
    ] }, select: jobSelect, orderBy: [{ runAt: 'asc' }, { id: 'asc' }] });
    const jobsByRun = new Map<string, Job[]>();
    for (const job of relatedJobs) {
      const key = jobRunKey(job, keyByRunId);
      if (!key) continue;
      const list = jobsByRun.get(key) ?? [];
      list.push(job);
      jobsByRun.set(key, list);
    }
    const firms = await this.db.organization.findMany({ where: { id: { in: [...new Set(rules.map(({ organizationId }) => organizationId))] } },
      select: { id: true, name: true } });
    const schedule = (config: typeof supply) => ({ ...config, nextRunAt: config.enabled ? nextOrganicTime(config.time) : null });
    const executions = [...runs].flatMap(([key, run]) => {
      const jobs = jobsByRun.get(key) ?? [];
      const first = jobs[0];
      if (!run && !first) return [];
      const kind = run?.kind ?? (first.type === 'organic.delivery' ? 'DELIVERY' : (first.payload as { kind?: string }).kind ?? 'MANUAL');
      const status = run?.status === 'CANCELLED' ? 'CANCELLED' : jobs.some((job) => job.status === 'RUNNING') ? 'RUNNING'
        : jobs.some((job) => job.status === 'FAILED') ? 'FAILED'
        : run?.status ?? 'PENDING';
      return [{
        key, runId: run?.id ?? null, kind, status, scheduleId: run?.scheduleId ?? null, createdAt: run?.createdAt ?? first.createdAt,
        finishedAt: run?.finishedAt ?? null, report: run?.report ?? null, sourceBatches: run?.sourceBatches ?? [],
        steps: jobs.map(({ id, type, status, runAt, lockedAt, updatedAt, attempts, maxAttempts, lastError }) => ({
          canRetry: status === 'FAILED' && canRetryStep(type, run?.status),
          id, type, status, runAt, lockedAt, updatedAt, attempts, maxAttempts,
          deferred: status === 'PENDING' && Boolean(lastError) && runAt > new Date(),
        })),
      }];
    });
    executions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      workerEnabled: env().JOBS_ENABLED, sources, executions,
      discovery: { SUPPLY: schedule(supply), DEMAND: schedule(demand) },
      delivery: rules.map((rule) => ({ ...rule, firmName: firms.find(({ id }) => id === rule.organizationId)?.name ?? 'Firm unavailable' })),
    };
  }

  async retryJob(id: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const job = await tx.job.findFirst({ where: { id, type: { in: jobTypes.filter((type) => type !== 'organic.delivery') } },
        select: { id: true, status: true, type: true, payload: true } });
      if (!job) throw new NotFoundException('Workflow step not found');
      const payload = job.payload as { key?: string };
      const run = payload.key ? await tx.organicRun.findUnique({ where: { key: payload.key }, select: { status: true } }) : null;
      if (job.status !== 'FAILED' || !canRetryStep(job.type, run?.status)) throw new ConflictException('This workflow step is not waiting for a retry');
      const changed = await tx.job.updateMany({ where: { id, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, lastError: null, lockedAt: null, runAt: new Date() } });
      if (changed.count) await tx.auditLog.create({ data: { actorId, actorRole: 'SUPER_ADMIN',
        action: 'organic.workflow.retry', entity: 'Job', entityId: id } });
      return { id };
    });
  }
}
