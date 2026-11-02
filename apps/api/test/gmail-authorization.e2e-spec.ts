import { env } from '../src/config/env';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { GmailService } from '../src/modules/messaging/gmail.service';
import { GMAIL_SCOPES } from '../src/core/gmail/gmail.client';

/** Actual guards/PostgreSQL/encryption; Google HTTP is a boundary stub, not production consent proof. */
describe('Gmail firm OAuth authorization (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, gmail: GmailService, settings: SettingsService;
  let admin: any, peer: any, agent: any, org: string, otherOrg: string;
  const uid = Date.now().toString(36),
    client = { clientId: 'isolated.apps.googleusercontent.com', clientSecret: 'isolated-client-secret' };
  const h = (actor: any) => ({ Authorization: 'Bearer ' + actor.token });
  const api = () => request(app.getHttpServer());
  const begin = async (actor = admin) => new URL((await api().post('/api/messaging/gmail/connect').set(h(actor)).send({}).expect(201)).body.authorizationUrl);
  const callback = (url: URL) => api().get('/api/webhooks/gmail/callback?state=' + url.searchParams.get('state') + '&code=isolated-code');
  const provider = (mailbox = `business.${uid}@example.com`) =>
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (url: any) =>
          new Response(
            JSON.stringify(
              String(url).includes('/token')
                ? { access_token: 'isolated-access', refresh_token: 'isolated-refresh', scope: GMAIL_SCOPES.join(' ') }
                : { emailAddress: mailbox },
            ),
            { status: 200 },
          ),
      );
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    gmail = app.get(GmailService);
    settings = app.get(SettingsService);
    org = (await db.organization.create({ data: { name: 'Isolated Gmail firm', slug: 'gmail-' + uid, restrictions: [] } })).id;
    otherOrg = (await db.organization.create({ data: { name: 'Other Gmail firm', slug: 'gmail-other-' + uid, restrictions: [] } })).id;
    const actor = async (name: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT', organizationId = org) => {
      const user = await db.user.create({ data: { name, email: name + uid + '@e2e.test', role, organizationId }, include: { organization: true } });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    admin = await actor('gmail-admin', 'BROKER_ADMIN');
    peer = await actor('gmail-peer', 'BROKER_ADMIN', otherOrg);
    agent = await actor('gmail-agent', 'BROKER_AGENT');
    await settings.save('gmail_oauth', { fields: client }, { userId: admin.id });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  it('only Admin can begin a minimal-scope PKCE grant; raw state/verifier are not stored', async () => {
    await api().post('/api/messaging/gmail/connect').set(h(agent)).send({}).expect(403);
    const url = await begin();
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(GMAIL_SCOPES.join(' '));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const raw = url.searchParams.get('state')!;
    const row = await db.mailboxAuthorization.findUniqueOrThrow({ where: { id: createHash('sha256').update(raw).digest('hex') } });
    expect(JSON.stringify(row)).not.toContain(raw);
    expect(row.verifierEnc).toMatch(/^v1:/);
    expect(url.searchParams.get('redirect_uri')).toContain('/api/webhooks/gmail/callback');
  });
  it('connects only after Google profile identification, encrypts the refresh token and consumes state once', async () => {
    const url = await begin();
    const fetch = provider();
    const result = await callback(url).expect(303);
    expect(result.headers.location).toContain('gmail=connected');
    const saved = await db.orgSetting.findUniqueOrThrow({ where: { organizationId_key: { organizationId: org, key: 'integration.gmail' } } });
    expect(JSON.stringify(saved.value)).not.toContain('isolated-refresh');
    expect((await settings.resolveOrganizationOnly('gmail', org))?.mailboxEmail).toBe(`business.${uid}@example.com`);
    expect((await callback(url).expect(303)).headers.location).toContain('connection_failed');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('provides owned idempotent send/reply and a filtered deduplicated client email trail', async () => {
    const lead = await db.lead.create({
      data: {
        organizationId: org,
        assignedToId: agent.id,
        name: 'Isolated email client',
        email: 'client@example.com',
        phone: '+919700000401',
        tags: [],
        scoreReasons: [],
      },
    });
    const fetch = provider();
    const conv = (await api().post('/api/messaging/resolve-lead').set(h(agent)).send({ leadId: lead.id, channel: 'EMAIL' }).expect(201)).body.conversationId;
    const requestId = randomUUID();
    const payload = { conversationId: conv, requestId, subject: 'Isolated appointment', text: 'Isolated email body' };
    const sent = await Promise.all([1, 2, 3].map(() => api().post('/api/messaging/email/send').set(h(agent)).send(payload).expect(201)));
    expect(new Set(sent.map((value) => value.body.id)).size).toBe(1);
    const queued = await db.job.findUniqueOrThrow({ where: { key: 'gmail-dispatch:' + sent[0].body.id } });
    expect(Math.abs(queued.runAt.getTime() - Date.now())).toBeLessThan(10_000);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/messages/send'))).toBe(false);
    fetch.mockImplementation(async () => new Response(JSON.stringify({ id: 'abc123', threadId: 'abc234' }), { status: 200 }));
    await Promise.all([gmail.dispatchEmail(sent[0].body.id), gmail.dispatchEmail(sent[0].body.id)]);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/messages/send'))).toHaveLength(1);
    expect((await db.message.findUniqueOrThrow({ where: { id: sent[0].body.id } })).status).toBe('SENT');
    const clientMail = (id: string, text: string, extraTo = '') => ({
      id,
      threadId: 'bcd123',
      internalDate: String(Date.now()),
      payload: {
        mimeType: 'text/plain',
        headers: [
          { name: 'From', value: 'Client <client@example.com>' },
          { name: 'To', value: `business.${uid}@example.com${extraTo}` },
          { name: 'Subject', value: 'Client response' },
          { name: 'Message-ID', value: `<${id}@example.com>` },
        ],
        body: { data: Buffer.from(text).toString('base64url') },
      },
    });
    fetch.mockImplementation(
      async (url: any) =>
        new Response(
          JSON.stringify(
            String(url).includes('/messages?')
              ? { messages: [{ id: 'bcd111' }, { id: 'bcd222' }, { id: 'bcd333' }, { id: 'bcd444' }, { id: 'bcd555' }] }
              : String(url).includes('bcd111')
                ? clientMail('bcd111', 'Isolated client response')
                : String(url).includes('bcd222')
                  ? clientMail('bcd222', 'Your OTP is 123456')
                  : String(url).includes('bcd333')
                    ? clientMail('bcd333', 'Private group response', ', unrelated@example.com')
                    : String(url).includes('bcd444')
                      ? (() => {
                          const mail = clientMail('bcd444', 'Private Bcc response');
                          mail.payload.headers.push({ name: 'Bcc', value: 'private@example.com' });
                          return mail;
                        })()
                      : (() => {
                          const mail = clientMail('bcd555', '123456');
                          mail.payload.headers.find((header) => header.name === 'Subject')!.value = 'Verification code';
                          return mail;
                        })(),
          ),
          { status: 200 },
        ),
    );
    const synced = await api().post(`/api/messaging/email/${conv}/sync`).set(h(agent)).send({}).expect(201);
    expect(synced.body.imported).toBe(1);
    expect((await api().post(`/api/messaging/email/${conv}/sync`).set(h(agent)).send({}).expect(201)).body.imported).toBe(0);
    expect(await db.message.count({ where: { conversationId: conv, direction: 'INBOUND' } })).toBe(1);
    const notes = await db.notification.findMany({ where: { kind: 'EMAIL', link: `/broker/inbox?channel=EMAIL&c=${conv}` } });
    expect(notes.map((note) => note.userId).sort()).toEqual([admin.id, agent.id].sort());
    expect(await db.message.count({ where: { conversationId: conv, body: { contains: 'OTP' } } })).toBe(0);
    const query = fetch.mock.calls.find(([url]) => String(url).includes('/messages?'))![0];
    expect(decodeURIComponent(String(query))).toContain('from:client@example.com');
    await api().get(`/api/whatsapp/conversations/${conv}/messages`).set(h(peer)).expect(404);
    const inbound = await db.message.findFirstOrThrow({ where: { conversationId: conv, direction: 'INBOUND' } });
    const reply = await api()
      .post('/api/messaging/email/send')
      .set(h(agent))
      .send({ ...payload, requestId: randomUUID(), subject: 'Re: Client response', replyToId: inbound.id })
      .expect(201);
    expect(reply.body.meta.replyTo).toBe('<bcd111@example.com>');
    await db.lead.update({ where: { id: lead.id }, data: { assignedToId: admin.id } });
    fetch.mockClear();
    await gmail.dispatchEmail(reply.body.id);
    expect(fetch).not.toHaveBeenCalled();
    expect((await db.message.findUniqueOrThrow({ where: { id: reply.body.id } })).status).toBe('FAILED');
  });
  it('schedules only linked firm conversations with an active Admin and keeps provider work out of the timer', async () => {
    await db.conversation.updateMany({ where: { organizationId: org, channel: 'EMAIL' }, data: { lastEmailSyncAt: new Date(0) } });
    const fetch = provider();
    const previous = env().JOBS_ENABLED;
    try {
      env().JOBS_ENABLED = true;
      await gmail.scheduleSync();
    } finally {
      env().JOBS_ENABLED = previous;
    }
    expect(fetch).not.toHaveBeenCalled();
    const jobs = await db.job.findMany({ where: { type: 'gmail.sync', payload: { path: ['orgId'], equals: org } } });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((job) => (job.payload as any).actorId === admin.id)).toBe(true);
  });
  it('refuses a consumed/expired state and a grant whose administrator was demoted', async () => {
    const url = await begin();
    const state = url.searchParams.get('state')!;
    await db.mailboxAuthorization.update({ where: { id: createHash('sha256').update(state).digest('hex') }, data: { expiresAt: new Date(0) } });
    const fetch = provider();
    expect((await callback(url).expect(303)).headers.location).toContain('connection_failed');
    expect(fetch).not.toHaveBeenCalled();
    const demoted = await begin();
    await db.user.update({ where: { id: admin.id }, data: { role: 'BROKER_AGENT' } });
    expect((await callback(demoted).expect(303)).headers.location).toContain('connection_failed');
    expect(fetch).not.toHaveBeenCalled();
    await db.user.update({ where: { id: admin.id }, data: { role: 'BROKER_ADMIN' } });
  });
  it('never attaches the same mailbox to another firm', async () => {
    const url = await begin(peer);
    provider();
    expect((await callback(url).expect(303)).headers.location).toContain('connection_failed');
    expect(await settings.resolveOrganizationOnly('gmail', otherOrg)).toBeNull();
  });
  it('rejects stale client configuration and disallows manual mailbox-token impersonation', async () => {
    const device = await db.refreshToken.findFirstOrThrow({ where: { userId: admin.id, revokedAt: null } });
    const actor = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    const url = new URL((await gmail.begin({ id: admin.id, role: 'BROKER_ADMIN', orgId: org, email: actor.email }, device.id)).authorizationUrl);
    await settings.save('gmail_oauth', { fields: { ...client, clientSecret: 'replacement-client-secret' } }, { userId: admin.id });
    const fetch = provider();
    expect((await callback(url).expect(303)).headers.location).toContain('connection_failed');
    expect(fetch).not.toHaveBeenCalled();
    await api()
      .patch('/api/broker/connectors/gmail')
      .set(h(admin))
      .send({ fields: { mailboxEmail: 'other@example.com', refreshToken: 'not-a-real-grant' } })
      .expect(400);
    await settings.save('gmail_oauth', { fields: client }, { userId: admin.id });
  });
  it('does not install a grant after the initiating device session was revoked', async () => {
    const user = await db.user.create({
      data: { name: 'Isolated revoked Admin', email: 'revoked-' + uid + '@e2e.test', role: 'BROKER_ADMIN', organizationId: org },
      include: { organization: true },
    });
    await app.get(AuthService).issue(user);
    const session = await db.refreshToken.findFirstOrThrow({ where: { userId: user.id, revokedAt: null } });
    const url = new URL((await gmail.begin({ id: user.id, role: 'BROKER_ADMIN', orgId: org, email: user.email }, session.id)).authorizationUrl);
    await db.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const fetch = provider();
    expect((await callback(url).expect(303)).headers.location).toContain('connection_failed');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('disconnects only from the current Admin firm and leaves other firms untouched', async () => {
    const fetch = provider();
    await api().delete('/api/messaging/gmail/connection').set(h(agent)).expect(403);
    await api().delete('/api/messaging/gmail/connection').set(h(peer)).expect(200);
    expect(await settings.resolveOrganizationOnly('gmail', org)).not.toBeNull();
    await api().delete('/api/messaging/gmail/connection').set(h(admin)).expect(200);
    expect(await settings.resolveOrganizationOnly('gmail', org)).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url) === 'https://oauth2.googleapis.com/revoke')).toBe(true);
  });
});
