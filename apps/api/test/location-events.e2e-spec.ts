import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

/** Real PostgreSQL proves ordering, deduplication and firm boundaries. */
describe('Shift state transitions and offline location provenance', () => {
  let app: INestApplication;
  let db: PrismaService;
  let agent: { id: string; token: string };
  let other: { id: string; token: string };
  let shiftId: string;
  let capturedAt: string;
  const uid = Date.now().toString(36);
  const h = (user = agent) => ({ Authorization: 'Bearer ' + user.token });
  const coords = { latitude: 28.45, longitude: 77.02, accuracy: 15 };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    const org = await db.organization.create({ data: { name: 'Isolated tracking fixture', slug: 'tracking-' + uid, restrictions: [] } });
    const create = async (suffix: string) => {
      const user = await db.user.create({
        data: { name: suffix, email: suffix + uid + '@e2e.test', role: 'BROKER_AGENT', organizationId: org.id },
        include: { organization: true },
      });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    agent = await create('track-a');
    other = await create('track-b');
  });
  afterAll(async () => {
    await app?.close();
  });
  it('serializes simultaneous punch-ins into one active shift', async () => {
    const results = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/time-logging/punch-in').set(h()).send(coords)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    shiftId = results.find((r) => r.status === 201)!.body.shift.id;
    expect(await db.agentShift.count({ where: { userId: agent.id, status: 'ACTIVE' } })).toBe(1);
    // Backdate only the isolated fixture to exercise actual offline replay without sleeping.
    const start = new Date(Date.now() - 60_000);
    await db.agentShift.update({ where: { id: shiftId }, data: { punchInAt: start } });
    await db.shiftInterval.updateMany({ where: { shiftId }, data: { startTime: start } });
    capturedAt = new Date(Date.now() - 30_000).toISOString();
  });
  it('preserves original capture time and acknowledges retries without duplicate records', async () => {
    const payload = { ...coords, shiftId, capturedAt, eventId: uid + '-offline-1' };
    const results = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/time-logging/location').set(h()).send(payload).expect(201)));
    expect(results[0].body.locationId).toBe(results[1].body.locationId);
    const row = await db.shiftLocation.findUniqueOrThrow({ where: { id: results[0].body.locationId } });
    expect(row.capturedAt.toISOString()).toBe(capturedAt);
    expect(row.receivedAt.getTime()).toBeGreaterThan(row.capturedAt.getTime());
    expect(await db.shiftLocation.count({ where: { userId: agent.id, eventId: payload.eventId } })).toBe(1);
    await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...payload, longitude: 78 })
      .expect(409);
  });
  it('manual pause remains paused and does not store paused-period coordinates', async () => {
    await request(app.getHttpServer()).post('/api/time-logging/pause').set(h()).send({ shiftId, reason: 'MANUAL' }).expect(201);
    const result = await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt: new Date().toISOString(), eventId: uid + '-manual' })
      .expect(201);
    expect(result.body.ignored).toBe(true);
    expect(result.body.autoResumed).toBe(false);
    expect((await db.agentShift.findUniqueOrThrow({ where: { id: shiftId } })).status).toBe('PAUSED');
    expect(await db.shiftLocation.count({ where: { eventId: uid + '-manual' } })).toBe(0);
    const older = await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt, eventId: uid + '-delayed' })
      .expect(201);
    expect(older.body.locationId).toBeDefined();
    expect(older.body.autoResumed).toBe(false);
  });
  it('GPS restore can resume only a GPS pause; manual override supersedes the GPS pause', async () => {
    await request(app.getHttpServer()).post('/api/time-logging/resume').set(h()).send({ shiftId }).expect(201);
    await request(app.getHttpServer()).post('/api/time-logging/pause').set(h()).send({ shiftId, reason: 'GPS_SIGNAL_LOST' }).expect(201);
    const restore = await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt: new Date().toISOString(), eventId: uid + '-restored' })
      .expect(201);
    expect(restore.body.autoResumed).toBe(true);
    await request(app.getHttpServer()).post('/api/time-logging/pause').set(h()).send({ shiftId, reason: 'GPS_SIGNAL_LOST' }).expect(201);
    await request(app.getHttpServer()).post('/api/time-logging/pause').set(h()).send({ shiftId, reason: 'MANUAL' }).expect(201);
    const manual = await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt: new Date().toISOString(), eventId: uid + '-manual-override' })
      .expect(201);
    expect(manual.body.autoResumed).toBe(false);
    expect((await db.agentShift.findUniqueOrThrow({ where: { id: shiftId } })).pauseReason).toBe('MANUAL');
  });
  it('concurrent resume creates one open interval; punch-out is safely repeatable', async () => {
    await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/time-logging/resume').set(h()).send({ shiftId }).expect(201)));
    expect(await db.shiftInterval.count({ where: { shiftId, endTime: null } })).toBe(1);
    await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/time-logging/punch-out').set(h()).send({ shiftId }).expect(201)));
    expect(await db.shiftInterval.count({ where: { shiftId, endTime: null } })).toBe(0);
    const offline = await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt, eventId: uid + '-after-completed' })
      .expect(201);
    expect(offline.body.locationId).toBeDefined();
    expect(offline.body.status).toBe('COMPLETED');
  });
  it('denies foreign shifts, out-of-shift captures and invalid future timestamps', async () => {
    await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h(other))
      .send({ ...coords, shiftId, capturedAt })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt: '2020-01-01T00:00:00Z' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/time-logging/location')
      .set(h())
      .send({ ...coords, shiftId, capturedAt: new Date(Date.now() + 300_000).toISOString() })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/time-logging/history?agentId=' + agent.id)
      .set(h(other))
      .expect(403);
  });
});
