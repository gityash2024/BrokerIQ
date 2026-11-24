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
