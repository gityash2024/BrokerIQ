import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { IntegrationNotConfiguredException } from '../src/common/exceptions';

/** Real guards and PostgreSQL; provider credentials are stubbed. No outbound provider acceptance claim. */
describe('Internal lead composer and conversation ownership', () => {
  let app: INestApplication, db: PrismaService, wa: WhatsAppService;
  let creds: jest.SpyInstance;
  let org: string, lead: string, peerLead: string, conversationId: string;
  let agent: { id: string; token: string }, peer: { id: string; token: string }, outsider: { id: string; token: string }, admin: { id: string; token: string };
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const h = (actor = agent) => ({ Authorization: 'Bearer ' + actor.token });
  const req = () => request(app.getHttpServer());
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    wa = app.get(WhatsAppService);
    creds = jest.spyOn(wa, 'requireCreds').mockResolvedValue({ scope: 'organization', values: {} });
    org = (await db.organization.create({ data: { name: 'Isolated inbox fixture', slug: 'inbox-' + uid, restrictions: [] } })).id;
    const foreign = (await db.organization.create({ data: { name: 'Foreign inbox fixture', slug: 'inbox-other-' + uid, restrictions: [] } })).id;
    const actor = async (name: string, role: 'BROKER_AGENT' | 'BROKER_ADMIN', organizationId = org) => {
      const user = await db.user.create({ data: { name, role, organizationId, email: name + uid + '@e2e.test' }, include: { organization: true } });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    agent = await actor('a', 'BROKER_AGENT');
    peer = await actor('b', 'BROKER_AGENT');
    admin = await actor('admin', 'BROKER_ADMIN');
    outsider = await actor('foreign', 'BROKER_ADMIN', foreign);
    lead = (
      await db.lead.create({
        data: { organizationId: org, assignedToId: agent.id, name: 'Manual lead', phone: '+919700000201', source: 'MANUAL', scoreReasons: [], tags: [] },
      })
    ).id;
    peerLead = (
      await db.lead.create({ data: { organizationId: org, assignedToId: peer.id, name: 'Peer lead', phone: '+919700000202', scoreReasons: [], tags: [] } })
    ).id;
  });
  afterAll(async () => {
    creds?.mockRestore();
    await app?.close();
  });
  it('opens one internal conversation on retries without sending or broadening Housing inbox', async () => {
    const responses = await Promise.all([1, 2, 3].map(() => req().post('/api/whatsapp/resolve-lead').set(h()).send({ leadId: lead }).expect(201)));
    expect(new Set(responses.map((r) => r.body.conversationId)).size).toBe(1);
    conversationId = responses[0].body.conversationId;
    expect(await db.message.count({ where: { conversationId } })).toBe(0);
    await req().get(`/api/whatsapp/conversations/${conversationId}/messages`).set(h()).expect(200);
    expect((await req().get('/api/whatsapp/conversations').set(h()).expect(200)).body.map((r: any) => r.id)).not.toContain(conversationId);
  });
  it('does not expose another assignee, another firm or deleted lead', async () => {
    await req().post('/api/whatsapp/resolve-lead').set(h(peer)).send({ leadId: lead }).expect(404);
    await req().post('/api/whatsapp/resolve-lead').set(h(outsider)).send({ leadId: lead }).expect(404);
    await req().get(`/api/whatsapp/conversations/${conversationId}/messages`).set(h(peer)).expect(403);
    await db.lead.update({ where: { id: lead }, data: { deletedAt: new Date() } });
    await req().get(`/api/whatsapp/conversations/${conversationId}/messages`).set(h()).expect(403);
    await db.lead.update({ where: { id: lead }, data: { deletedAt: null } });
  });
  it('returns a settings-linked integration error and creates no fake success', async () => {
    creds.mockRejectedValueOnce(new IntegrationNotConfiguredException('whatsapp'));
    const result = await req().post('/api/whatsapp/resolve-lead').set(h(peer)).send({ leadId: peerLead }).expect(424);
    expect(result.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(result.body.integration.settingsPath).toContain('/broker/connectors');
    expect(await db.conversation.count({ where: { leadId: peerLead } })).toBe(0);
  });
  it('keeps unlinked historical conversations admin-reviewed and does not rebind another lead', async () => {
    const old = await db.conversation.create({ data: { organizationId: org, channel: 'WHATSAPP', contactKey: '919700000202', contactPhone: '+919700000202' } });
    await req().post('/api/whatsapp/resolve-lead').set(h(peer)).send({ leadId: peerLead }).expect(403);
    const reviewed = await req().post('/api/whatsapp/resolve-lead').set(h(admin)).send({ leadId: peerLead }).expect(201);
    expect(reviewed.body.conversationId).toBe(old.id);
    const duplicate = await db.lead.create({
      data: { organizationId: org, assignedToId: agent.id, name: 'Same number', phone: '9700000202', scoreReasons: [], tags: [] },
    });
    await req().post('/api/whatsapp/resolve-lead').set(h()).send({ leadId: duplicate.id }).expect(409);
    await expect(wa.conversationFor(org, '+919700000202', { leadId: duplicate.id })).rejects.toThrow('another lead');
    expect((await db.conversation.findUniqueOrThrow({ where: { id: old.id } })).leadId).toBe(peerLead);
  });
  it('rejects crossed lead/channel sends and blocked conversations before provider calls', async () => {
    await req().post('/api/whatsapp/send').set(h(admin)).send({ conversationId, leadId: peerLead, text: 'must not send' }).expect(400);
    const chat = await db.conversation.create({
      data: { organizationId: org, leadId: lead, channel: 'CHAT', contactKey: 'site-' + uid, contactPhone: '+919700000201' },
    });
    await req().post('/api/whatsapp/send').set(h()).send({ conversationId: chat.id, text: 'must not send' }).expect(400);
    await db.conversation.update({ where: { id: conversationId }, data: { blockedAt: new Date() } });
    await req().post('/api/whatsapp/send').set(h()).send({ conversationId, text: 'must not send' }).expect(403);
    expect(await db.message.count({ where: { conversationId } })).toBe(0);
  });
});
