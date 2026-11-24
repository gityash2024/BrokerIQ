import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ConnectService } from '../src/modules/connect/connect.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.CONNECT_ENABLED === 'true' && process.env.CONNECT_WHATSAPP_CUTOVER === 'true';
(enabled ? describe : describe.skip)('BrokerIQ Connect pilot and cutover', () => {
  let app: INestApplication;
  let db: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (accessToken: string) => ({ Authorization: 'Bearer ' + accessToken });

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
  });
  afterAll(async () => { await app?.close(); });

  it('enforces device consent and scope, deduplicates capture and keeps existing uploads resumable', async () => {
    const key = randomUUID();
    const makeAccount = async (name: string) => {
      const org = await db.organization.create({ data: { name, slug: name + '-' + key } });
      const user = await db.user.create({ data: { name, role: 'BROKER_ADMIN', organizationId: org.id, email: name + key + '@e2e.test' }, include: { organization: true } });
      return { user, headers: bearer((await app.get(AuthService).issue(user)).accessToken) };
    };
    const broker = await makeAccount('connect-owner');
    const outsider = await makeAccount('connect-outside');
    const policy = (await http().get('/api/connect/profile').set(broker.headers).expect(200)).body.policy;
    expect(policy).toEqual({ leads: false, inventory: false, survey: false });
    await http().patch('/api/connect/firm-policy').set(broker.headers).send({ ...policy, survey: true }).expect(200);
    await http().get('/api/connect/profile').set(broker.headers).expect(200).expect(({ body }) => expect(body.policy.survey).toBe(true));
    await http().get('/api/connect/profile').set(outsider.headers).expect(200).expect(({ body }) => expect(body.policy.survey).toBe(false));
    const group = 'b'.repeat(64);
    const event = { kind: 'WHATSAPP', capturedAt: new Date().toISOString(), packageName: 'com.whatsapp.w4b', group, text: '2 BHK in Sector 30' };
    const upload = { clientKey: key, fileName: 'known.zip', sourceType: 'CHAT_EXPORT', contentType: 'application/zip', target: 'AUTO', totalBytes: 400 };
    const prior = await db.importUpload.create({ data: { ...upload, organizationId: broker.user.organizationId!, createdById: broker.user.id } });
    await http().post('/api/imports/uploads').set(broker.headers).send({ ...upload, clientKey: randomUUID() }).expect(409);
    await http().post('/api/imports/uploads').set(broker.headers).send(upload).expect(201).expect(({ body }) => expect(body.id).toBe(prior.id));
    await http().post('/api/imports/uploads').set(outsider.headers).send(upload).expect(409);
    await http().get('/api/imports').set(broker.headers).expect(200);

    await http().post('/api/connect/events').set(broker.headers).send(event).expect(403);
    const device = (await http().post('/api/connect/devices').set(broker.headers).send({
      installId: randomUUID(), label: 'Test handset', version: 1,
    }).expect(201)).body;
    await http().get('/api/connect/directory').set(broker.headers).expect(403);
    await http().patch('/api/connect/settings').set(broker.headers).send({ consent: true, whatsapp: true, groups: [group] }).expect(200);
    await http().post('/api/connect/events').set(broker.headers).send(event).expect(403);
    const recent = { ...event, capturedAt: new Date(Date.now() + 20).toISOString() };
    const stored = (await http().post('/api/connect/events').set(broker.headers).send(recent).expect(201)).body;
    await http().post('/api/connect/events').set(broker.headers).send(recent).expect(201).expect(({ body }) => expect(body.id).toBe(stored.id));
    await http().get('/api/connect/events/' + stored.id).set(outsider.headers).expect(404);
    await db.connectEvent.update({ where: { id: stored.id }, data: { status: 'REVIEW' } });
    const reviewPath = '/api/connect/events/' + stored.id + '/review';
    await http().patch(reviewPath).set(outsider.headers).send({ decision: 'REVIEWED' }).expect(404);
    await http().patch(reviewPath).set(broker.headers).send({ decision: 'REVIEWED' }).expect(200);
    await http().patch(reviewPath).set(broker.headers).send({ decision: 'DISMISSED' }).expect(400);
    await http().delete('/api/connect/events/' + stored.id).set(outsider.headers).expect(404);
    await http().delete('/api/connect/events/' + stored.id).set(broker.headers).expect(200);
    await http().get('/api/connect/events/' + stored.id).set(broker.headers).expect(404);
    expect(await db.connectEvent.findUnique({ where: { id: stored.id } })).toMatchObject({ status: 'DELETED', encryptedInput: null, encryptedResult: null });
    const webHeaders = bearer((await app.get(AuthService).issue(broker.user)).accessToken);
    await http().delete('/api/connect/devices/' + device.id).set(webHeaders).expect(200);
    await http().get('/api/auth/me').set(broker.headers).expect(401);
    await http().get('/api/auth/me').set(webHeaders).expect(200);
  });

  it('returns only the connected agent’s currently authorized business calls and identifies the capture device', async () => {
    const key = randomUUID();
    const firm = await db.organization.create({ data: { name: 'Connect calls scope', slug: 'connect-calls-' + key } });
    const agent = await db.user.create({ data: { name: 'Call Agent', organizationId: firm.id, role: 'BROKER_AGENT',
      email: key + '@e2e.test' }, include: { organization: true } });
    const lead = await db.lead.create({ data: { name: 'Authorized lead', phone: '+919881188234', organizationId: firm.id, assignedToId: agent.id } });
    const session = () => app.get(AuthService).issue(agent).then(({ accessToken }) => bearer(accessToken));
    const first = await session();
    const second = await session();
    const web = await session();
    await http().get('/api/connect/calls').set(web).expect(403);
    for (const headers of [first, second]) {
      await http().post('/api/connect/devices').set(headers).send({ installId: randomUUID(), label: 'Call handset', version: 2 }).expect(201);
      await http().patch('/api/connect/settings').set(headers).send({ consent: true, calls: true, recordings: true }).expect(200);
    }
    const event = { capturedAt: new Date(Date.now() + 25).toISOString(), leadId: lead.id, kind: 'CALL',
      number: lead.phone, direction: 'INBOUND', outcome: 'COMPLETED', durationSec: 42 };
    const sent = (await http().post('/api/connect/events').set(first).send(event).expect(201)).body;
    const row = { id: sent.callId, leadName: lead.name, number: lead.phone, direction: 'inbound', status: 'completed',
      durationSec: 42, processingStatus: 'SAVED' };
    await http().get('/api/connect/calls').set(first).expect(200)
      .expect(({ body }) => expect(body.items).toMatchObject([{ ...row, sameDevice: true }]));
    await http().get('/api/connect/calls').set(second).expect(200)
      .expect(({ body }) => expect(body.items).toMatchObject([{ ...row, sameDevice: false }]));
    await db.lead.update({ where: { id: lead.id }, data: { assignedToId: null } });
    for (const path of ['/api/connect/calls', '/api/connect/events']) {
      await http().get(path).set(first).expect(200).expect(({ body }) => expect(body.items).toEqual([]));
    }
  });

  it('applies explicit firm retention and atomically queues private media deletion only for expired captures', async () => {
    const key = randomUUID();
    const setup = async (suffix: string) => {
      const org = await db.organization.create({ data: { name: suffix, slug: suffix + '-' + key } });
      const user = await db.user.create({ data: { name: suffix, organizationId: org.id, role: 'BROKER_ADMIN',
        email: suffix + '.' + key + '@e2e.test' }, include: { organization: true } });
      const headers = bearer((await app.get(AuthService).issue(user)).accessToken);
      const device = (await http().post('/api/connect/devices').set(headers).send({ installId: randomUUID(), label: suffix, version: 3 }).expect(201)).body;
      return { org, device, user, headers };
    };
    const firm = await setup('connect-retention');
    const outside = await setup('connect-retention-outside');
    const now = new Date();
    const add = (account: typeof firm, daysAgo: number, recordingKey?: string) => db.connectEvent.create({ data: {
      organizationId: account.org.id, deviceId: account.device.id, userId: account.user.id, fingerprint: randomUUID(), kind: 'RECORDING',
      status: 'REVIEW', encryptedInput: 'protected', encryptedResult: 'protected', recordingKey,
      capturedAt: new Date(now.valueOf() - daysAgo * 86_400_000),
    } });
    const [expired, kept, foreign] = await Promise.all([add(firm, 31, 'connect-private-capture'), add(firm, 29), add(outside, 31)]);
    const svc = app.get(ConnectService);
    await svc['expireCaptures'](firm.org.id, now);
    expect(await db.connectEvent.findUnique({ where: { id: expired.id } })).toMatchObject({ status: 'REVIEW' });
    await http().patch('/api/connect/firm-policy').set(firm.headers).send({ retentionDays: 7 }).expect(400);
    await http().patch('/api/connect/firm-policy').set(firm.headers).send({ retentionDays: 30 }).expect(200);
    // An older app editing its three toggle values leaves the retention period intact.
    await http().patch('/api/connect/firm-policy').set(firm.headers).send({ leads: true, inventory: false, survey: false }).expect(200)
      .expect(({ body }) => expect(body.retentionDays).toBe(30));
    await Promise.all([svc['expireCaptures'](firm.org.id, now), svc['expireCaptures'](firm.org.id, now)]);
    expect(await db.connectEvent.findUnique({ where: { id: expired.id } })).toMatchObject({ status: 'DELETED', encryptedInput: null, encryptedResult: null });
    for (const id of [kept.id, foreign.id]) expect(await db.connectEvent.findUnique({ where: { id } })).toMatchObject({ status: 'REVIEW' });
    expect(await db.job.count({ where: { key: 'connect-purge:' + expired.id, type: 'connect.purge' } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'connect.event.retention', entityId: expired.id } })).toBe(1);
  });

  it('fills only empty fields on an unverified scoped Survey draft and records the previous value', async () => {
    const key = randomUUID();
    const firm = await db.organization.create({ data: { name: 'Connect survey scope', slug: 'connect-survey-' + key } });
    const agent = await db.user.create({ data: { name: 'Survey agent', organizationId: firm.id, role: 'BROKER_AGENT', email: key + '@e2e.test' } });
    const lead = await db.lead.create({ data: { name: 'Survey lead', phone: '+919881188233', organizationId: firm.id, assignedToId: agent.id } });
    const draft = await db.inventoryItem.create({ data: {
      organizationId: firm.id, createdById: agent.id, assignedToId: agent.id, address: '34 Crown Court', floor: 'First floor', sourceType: 'SURVEY',
    } });
    await db.siteVisit.create({ data: { organizationId: firm.id, leadId: lead.id, inventoryId: draft.id, scheduledAt: new Date() } });
    const row = { id: key, organizationId: firm.id, leadId: lead.id, userId: agent.id };
    const evidence = '34 Crown Court is a 3 BHK for rent on the 2nd floor.';
    const proposal = { address: draft.address!, summary: evidence, evidence, purpose: 'RENT' as const, bedrooms: 3, floor: '2', intent: 'OFFER' as const,
      confidence: 97, objections: [], commitments: [], preferences: [], nextSteps: [] };
    const service = app.get(ConnectService);
    const suggestions = await db.$transaction((tx) => service['surveySuggestions'](tx, row, proposal, evidence, true));
    expect(suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'bhk', previous: null, proposed: 3, conflict: false, applied: true }),
      expect.objectContaining({ field: 'floor', previous: 'First floor', proposed: '2', conflict: true, applied: false }),
    ]));
    expect(await db.inventoryItem.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({
      bhk: 3, purpose: 'RENT', floor: 'First floor', revision: 2,
    });
    await db.lead.update({ where: { id: lead.id }, data: { assignedToId: null } });
    expect(await db.$transaction((tx) => service['surveySuggestions'](tx, row, proposal, evidence, true))).toEqual([]);
  });

});
