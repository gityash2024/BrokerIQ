import { PrismaClient } from '@prisma/client';
import { JobsService } from '../src/core/jobs/jobs.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import * as configuration from '../src/config/env';
import { randomUUID } from 'node:crypto';

describe('PostgreSQL job recovery', () => {
  const prisma = new PrismaClient();

  afterAll(() => prisma.$disconnect());

  it('atomically enqueues one durable job across concurrent first-key requests and never resets running delivery', async () => {
    const key = `isolated-concurrent:${randomUUID()}`;
    const service = new JobsService(prisma as unknown as PrismaService, {} as never);
    try {
      const queued = await Promise.all(Array.from({ length: 30 }, () => service.enqueue('visit.reminder', { marker: 'original' }, { key, maxAttempts: 1 })));
      expect(new Set(queued.map((job) => job.id)).size).toBe(1);
      expect(await prisma.job.count({ where: { key } })).toBe(1);
      await prisma.job.update({ where: { key }, data: { status: 'RUNNING', attempts: 1, lockedAt: new Date() } });
      await service.enqueue('visit.reminder', { marker: 'replacement' }, { key, repeat: true });
      expect(await prisma.job.findUniqueOrThrow({ where: { key } })).toMatchObject({ status: 'RUNNING', attempts: 1, payload: { marker: 'original' } });
      await prisma.job.update({ where: { key }, data: { status: 'DONE' } });
      const repeated = await service.enqueue('visit.reminder', { marker: 'next' }, { key, repeat: true });
      expect(repeated).toMatchObject({ id: queued[0].id, status: 'PENDING', attempts: 0, lockedAt: null, payload: { marker: 'next' } });
    } finally {
      await prisma.job.deleteMany({ where: { key } });
    }
  });

  it('recovers stale locks, holds exhausted delivery attempts and preserves fresh work', async () => {
    const settings = configuration.env();
    const spy = jest.spyOn(configuration, 'env').mockReturnValue({ ...settings, JOBS_ENABLED: true });
    const rollback = new Error('rollback isolated recovery fixtures');
    try {
      await expect(
        prisma.$transaction(async (tx) => {
          // Prisma timestamp columns and the deployed queue use UTC.
          await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
          const create = (data: Record<string, unknown>) =>
            tx.job.create({
              data: {
                type: 'test.housekeeping',
                status: 'RUNNING',
                attempts: 1,
                maxAttempts: 3,
                lockedAt: new Date(Date.now() - 11 * 60_000),
                ...data,
              },
            });
          const retry = await create({});
          const exhausted = await create({ attempts: 3 });
          const fresh = await create({ lockedAt: new Date() });
          const pending = await create({ status: 'PENDING', lockedAt: null });
          const oldDone = await create({ status: 'DONE', updatedAt: new Date(Date.now() - 8 * 86_400_000) });
          const recentDone = await create({ status: 'DONE' });
          const service = new JobsService(tx as unknown as PrismaService, {} as never);

          await service.housekeeping();

          expect(await tx.job.findUniqueOrThrow({ where: { id: retry.id } })).toMatchObject({
            status: 'PENDING',
            attempts: 1,
            lockedAt: null,
            lastError: 'Worker interrupted; inspect provider status before retrying outbound delivery',
          });
          expect(await tx.job.findUniqueOrThrow({ where: { id: exhausted.id } })).toMatchObject({ status: 'FAILED', attempts: 3, lockedAt: null });
          expect(await tx.job.findUniqueOrThrow({ where: { id: fresh.id } })).toMatchObject({ status: 'RUNNING', lockedAt: fresh.lockedAt });
          expect(await tx.job.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ status: 'PENDING', lastError: null });
          expect(await tx.job.findUniqueOrThrow({ where: { id: oldDone.id } })).toMatchObject({ status: 'DONE' });
          expect(await tx.job.findUniqueOrThrow({ where: { id: recentDone.id } })).toMatchObject({ status: 'DONE' });
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    } finally {
      spy.mockRestore();
    }
  });
});
