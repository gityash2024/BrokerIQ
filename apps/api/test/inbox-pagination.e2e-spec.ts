import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Complete scoped Inbox pagination, actual PostgreSQL', () => {
  let app: INestApplication, db: PrismaService, org: string, foreignOrg: string;
  let agent: { id: string; token: string }, peer: { id: string; token: string }, admin: { id: string; token: string }, foreign: { id: string; token: string };
  let ownIds: string[], emailId: string;
  const uid = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const get = (query: string, actor = agent) => http().get('/api/whatsapp/conversations?' + query).set({ Authorization: 'Bearer ' + actor.token });
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Inbox page fixture', slug: 'inbox-page-' + uid } })).id;
    foreignOrg = (await db.organization.create({ data: { name: 'Foreign Inbox page fixture', slug: 'foreign-inbox-page-' + uid } })).id;
    const actor = async (name: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT', organizationId = org) => {
      const user = await db.user.create({ data: { name, role, organizationId, email: name + uid + '@page.e2e.test' }, include: { organization: true } });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    agent = await actor('page-agent', 'BROKER_AGENT'); peer = await actor('page-peer', 'BROKER_AGENT');
    admin = await actor('page-admin', 'BROKER_ADMIN'); foreign = await actor('page-foreign', 'BROKER_ADMIN', foreignOrg);
    const leads = await db.lead.createManyAndReturn({ data: Array.from({ length: 230 }, (_, i) => ({ organizationId: org, assignedToId: agent.id, name: 'Page lead ' + i, phone: '+9197' + String(i).padStart(8, '0') })) });
    const rows = await db.conversation.createManyAndReturn({ data: leads.map((lead, i) => ({ organizationId: org, channel: 'SMS', leadId: lead.id, contactKey: lead.phone!, contactName: lead.name, lastMessageAt: i === 229 ? null : new Date('2026-11-01T10:00:00Z'), lastPreview: i === 229 ? 'unique archived-looking preview' : 'Visible page message', unreadCount: i % 2 ? 2 : 0 })) });
    ownIds = rows.map((row) => row.id);
    const peerLead = await db.lead.create({ data: { organizationId: org, assignedToId: peer.id, name: 'Peer hidden', phone: '+919800000401' } });
    await db.conversation.create({ data: { organizationId: org, channel: 'SMS', leadId: peerLead.id, contactKey: peerLead.phone!, unreadCount: 7 } });
    await db.conversation.create({ data: { organizationId: org, channel: 'SMS', contactKey: 'unlinked-private', unreadCount: 3 } });
    await db.conversation.create({ data: { organizationId: foreignOrg, channel: 'SMS', contactKey: 'foreign-private', unreadCount: 8 } });
    const mail = await db.conversation.create({ data: { organizationId: org, channel: 'EMAIL', leadId: leads[0].id, contactKey: 'client2@example.test', contactName: 'Mail Alpha' } }); emailId = mail.id;
    await db.conversation.create({ data: { organizationId: org, channel: 'EMAIL', leadId: leads[1].id, contactKey: 'different2@example.test', contactName: 'Mail Beta' } });
    await db.conversation.create({ data: { organizationId: org, channel: 'WHATSAPP', leadId: leads[0].id, contactKey: 'manual-hidden' } });
    const housing = await db.lead.create({ data: { organizationId: org, assignedToId: agent.id, source: 'HOUSING', name: 'Housing only', phone: '+919800000402' } });
    await db.conversation.create({ data: { organizationId: org, channel: 'WHATSAPP', leadId: housing.id, contactKey: 'housing-visible' } });
  });
  afterAll(async () => { await app?.close(); });
  it('pages beyond two hundred conversations with deterministic tied/null dates and exact current Agent scope', async () => {
    const ids: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await get(`channel=SMS&paginated=true&pageSize=100&page=${page}`).expect(200);
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.body.total).toBe(230); expect(result.body.totalPages).toBe(3);
      ids.push(...result.body.items.map((row: { id: string }) => row.id));
    }
    expect(new Set(ids).size).toBe(230); expect([...ids].sort()).toEqual([...ownIds].sort());
    expect((await get('channel=SMS').expect(200)).body).toHaveLength(200);
    expect((await get('channel=SMS&paginated=true', admin).expect(200)).body.total).toBe(232);
    expect((await get('channel=SMS&paginated=true', peer).expect(200)).body.total).toBe(1);
    expect((await get('channel=SMS&paginated=true', foreign).expect(200)).body.total).toBe(1);
  });
  it('searches the full dataset including preview text and does not strip digits out of email addresses', async () => {
    const preview = await get('channel=SMS&paginated=true&q=unique%20archived-looking').expect(200);
    expect(preview.body.total).toBe(1);
    const mail = await get('channel=EMAIL&paginated=true&q=client2%40example.test').expect(200);
    expect(mail.body.items.map((row: { id: string }) => row.id)).toEqual([emailId]);
    const unread = await get('channel=SMS&paginated=true&unread=true').expect(200); expect(unread.body.total).toBe(115);
    const housing = await get('channel=WHATSAPP&paginated=true').expect(200); expect(housing.body.total).toBe(1);
    expect(housing.body.items[0].contactKey).toBe('housing-visible');
  });
  it('rejects malformed filter/page values before a database query can fail', async () => {
    for (const q of ['channel=OTHER', 'page=0', 'page=1000001', 'pageSize=101', 'unread=yes', 'q=one&q=two', 'paginated=maybe']) await get(q).expect(400);
  });
});
