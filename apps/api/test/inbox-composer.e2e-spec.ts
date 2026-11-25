import { propertyGalleryDraft } from '@brokeriq/shared';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { RealtimeGateway } from '../src/core/realtime/realtime.gateway';
import { env } from '../src/config/env';
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
  it('dispatches realtime messages only to the firm and current active Agent of an active lead', async () => {
    const gateway = app.get(RealtimeGateway);
    const toUser = jest.spyOn(gateway, 'toUser');
    const toOrg = jest.spyOn(gateway, 'toOrg');
    const event = 'wa:message';
    const payload = { conversationId };
    try {
      await gateway.toConversation(org, conversationId, event, payload);
      expect(toOrg).toHaveBeenCalledWith(org, event, payload);
      expect(toUser).toHaveBeenCalledWith(agent.id, event, payload);
      toUser.mockClear();

      await db.lead.update({ where: { id: lead }, data: { assignedToId: peer.id } });
      await gateway.toConversation(org, conversationId, event, payload);
      expect(toUser.mock.calls).toEqual([[peer.id, event, payload]]);
      toUser.mockClear();

      await db.lead.update({ where: { id: lead }, data: { deletedAt: new Date() } });
      await gateway.toConversation(org, conversationId, event, payload);
      expect(toUser).not.toHaveBeenCalled();

      await db.lead.update({ where: { id: lead }, data: { deletedAt: null } });
      await db.user.update({ where: { id: peer.id }, data: { status: 'SUSPENDED' } });
      await gateway.toConversation(org, conversationId, event, payload);
      expect(toUser).not.toHaveBeenCalled();

      toOrg.mockClear();
      await gateway.toConversation('wrong-firm', conversationId, event, payload);
      expect(toOrg).not.toHaveBeenCalled();
      expect(toUser).not.toHaveBeenCalled();
    } finally {
      await db.user.update({ where: { id: peer.id }, data: { status: 'ACTIVE' } });
      await db.lead.update({ where: { id: lead }, data: { assignedToId: agent.id, deletedAt: null } });
      toUser.mockRestore();
      toOrg.mockRestore();
    }
  });
  it('returns a settings-linked integration error and creates no fake success', async () => {
    creds.mockRejectedValueOnce(new IntegrationNotConfiguredException('whatsapp'));
    const result = await req().post('/api/whatsapp/resolve-lead').set(h(peer)).send({ leadId: peerLead }).expect(424);
    expect(result.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(result.body.integration.settingsPath).toContain('/broker/connectors');
    expect(await db.conversation.count({ where: { leadId: peerLead } })).toBe(0);
  });
  it('makes a WhatsApp draft available without API credentials while keeping assignment and firm scope', async () => {
    const calls = creds.mock.calls.length;
    const manual = { leadId: lead, allowManualDraft: true };
    await req().post('/api/whatsapp/resolve-lead').set(h(peer)).send(manual).expect(404);
    await req().post('/api/whatsapp/resolve-lead').set(h(outsider)).send(manual).expect(404);
    const resolved = await req().post('/api/whatsapp/resolve-lead').set(h()).send(manual).expect(201);
    expect(resolved.body.conversationId).toBe(conversationId);
    expect(creds).toHaveBeenCalledTimes(calls);
    const thread = await req().get(`/api/whatsapp/conversations/${conversationId}/messages`).set(h()).expect(200);
    expect(thread.body).toMatchObject({ connected: false, windowOpen: false, items: [] });
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
  it('keeps a clickable gallery URL while turning off Meta link previews only for property messages', async () => {
    await db.conversation.update({ where: { id: conversationId }, data: { blockedAt: null, lastInboundAt: new Date() } });
    const outbound = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (!String(url).startsWith('https://graph.facebook.com/')) throw new Error('Unexpected external request');
      return new Response(JSON.stringify({ messages: [{ id: 'local-test-' + uid + '-' + outbound.mock.calls.length }] }), { status: 200 });
    });
    const url = new URL('/photos/' + 'a'.repeat(48), env().PUBLIC_WEB_URL).href;
    const property = propertyGalleryDraft('Sector 46 · 2 BHK', url);
    try {
      for (const body of [property, 'Another link https://example.com/listing']) {
        await req().post('/api/whatsapp/send').set(h()).send({ conversationId, text: body }).expect(201);
      }
      expect(outbound.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).text)).toEqual([
        { body: property, preview_url: false },
        { body: 'Another link https://example.com/listing', preview_url: true },
      ]);
      expect(property).toContain(url);
    } finally {
      outbound.mockRestore();
    }
  });
  it('returns a machine-readable recovery code when Meta closes the window after the composer loads', async () => {
    const provider = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code: 131047, message: 'Re-engagement message' },
    }), { status: 400 }));
    try {
      const result = await req().post('/api/whatsapp/send').set(h()).send({ conversationId, text: 'Draft after window closure' }).expect(502);
      expect(result.body.code).toBe('WHATSAPP_WINDOW_CLOSED');
      expect(provider).toHaveBeenCalledTimes(1);
      expect(await db.message.count({ where: { conversationId, status: 'FAILED', body: 'Draft after window closure' } })).toBe(1);
    } finally {
      provider.mockRestore();
    }
  });
  describe('free-only WhatsApp', () => {
    const businessAccountId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const phoneNumberId = businessAccountId + '1';
    let providerUsage: number, providerPolicy: string, analyticsStatus: number, linked: boolean;
    let fetchAdapter: jest.SpyInstance;
    let sends: number;
    const send = (body: { text?: string; mediaUrl?: string } = { text: 'Reply within the customer window' }) =>
      req().post('/api/whatsapp/send').set(h()).send({ conversationId, ...body });

    beforeAll(async () => {
      await db.orgSetting.create({ data: { organizationId: org, key: 'workflow.options', value: { freeOnly: true } } });
    });

    beforeEach(async () => {
      providerUsage = 147;
      providerPolicy = 'REGULAR';
      analyticsStatus = 200;
      linked = true;
      sends = 0;
      await db.conversation.update({ where: { id: conversationId }, data: { lastInboundAt: new Date() } });
      creds.mockResolvedValue({ scope: 'organization', values: { businessAccountId, phoneNumberId } });
      fetchAdapter = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.hostname !== 'graph.facebook.com') throw new Error('Unexpected external request');
        if (init?.method === 'POST' && url.pathname.endsWith('/' + phoneNumberId + '/messages')) {
          return Response.json({ messages: [{ id: 'free-test-' + uid + '-' + Math.random().toString(36).slice(2) + '-' + ++sends }] });
        }
        const fields = url.searchParams.get('fields');
        if (fields === 'service_pricing_policy') return Response.json({ service_pricing_policy: providerPolicy });
        if (!fields?.includes('analytics.start(')) throw new Error('Unexpected Graph request');
        return Response.json({
          phone_numbers: { data: linked ? [{ id: phoneNumberId, display_phone_number: '+91 97000 00299' }] : [] },
          analytics: { granularity: 'DAY', phone_numbers: ['919700000299'], data_points: [{ sent: providerUsage, delivered: providerUsage }] },
        }, { status: analyticsStatus });
      });
    });

    afterEach(() => fetchAdapter.mockRestore());

    it('lets the assigned Agent send text and property images for a regular account under quota', async () => {
      await send().expect(201);
      await send({ mediaUrl: new URL('/property-image.jpg', env().PUBLIC_API_URL).href }).expect(201);
      expect(sends).toBe(2);
    });

    it('keeps the exempt-account path independent of analytics', async () => {
      providerPolicy = 'PAID_EXEMPT';
      analyticsStatus = 503;
      await send().expect(201);
      expect(sends).toBe(1);
    });

    it('keeps the draft on unknown usage, a mismatched sender, and a closed window', async () => {
      analyticsStatus = 503;
      const result = await send().expect(403);
      expect(result.body.code).toBe('MESSAGING_FREE_ONLY');
      expect(result.body.details.draftUrl).toContain('wa.me');
      analyticsStatus = 200;
      linked = false;
      await send().expect(403);
      linked = true;
      await db.conversation.update({ where: { id: conversationId }, data: { lastInboundAt: new Date(Date.now() - 25 * 3600_000) } });
      await send().expect(403);
      expect(sends).toBe(0);
    });

    it('keeps templates blocked and reserves the final free slot for only one concurrent reply', async () => {
      await expect(wa.send(org, '+919700000201', { type: 'template', name: 'test', language: 'en', params: [] })).rejects.toThrow('Free-only messaging');
      const attempts = await db.message.count({ where: { conversationId, direction: 'OUTBOUND', type: { in: ['TEXT', 'IMAGE', 'DOCUMENT'] } } });
      providerUsage = 899 - attempts;
      const results = await Promise.all([send(), send()]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 403]);
      expect(sends).toBe(1);
    });
  });
});
