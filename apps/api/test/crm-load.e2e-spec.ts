import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

// Deliberately opt-in. env-setup rejects non-test databases before fixtures are written.
(process.env.RUN_CRM_LOAD === 'true' ? describe : describe.skip)('20 authenticated CRM sessions, real PostgreSQL', () => {
  let app: INestApplication, db: PrismaService, org: string;
  const actors: { id: string; token: string; refreshToken: string; leadId: string; inventoryId: string }[] = [];
  const stamp = randomUUID().slice(0, 8);
  const samples = { list: [] as number[], detail: [] as number[], mutation: [] as number[], refresh: [] as number[] };
  let rounds = 0;
  const http = () => request(app.getHttpServer());
  const headers = (actor: (typeof actors)[number]) => ({ Authorization: 'Bearer ' + actor.token });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Isolated CRM load fixture', slug: 'crm-load-' + stamp } })).id;
    for (let index = 0; index < 20; index++) {
      const user = await db.user.create({
        data: { name: 'Load session ' + index, email: `${index}.${stamp}@load.e2e.test`, role: index === 0 ? 'BROKER_ADMIN' : 'BROKER_AGENT', organizationId: org },
        include: { organization: true },
      });
      const auth = await app.get(AuthService).issue(user);
      const leads = await db.lead.createManyAndReturn({ data: Array.from({ length: 20 }, (_, n) => ({ organizationId: org, assignedToId: user.id, name: `Session ${index} lead ${n}`, phone: `+9198${String(index).padStart(2, '0')}${String(n).padStart(6, '0')}` })) });
      const properties = await db.inventoryItem.createManyAndReturn({ data: Array.from({ length: 50 }, (_, n) => ({ organizationId: org, assignedToId: user.id, createdById: user.id, sector: 'Sector 45', houseNo: `${index}-${n}`, purpose: 'RENT', monthlyRent: 25000, availability: 'UNKNOWN' })) });
      actors.push({ id: user.id, token: auth.accessToken, refreshToken: auth.refreshToken, leadId: leads[0].id, inventoryId: properties[0].id });
    }
  }, 120_000);
  afterAll(async () => { await app?.close(); });

  async function measured<T>(kind: keyof typeof samples, run: () => Promise<T>) {
    const started = performance.now();
    const result = await run();
    samples[kind].push(performance.now() - started);
    return result;
  }
  async function round(write: boolean, refresh: boolean) {
    await Promise.all(actors.map(async (actor, index) => {
      if (refresh) {
        const result = await measured('refresh', () => http().post('/api/auth/refresh').send({ refreshToken: actor.refreshToken }).expect(200));
        actor.token = result.body.accessToken;
        actor.refreshToken = result.body.refreshToken;
      }
      const leads = await measured('list', () => http().get('/api/leads?pageSize=30').set(headers(actor)).expect(200));
      const inventory = await measured('list', () => http().get('/api/inventory?pageSize=30').set(headers(actor)).expect(200));
      if (index !== 0) {
        expect(leads.body.items.every((row: { assignedToId: string }) => row.assignedToId === actor.id)).toBe(true);
        expect(inventory.body.items.every((row: { assignedToId: string }) => row.assignedToId === actor.id)).toBe(true);
      }
      const detail = await measured('detail', () => http().get('/api/leads/' + actor.leadId).set(headers(actor)).expect(200));
      expect(detail.body.id).toBe(actor.leadId);
      if (write) await measured('mutation', () => http().post('/api/follow-ups').set(headers(actor)).send({ leadId: actor.leadId, type: 'CALL', dueAt: new Date(Date.now() + 86400_000).toISOString(), clientMutationId: randomUUID(), note: 'Isolated load acceptance' }).expect(201));
    }));
    rounds++;
  }
  const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] ?? null;
  function report(kind: string, elapsedSeconds: number) {
    const summary = Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, { requests: values.length, p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), maxMs: values.length ? Math.max(...values) : null }]));
    console.log(JSON.stringify({ kind, environment: 'ISOLATED_LOCAL_NEST_POSTGRESQL', concurrentSessions: actors.length, rounds, elapsedSeconds, summary, stagingAcceptance: false, providerOrDeviceAcceptance: false }));
    expect(percentile(samples.list, .95)).toBeLessThanOrEqual(1000);
    expect(percentile(samples.detail, .95)).toBeLessThanOrEqual(2000);
    expect(percentile(samples.mutation, .95)).toBeLessThanOrEqual(2000);
  }
  it('measures populated list/detail/save requests and checks current Agent ownership under concurrency', async () => {
    const started = performance.now();
    for (let n = 0; n < 5; n++) await round(true, n === 0);
    expect(await db.followUp.count({ where: { organizationId: org } })).toBe(100);
    report('CRM_LOAD', (performance.now() - started) / 1000);
  }, 120_000);

  (process.env.RUN_CRM_SOAK === 'true' ? it : it.skip)('runs the representative two-hour read/write/refresh soak without starting providers', async () => {
    const started = performance.now();
    let nextWrite = 0, nextRefresh = 0;
    while (performance.now() - started < 7200_000) {
      const elapsed = performance.now() - started;
      await round(elapsed >= nextWrite, elapsed >= nextRefresh);
      if (elapsed >= nextWrite) nextWrite = elapsed + 60_000;
      if (elapsed >= nextRefresh) nextRefresh = elapsed + 600_000;
      // Preserve the real per-IP rate limit: all twenty test sessions share loopback.
      // Ten-second polling also leaves headroom for the initial five-journey burst.
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    report('CRM_TWO_HOUR_SOAK', (performance.now() - started) / 1000);
  }, 7320_000);
});
