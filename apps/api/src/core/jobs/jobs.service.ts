import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, type Job } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { ModulesService } from '../features/modules.service';

export type JobHandler = (payload: any, job: Job) => Promise<void>;

/**
 * Postgres-backed job queue (no Redis needed).
 * Workers poll with FOR UPDATE SKIP LOCKED so multiple API instances are safe.
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private handlers = new Map<string, JobHandler>();
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: ModulesService,
  ) {}

  register(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  async enqueue(type: string, payload: Record<string, unknown> = {}, opts: { runAt?: Date; key?: string; maxAttempts?: number; repeat?: boolean } = {}) {
    const data = { type, payload: payload as Prisma.InputJsonValue, runAt: opts.runAt ?? new Date(), key: opts.key, maxAttempts: opts.maxAttempts ?? 5 };
    if (opts.key) {
      if (opts.repeat)
        await this.prisma.job.updateMany({
          where: { key: opts.key, status: { in: ['DONE', 'FAILED'] } },
          data: { ...data, status: 'PENDING', attempts: 0, lockedAt: null, lastError: null },
        });
      return this.prisma.job.upsert({ where: { key: opts.key }, create: data, update: {} });
    }
    return this.prisma.job.create({ data });
  }

  async cancel(key: string) {
    await this.prisma.job.deleteMany({ where: { key, status: 'PENDING' } });
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  @Interval(4000)
  async tick() {
    if (!env().JOBS_ENABLED || this.running || this.stopped) return;
    this.running = true;
    try {
      const jobs = await this.prisma.$queryRaw<Job[]>(Prisma.sql`
        UPDATE "Job" SET status = 'RUNNING', "lockedAt" = now(), attempts = attempts + 1, "updatedAt" = now()
        WHERE id IN (
          SELECT id FROM "Job" WHERE status = 'PENDING' AND "runAt" <= now()
          ORDER BY "runAt" ASC LIMIT 10 FOR UPDATE SKIP LOCKED
        ) RETURNING *`);
      await Promise.all(jobs.map((j) => this.execute(j)));
    } catch (e) {
      this.logger.error(`job tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async execute(job: Job) {
    try {
      await this.modules.assertPath(job.type, 'BROKER_ADMIN', 'job');
      const orgId = (job.payload as any)?.orgId;
      if (orgId && !(await this.prisma.organization.findFirst({ where: { id: orgId, status: 'ACTIVE' } }))) throw new Error('Firm is inactive or missing');
    } catch (error) {
      await this.prisma.job.update({ where: { id: job.id }, data: { status: 'FAILED', lastError: (error as Error).message, lockedAt: null } });
      return;
    }
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.prisma.job.update({ where: { id: job.id }, data: { status: 'FAILED', lastError: `No handler for ${job.type}` } });
      return;
    }
    try {
      await handler(job.payload, job);
      await this.prisma.job.update({ where: { id: job.id }, data: { status: 'DONE', lastError: null, lockedAt: null } });
    } catch (e) {
      const err = (e as Error).message?.slice(0, 1000) ?? 'error';
      const final = job.attempts >= job.maxAttempts;
      const backoffSec = Math.min(3600, 30 * 2 ** (job.attempts - 1));
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: final ? 'FAILED' : 'PENDING', lockedAt: null, lastError: err, runAt: new Date(Date.now() + backoffSec * 1000) },
      });
      this.logger.warn(`job ${job.type}#${job.id} failed (attempt ${job.attempts}): ${err}`);
    }
  }

  /** Recover jobs stuck in RUNNING (e.g. after a crash) and prune old finished jobs. */
  @Interval(5 * 60 * 1000)
  async housekeeping() {
    if (!env().JOBS_ENABLED) return;
    // A crashed outbound send can already have reached the provider. Exhausted jobs
    // require review rather than an automatic second delivery.
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Job" SET status = CASE WHEN attempts >= "maxAttempts" THEN 'FAILED' ELSE 'PENDING' END,
        "lastError" = 'Worker interrupted; inspect provider status before retrying outbound delivery',
        "lockedAt" = NULL, "updatedAt" = now()
      WHERE status = 'RUNNING' AND "lockedAt" < now() - interval '10 minutes'`);
    await this.prisma.job.deleteMany({ where: { status: 'DONE', updatedAt: { lt: new Date(Date.now() - 7 * 86400 * 1000) } } });
  }

  stats() {
    return this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } });
  }
}
