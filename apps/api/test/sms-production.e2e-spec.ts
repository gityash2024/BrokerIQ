import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID, createHmac } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { MessagingService } from '../src/modules/messaging/messaging.service';

/** Real API/guards/PostgreSQL/jobs; Textbee HTTP boundary is stubbed, not live SMS acceptance. */
describe('SMS production contracts (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, settings: SettingsService, service: MessagingService;
  let org: string, foreign: string, lead: string, conversationId: string, key: string;
  let agent: any, peer: any, admin: any, outsider: any;
  const uid = Date.now().toString(36),
    device = Date.now().toString(16).padStart(24, '0'),
    subscription = '234567890123456789012345',
    secret = 'isolated-sms-webhook-secret';
  const cfg = {
    apiKey: 'isolated-provider-api-key',
    deviceId: device,
    senderPhone: '+919899980802',
    simSubscriptionId: 4,
    webhookSecret: secret,
    webhookSubscriptionId: subscription,
    inboundEnabled: true,
  };
  const h = (u = agent) => ({ Authorization: 'Bearer ' + u.token });
  const api = () => request(app.getHttpServer());
  const send = async (text = 'Isolated appointment', requestId = randomUUID()) =>
    (await api().post('/api/messaging/sms/send').set(h()).send({ conversationId, text, requestId }).expect(201)).body;
  const event = (type: string, extra: any = {}) => ({
    smsId: '345678901234567890123456',
    deviceId: device,
    webhookSubscriptionId: subscription,
    idempotencyKey: randomUUID(),
    webhookEvent: type,
    message: 'Isolated client reply',
    simUsed: { subscriptionId: 4 },
    ...extra,
  });
  const callback = async (body: any, status = 200, signature?: string) => {
    const raw = JSON.stringify(body);
    const result = await api()
      .post('/api/webhooks/textbee/' + key)
      .set('Content-Type', 'application/json')
      .set('X-Signature', signature ?? createHmac('sha256', secret).update(raw).digest('hex'))
      .send(raw)
      .expect(status);
    if (result.body.ok) {
      const saved = await db.webhookEvent.findUniqueOrThrow({
        where: { provider_externalId: { provider: 'textbee', externalId: `${org}:${body.idempotencyKey}` } },
      });
      await service.processEvent(saved.id);
    }
    return result;
  };
  const provider = () =>
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (url: any) =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            data: String(url).endsWith('/send-sms')
              ? { success: true, smsBatchId: randomUUID().replace(/-/g, '').slice(0, 24) }
              : { _id: device, enabled: true, simInfo: { sims: [{ subscriptionId: 4 }] } },
          }),
        }) as Response,
    );
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    settings = app.get(SettingsService);
    service = app.get(MessagingService);
    const firm = await db.organization.create({ data: { name: 'Isolated SMS fixture', slug: 'sms-' + uid, restrictions: [] } });
    org = firm.id;
    key = firm.webhookKey;
    foreign = (await db.organization.create({ data: { name: 'Other SMS fixture', slug: 'sms-other-' + uid, restrictions: [] } })).id;
    const actor = async (name: string, role: 'BROKER_AGENT' | 'BROKER_ADMIN', organizationId = org) => {
      const user = await db.user.create({ data: { name, email: name + uid + '@e2e.test', role, organizationId }, include: { organization: true } });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    agent = await actor('sms-agent', 'BROKER_AGENT');
    peer = await actor('sms-peer', 'BROKER_AGENT');
    admin = await actor('sms-admin', 'BROKER_ADMIN');
    outsider = await actor('sms-other', 'BROKER_ADMIN', foreign);
    lead = (
      await db.lead.create({
        data: { organizationId: org, assignedToId: agent.id, name: 'Isolated SMS lead', phone: '+919700000301', source: 'MANUAL', tags: [], scoreReasons: [] },
      })
    ).id;
    await settings.save('textbee', { fields: cfg }, { orgId: org, userId: admin.id });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  it('encrypts secrets and forbids platform SIM inheritance/device sharing', async () => {
    const raw = await db.orgSetting.findUniqueOrThrow({ where: { organizationId_key: { organizationId: org, key: 'integration.textbee' } } });
    expect(JSON.stringify(raw.value)).not.toContain(cfg.apiKey);
    expect(JSON.stringify(raw.value)).not.toContain(secret);
    expect(await settings.resolveOrganizationOnly('textbee', foreign)).toBeNull();
    await expect(settings.save('textbee', { fields: cfg }, { orgId: foreign })).rejects.toMatchObject({ code: 'P2002' });
    await expect(settings.save('textbee', { fields: cfg }, {})).rejects.toThrow('one firm');
    await api().patch('/api/broker/connectors/textbee').set(h()).send({ fields: cfg }).expect(403);
    const savedView = await api().patch('/api/broker/connectors/textbee').set(h(admin)).send({ fields: cfg }).expect(200);
    expect(savedView.body.fields.apiKey).not.toBe(cfg.apiKey);
    await api().get('/api/broker/connectors').set(h()).expect(403);
    const status = await api().get('/api/messaging/status').set(h()).expect(200);
    expect(status.body.sms.configured).toBe(true);
    expect(status.body.sms.webhookUrl).toBeUndefined();
  });
  it('resolves owned lead once and denies other assignments/firm without widening Housing WhatsApp', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => api().post('/api/messaging/resolve-lead').set(h()).send({ channel: 'SMS', leadId: lead }).expect(201)),
    );
    expect(new Set(results.map((r) => r.body.conversationId)).size).toBe(1);
    conversationId = results[0].body.conversationId;
    await api().post('/api/messaging/resolve-lead').set(h(peer)).send({ channel: 'SMS', leadId: lead }).expect(404);
    await api().post('/api/messaging/resolve-lead').set(h(outsider)).send({ channel: 'SMS', leadId: lead }).expect(424);
    expect((await api().get('/api/whatsapp/conversations?channel=SMS').set(h()).expect(200)).body.map((r: any) => r.id)).toContain(conversationId);
    expect((await api().get('/api/whatsapp/conversations?channel=SMS').set(h(peer)).expect(200)).body).toHaveLength(0);
    expect((await api().get('/api/whatsapp/conversations').set(h()).expect(200)).body.map((r: any) => r.id)).not.toContain(conversationId);
    await api().get(`/api/whatsapp/conversations/${conversationId}/messages`).set(h(peer)).expect(403);
  });
  it('deduplicates concurrent sends/worker dispatch and accepts delivery without status regression', async () => {
    const requestId = randomUUID();
    const results = await Promise.all([1, 2, 3].map(() => send('Isolated duplicate', requestId)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    const id = results[0].id;
    expect(await db.job.count({ where: { key: 'sms-dispatch:' + id } })).toBe(1);
    const queued = await db.job.findUniqueOrThrow({ where: { key: 'sms-dispatch:' + id } });
    expect(Math.abs(queued.runAt.getTime() - Date.now())).toBeLessThan(10_000);
    const fetch = provider();
    await Promise.all([service.dispatch(id), service.dispatch(id)]);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/send-sms'))).toHaveLength(1);
    const saved = await db.message.findUniqueOrThrow({ where: { id } });
    expect(saved.status).toBe('QUEUED');
    expect(saved.providerBatchId).toBeTruthy();
    expect(await db.activity.count({ where: { leadId: lead, type: 'SMS', content: { startsWith: 'SMS queued' } } })).toBe(1);
    await api().post('/api/messaging/sms/send').set(h()).send({ conversationId, text: 'Changed text', requestId }).expect(409);
    await callback(event('MESSAGE_DELIVERED', { smsBatchId: saved.providerBatchId, deliveredAt: new Date().toISOString() }));
    await callback(event('MESSAGE_SENT', { smsBatchId: saved.providerBatchId, sentAt: new Date(Date.now() - 1000).toISOString() }));
    expect((await db.message.findUniqueOrThrow({ where: { id } })).status).toBe('DELIVERED');
  });
  it('blocks a queued send after reassignment', async () => {
    const queued = await send();
    await db.lead.update({ where: { id: lead }, data: { assignedToId: peer.id } });
    const fetch = provider();
    await service.dispatch(queued.id);
    expect(fetch).not.toHaveBeenCalled();
    expect((await db.message.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe('FAILED');
    await api().post('/api/messaging/sms/send').set(h()).send({ conversationId, text: 'Forbidden', requestId: randomUUID() }).expect(404);
    await db.lead.update({ where: { id: lead }, data: { assignedToId: agent.id } });
  });
  it('shows uncertain provider status without inventing failure and accepts a later delivery', async () => {
    const smsId = randomUUID().replace(/-/g, '').slice(0, 24);
    const queued = await send('Isolated unknown delivery');
    provider();
    await service.dispatch(queued.id);
    const saved = await db.message.findUniqueOrThrow({ where: { id: queued.id } });
    await callback(event('UNKNOWN_STATE', { smsId, smsBatchId: saved.providerBatchId }));
    const uncertain = await db.message.findUniqueOrThrow({ where: { id: queued.id } });
    expect(uncertain.status).toBe('QUEUED');
    expect(uncertain.error).toContain('unconfirmed');
    expect((uncertain.meta as any).dispatch).toBe('UNCERTAIN');
    await callback(event('MESSAGE_DELIVERED', { smsId, smsBatchId: saved.providerBatchId, deliveredAt: new Date().toISOString() }));
    await callback(event('UNKNOWN_STATE', { smsId, smsBatchId: saved.providerBatchId }));
    const delivered = await db.message.findUniqueOrThrow({ where: { id: queued.id } });
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.error).toBeNull();
  });
  it('never automatically retries an uncertain timeout', async () => {
    const queued = await send('Uncertain isolated message');
    const fetch = provider();
    fetch.mockImplementation(async (url: any) => {
      if (String(url).endsWith('/send-sms')) throw new Error('timeout secret');
      return { ok: true, status: 200, json: async () => ({ data: { _id: device, enabled: true, simInfo: { sims: [{ subscriptionId: 4 }] } } }) } as Response;
    });
    await service.dispatch(queued.id);
    await service.dispatch(queued.id);
    const saved = await db.message.findUniqueOrThrow({ where: { id: queued.id } });
    expect((saved.meta as any).dispatch).toBe('UNCERTAIN');
    expect(saved.error).not.toContain('secret');
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/send-sms'))).toHaveLength(1);
  });
  it('validates signature/SIM, deduplicates inbound and never stores unknown sender or OTP content', async () => {
    const receivedAt = new Date();
    await db.lead.update({ where: { id: lead }, data: { lastActivityAt: new Date(0) } });
    const inbound = event('MESSAGE_RECEIVED', { smsId: '567890123456789012345678', sender: '+919700000301', receivedAt: receivedAt.toISOString() });
    await callback(inbound, 403, '0'.repeat(64));
    await callback({ ...inbound, deviceId: '999999999999999999999999' }, 403);
    await callback(inbound);
    await callback(inbound);
    expect(await db.message.count({ where: { conversationId, direction: 'INBOUND' } })).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).lastActivityAt).toEqual(receivedAt);
    expect((await db.activity.findFirstOrThrow({ where: { leadId: lead, content: { startsWith: 'SMS received' } } })).createdAt).toEqual(receivedAt);
    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversationId } })).unreadCount).toBe(1);
    const notes = await db.notification.findMany({ where: { kind: 'SMS', link: `/broker/inbox?channel=SMS&c=${conversationId}` } });
    expect(notes.map((note) => note.userId).sort()).toEqual([agent.id, admin.id].sort());
    expect(notes.every((note) => !note.body?.includes('Isolated client reply'))).toBe(true);
    expect(await db.job.count({ where: { key: { startsWith: 'sms-notify:' }, payload: { path: ['orgId'], equals: org } } })).toBe(1);
    for (const extra of [{ sender: '+919700000399' }, { message: 'Your OTP is 123456' }, { simUsed: { subscriptionId: 99 } }]) {
      const bad = { ...inbound, idempotencyKey: randomUUID(), smsId: '999999999999999999999999', ...extra };
      expect((await callback(bad)).body.ignored).toBe(true);
      expect(await db.webhookEvent.count({ where: { provider: 'textbee', externalId: `${org}:${bad.idempotencyKey}` } })).toBe(0);
    }
    await api()
      .post('/api/whatsapp/conversations/' + conversationId + '/read')
      .set(h())
      .send({})
      .expect(200);
    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversationId } })).unreadCount).toBe(0);
    const latest = new Date(receivedAt.getTime() + 60_000);
    await db.lead.update({ where: { id: lead }, data: { lastActivityAt: latest } });
    await callback({
      ...inbound,
      idempotencyKey: randomUUID(),
      smsId: '678901234567890123456789',
      receivedAt: new Date(receivedAt.getTime() - 60_000).toISOString(),
    });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).lastActivityAt).toEqual(latest);
  });
  it('pages the complete message trail including equal timestamps and rejects foreign cursors', async () => {
    const at = new Date('2026-10-01T10:00:00Z');
    await db.message.createMany({
      data: Array.from({ length: 123 }, (_, i) => ({ conversationId, direction: 'OUTBOUND' as const, body: `Isolated page ${i}`, createdAt: at })),
    });
    const expected = await db.message.count({ where: { conversationId } });
    const ids: string[] = [];
    let cursor = '';
    do {
      const page = (
        await api()
          .get(`/api/whatsapp/conversations/${conversationId}/messages${cursor ? '?cursor=' + cursor : ''}`)
          .set(h())
          .expect(200)
      ).body;
      ids.push(...page.items.map((m: any) => m.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(expected);
    expect(new Set(ids).size).toBe(expected);
    await api().get(`/api/whatsapp/conversations/${conversationId}/messages?cursor=unrelated`).set(h()).expect(400);
  });
});
