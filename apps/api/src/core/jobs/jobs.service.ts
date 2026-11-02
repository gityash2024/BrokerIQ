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
  private heavyExecutions = new Set<Promise<void>>();

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
      // Prisma's empty-update upsert can become SELECT + INSERT and race for a
      // previously unseen key. PostgreSQL ON CONFLICT keeps concurrent scheduling atomic.
      await this.prisma.job.createMany({ data: [data], skipDuplicates: true });
      return this.prisma.job.findUniqueOrThrow({ where: { key: opts.key } });
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
      const jobs = await this.prisma.$transaction(async (tx) => {
        // The short claim lock serializes the heavy-job availability check across workers.
        // It is released before any extraction/OCR/model or provider work starts.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brokeriq:job-claim'))`;
        return tx.$queryRaw<Job[]>(Prisma.sql`
          WITH ordinary AS (
            SELECT id FROM "Job" WHERE status = 'PENDING' AND "runAt" <= timezone('UTC', now()) AND type <> 'import.extract'
            ORDER BY "runAt" ASC, id ASC LIMIT 10 FOR UPDATE SKIP LOCKED
          ), heavy AS (
            SELECT id FROM "Job" WHERE status = 'PENDING' AND "runAt" <= timezone('UTC', now()) AND type = 'import.extract'
              AND NOT EXISTS (SELECT 1 FROM "Job" WHERE type = 'import.extract' AND status = 'RUNNING')
            ORDER BY "runAt" ASC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
          )
          UPDATE "Job" SET status = 'RUNNING', "lockedAt" = timezone('UTC', now()), attempts = attempts + 1, "updatedAt" = timezone('UTC', now())
          WHERE id IN (SELECT id FROM ordinary UNION ALL SELECT id FROM heavy) RETURNING *`);
      });
      const ordinary: Job[] = [];
      for (const job of jobs) {
        if (job.type !== 'import.extract') {
          ordinary.push(job);
          continue;
        }
        // A large import must not hold up subsequent notification/CRM polling batches.
        const execution = this.execute(job)
          .catch(() => this.logger.error(`heavy job persistence failed: ${job.id}`))
          .finally(() => this.heavyExecutions.delete(execution));
        this.heavyExecutions.add(execution);
      }
      await Promise.all(ordinary.map((job) => this.execute(job)));
    } catch (e) {
      this.logger.error(`job tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async execute(job: Job) {
    const owned = { id: job.id, status: 'RUNNING' as const, attempts: job.attempts };
    if (!(await this.prisma.job.findFirst({ where: owned, select: { id: true } }))) return;
    try {
      await this.modules.assertPath(job.type, 'BROKER_ADMIN', 'job');
      const orgId = (job.payload as any)?.orgId;
      if (orgId && !(await this.prisma.organization.findFirst({ where: { id: orgId, status: 'ACTIVE' } }))) throw new Error('Firm is inactive or missing');
    } catch (error) {
      await this.prisma.job.updateMany({ where: owned, data: { status: 'FAILED', lastError: (error as Error).message, lockedAt: null } });
      return;
    }
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.prisma.job.updateMany({ where: owned, data: { status: 'FAILED', lastError: `No handler for ${job.type}`, lockedAt: null } });
      return;
    }
    if (!(await this.prisma.job.findFirst({ where: owned, select: { id: true } }))) return;
    const heartbeat = setInterval(() => {
      if (this.stopped) return;
      void this.prisma.job.updateMany({ where: owned, data: { lockedAt: new Date() } }).catch(() => this.logger.warn(`job heartbeat failed: ${job.id}`));
    }, 30_000);
    heartbeat.unref();
    try {
      await handler(job.payload, job);
      await this.prisma.job.updateMany({ where: owned, data: { status: 'DONE', lastError: null, lockedAt: null } });
    } catch (e) {
      const err = (e as Error).message?.slice(0, 1000) ?? 'error';
      const final = job.attempts >= job.maxAttempts;
      const backoffSec = Math.min(3600, 30 * 2 ** (job.attempts - 1));
      await this.prisma.job.updateMany({
        where: owned,
        data: { status: final ? 'FAILED' : 'PENDING', lockedAt: null, lastError: err, runAt: new Date(Date.now() + backoffSec * 1000) },
      });
      this.logger.warn(`job ${job.type}#${job.id} failed (attempt ${job.attempts}): ${err}`);
    } finally {
      clearInterval(heartbeat);
    }
  }

  /** Recover interrupted work. Keep finished history available to the Admin audit workspace. */
  @Interval(5 * 60 * 1000)
  async housekeeping() {
    if (!env().JOBS_ENABLED) return;
    // A crashed outbound send can already have reached the provider. Exhausted jobs
    // require review rather than an automatic second delivery.
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Job" SET status = (CASE WHEN attempts >= "maxAttempts" THEN 'FAILED' ELSE 'PENDING' END)::"JobStatus",
        "lastError" = 'Worker interrupted; inspect provider status before retrying outbound delivery',
        "lockedAt" = NULL, "updatedAt" = timezone('UTC', now())
      WHERE status = 'RUNNING' AND "lockedAt" < timezone('UTC', now()) - interval '10 minutes'`);
  }

  stats() {
    return this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } });
  }
}
