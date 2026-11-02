import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { JobsService } from '../src/core/jobs/jobs.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import * as configuration from '../src/config/env';

/** Real Postgres claim transactions in a dedicated disposable schema; never touches other test jobs. */
describe('bounded import job capacity and lease ownership', () => {
  const admin = new PrismaClient();
  const schema = `job_capacity_${randomUUID().replace(/-/g, '')}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const services: JobsService[] = [],
    releases: (() => void)[] = [];
  let settings: jest.SpyInstance;
  const worker = () => {
    const service = new JobsService(db as unknown as PrismaService, { assertPath: async () => undefined } as never);
    services.push(service);
    return service;
  };
  const gate = () => {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    releases.push(release);
    return { promise, release };
  };
  const eventually = async (predicate: () => Promise<boolean> | boolean) => {
    const end = Date.now() + 4000;
    while (!(await predicate())) {
      if (Date.now() > end) throw new Error('Expected job state did not settle');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  const drain = async () => {
    // Async barrier only: assertions below use actual persisted jobs and handler effects.
    await Promise.all(services.flatMap((service) => [...(service as unknown as { heavyExecutions: Set<Promise<void>> }).heavyExecutions]));
  };
  beforeAll(async () => {
    if (!/^brokeriq_(?:release_test|test)/.test(new URL(process.env.DATABASE_URL!).pathname.slice(1))) throw new Error('Isolated test database required');
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await admin.$executeRawUnsafe(`CREATE TYPE "${schema}"."JobStatus" AS ENUM ('PENDING','RUNNING','DONE','FAILED')`);
    await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."Job" (LIKE public."Job" INCLUDING ALL)`);
    await admin.$executeRawUnsafe(
      `ALTER TABLE "${schema}"."Job" ALTER COLUMN status DROP DEFAULT, ALTER COLUMN status TYPE "${schema}"."JobStatus" USING status::text::"${schema}"."JobStatus", ALTER COLUMN status SET DEFAULT 'PENDING'`,
    );
    const [{ current_schema }] = await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`;
    expect(current_schema).toBe(schema);
    settings = jest.spyOn(configuration, 'env').mockReturnValue({ ...configuration.env(), JOBS_ENABLED: true });
  });
  afterEach(async () => {
    services.forEach((service) => service.onModuleDestroy());
    releases.splice(0).forEach((release) => release());
    await drain();
    services.splice(0);
    await db.job.deleteMany();
  });
  afterAll(async () => {
    settings?.mockRestore();
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  });

  it('claims only one import globally across simultaneous workers', async () => {
    const hold = gate();
    let started = 0;
    const a = worker(),
      b = worker();
    for (const service of [a, b])
      service.register('import.extract', async () => {
        started++;
        await hold.promise;
      });
    for (let i = 0; i < 8; i++) await a.enqueue('import.extract', {});
    await Promise.all([a.tick(), b.tick()]);
    await eventually(() => started === 1);
    expect(await db.job.count({ where: { type: 'import.extract', status: 'RUNNING' } })).toBe(1);
    expect(await db.job.count({ where: { type: 'import.extract', status: 'PENDING', attempts: 0 } })).toBe(7);
    hold.release();
    await drain();
    expect(await db.job.count({ where: { status: 'DONE' } })).toBe(1);
  });
  it('continues ordinary CRM batches while an import is still running', async () => {
    const hold = gate(),
      service = worker();
    let imported = 0,
      light = 0;
    service.register('import.extract', async () => {
      imported++;
      await hold.promise;
    });
    service.register('test.light', async () => {
      light++;
    });
    await service.enqueue('import.extract', {});
    for (let i = 0; i < 23; i++) await service.enqueue('test.light', {});
    await service.tick();
    await eventually(() => imported === 1);
    expect(light).toBe(10);
    await service.tick();
    expect(light).toBe(20);
    await service.tick();
    expect(light).toBe(23);
    expect(await db.job.count({ where: { type: 'import.extract', status: 'RUNNING' } })).toBe(1);
  });
  it('a scheduled future import neither starts early nor blocks due work', async () => {
    const service = worker(),
      hold = gate();
    const names: string[] = [];
    service.register('import.extract', async (p) => {
      names.push(p.name);
      await hold.promise;
    });
    const future = await service.enqueue('import.extract', { name: 'future' }, { runAt: new Date(Date.now() + 60000) });
    await service.enqueue('import.extract', { name: 'due' });
    await service.tick();
    await eventually(() => names.length === 1);
    expect(names).toEqual(['due']);
    expect(await db.job.findUniqueOrThrow({ where: { id: future.id } })).toMatchObject({ status: 'PENDING', attempts: 0 });
  });
  it('failure releases capacity while preserving backoff and attempt count', async () => {
    const service = worker();
    service.register('import.extract', async (p) => {
      if (p.fail) throw new Error('isolated extractor interruption');
    });
    const first = await service.enqueue('import.extract', { fail: true });
    await service.tick();
    await drain();
    const failed = await db.job.findUniqueOrThrow({ where: { id: first.id } });
    expect(failed).toMatchObject({ status: 'PENDING', attempts: 1, lockedAt: null });
    expect(failed.runAt.getTime()).toBeGreaterThan(Date.now());
    const next = await service.enqueue('import.extract', { fail: false });
    await service.tick();
    await drain();
    expect(await db.job.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({ status: 'DONE', attempts: 1 });
    expect(await db.job.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: 'PENDING', attempts: 1 });
  });
  it.each(['success', 'failure'])('an old %s completion cannot overwrite a later claim', async (outcome) => {
    const service = worker(),
      hold = gate();
    let started = false;
    service.register('import.extract', async () => {
      started = true;
      await hold.promise;
      if (outcome === 'failure') throw new Error('late old attempt');
    });
    const job = await service.enqueue('import.extract', {});
    await service.tick();
    await eventually(() => started);
    await db.job.update({ where: { id: job.id }, data: { attempts: 2, status: 'RUNNING', lastError: 'New worker owns this claim', lockedAt: new Date() } });
    hold.release();
    await drain();
    expect(await db.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      attempts: 2,
      status: 'RUNNING',
      lastError: 'New worker owns this claim',
    });
    // This simulated newer worker is not a live handler in this fixture.
    await db.job.update({ where: { id: job.id }, data: { status: 'DONE' } });
  });
  it.each(['PENDING', 'DONE', 'FAILED', 'STALE'] as const)('does not invoke a handler without the current RUNNING lease: %s', async (state) => {
    const service = worker(),
      handler = jest.fn().mockResolvedValue(undefined);
    service.register('test.light', handler);
    const job = await db.job.create({
      data: { type: 'test.light', runAt: new Date(), status: state === 'STALE' ? 'RUNNING' : state, attempts: state === 'STALE' ? 2 : 1 },
    });
    await (service as unknown as { execute: (value: typeof job) => Promise<void> }).execute({ ...job, attempts: 1 });
    expect(handler).not.toHaveBeenCalled();
    expect(await db.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: job.status, attempts: job.attempts });
  });
  it('a real periodic heartbeat keeps active imports out of stale recovery', async () => {
    const service = worker(),
      hold = gate();
    let started = false;
    service.register('import.extract', async () => {
      started = true;
      await hold.promise;
    });
    const job = await service.enqueue('import.extract', {});
    await service.tick();
    await eventually(() => started);
    await db.job.update({ where: { id: job.id }, data: { lockedAt: new Date(Date.now() - 11 * 60000) } });
    await new Promise((resolve) => setTimeout(resolve, 31000));
    const live = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(live.lockedAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
    await service.housekeeping();
    expect(await db.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'RUNNING', attempts: 1 });
  }, 45000);
  it('interrupted stale imports recover one at a time and exhausted sends remain failed', async () => {
    const service = worker(),
      hold = gate();
    let started = 0;
    service.register('import.extract', async () => {
      started++;
      await hold.promise;
    });
    const old = await db.job.create({
      data: {
        type: 'import.extract',
        runAt: new Date(Date.now() - 120000),
        status: 'RUNNING',
        attempts: 1,
        maxAttempts: 3,
        lockedAt: new Date(Date.now() - 11 * 60000),
      },
    });
    const sent = await db.job.create({
      data: { type: 'notification.push', runAt: new Date(), status: 'RUNNING', attempts: 1, maxAttempts: 1, lockedAt: new Date(Date.now() - 11 * 60000) },
    });
    await service.enqueue('import.extract', {});
    await service.tick();
    expect(started).toBe(0);
    await service.housekeeping();
    await service.tick();
    await eventually(() => started === 1);
    expect(await db.job.count({ where: { type: 'import.extract', status: 'RUNNING' } })).toBe(1);
    expect(await db.job.findUniqueOrThrow({ where: { id: sent.id } })).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(await db.job.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: 'RUNNING', attempts: 2 });
  });
});
