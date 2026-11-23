import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { LeadsService } from '../src/modules/leads/leads.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';

describe('Atomic retry-safe follow-up submission (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, org: string, otherOrg: string, lead: string;
  let admin: any, agent: any, peer: any, outsider: any;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const headers = (actor = agent) => ({ Authorization: 'Bearer ' + actor.token });
  const payload = () => ({ leadId: lead, type: 'CALL', dueAt: '2026-12-06T10:00:00+05:30', note: 'Atomic ' + uid, clientMutationId: 'follow-up-' + uid });
  const post = (body: any, actor = agent) => request(app.getHttpServer()).post('/api/follow-ups').set(headers(actor)).send(body);
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Follow-up submission fixture', slug: 'followup-' + uid } })).id;
    otherOrg = (await db.organization.create({ data: { name: 'Foreign submission fixture', slug: 'foreign-followup-' + uid } })).id;
    const actor = async (name: string, organizationId: string, role: 'BROKER_AGENT' | 'BROKER_ADMIN') => {
      const row = await db.user.create({ data: { name, organizationId, role, email: `${name}.${uid}@e2e.test` }, include: { organization: true } });
      return { id: row.id, token: (await app.get(AuthService).issue(row)).accessToken, user: { id: row.id, orgId: organizationId, role, sessionVersion: 0 } };
    };
    agent = await actor('agent', org, 'BROKER_AGENT');
    peer = await actor('peer', org, 'BROKER_AGENT');
    admin = await actor('admin', org, 'BROKER_ADMIN');
    outsider = await actor('outsider', otherOrg, 'BROKER_ADMIN');
    lead = (await db.lead.create({ data: { organizationId: org, name: 'Atomic follow-up lead', phone: '+919876543210', assignedToId: agent.id } })).id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('commits one task/activity/next pointer across20 concurrent retries and preserves the original response', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => post(payload()).expect(201)));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await db.followUp.count({ where: { leadId: lead } })).toBe(1);
    expect(await db.activity.count({ where: { leadId: lead, type: 'FOLLOW_UP' } })).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).nextFollowUpAt?.toISOString()).toBe('2026-12-06T04:30:00.000Z');
    const retry = await post({ ...payload(), dueAt: '2026-12-06T04:30:00Z' }).expect(201);
    expect(retry.body.id).toBe(results[0].body.id);
  });
  it('rejects reuse for a changed task or actor, and denies stale/foreign assignment', async () => {
    await post({ ...payload(), note: 'different' }).expect(409);
    await post(payload(), admin).expect(409);
    await post(payload(), peer).expect(404);
    await post(payload(), outsider).expect(404);
    await post({ ...payload(), clientMutationId: 'new-' + uid, assignedToId: peer.id }).expect(403);
    await post({ ...payload(), clientMutationId: 'foreign-' + uid, assignedToId: outsider.id }, admin).expect(400);
    expect(await db.followUp.count({ where: { leadId: lead } })).toBe(1);
  });
  it('rejects impossible, missing-timezone and invalid dates before any write', async () => {
    for (const dueAt of ['invalid', '2026-02-30T10:00:00Z', '2026-12-06', '2026-12-06T10:00:00']) await post({ ...payload(), dueAt }).expect(400);
    expect(await db.followUp.count({ where: { leadId: lead } })).toBe(1);
  });
  it('advances an explicitly scheduled follow-up and retries without a duplicate stage change', async () => {
    await db.lead.update({ where: { id: lead }, data: { stage: 'CONTACTED' } });
    const body = { ...payload(), clientMutationId: 'progress-' + uid, advanceStage: true };
    const first = await post(body).expect(201);
    expect((await post(body).expect(201)).body.id).toBe(first.body.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).stage).toBe('FOLLOW_UP');
    expect(await db.activity.count({ where: { leadId: lead, type: 'STAGE_CHANGE' } })).toBe(1);
    const monthly = await request(app.getHttpServer())
      .get('/api/follow-ups')
      .set(headers())
      .query({
        view: 'all',
        status: 'PENDING',
        paginated: 'true',
        from: '2026-11-30T18:30:00.000Z',
        to: '2026-12-31T18:29:59.999Z',
      })
      .expect(200);
    expect(monthly.body.items.map((item: { id: string }) => item.id)).toContain(first.body.id);
    await db.$transaction([
      db.activity.deleteMany({ where: { leadId: lead, type: 'STAGE_CHANGE' } }),
      db.followUp.delete({ where: { id: first.body.id } }),
      db.lead.update({ where: { id: lead }, data: { stage: 'NEW' } }),
    ]);
  });

  it('records photos after outbound delivery or confirmation from the assigned agent', async () => {
    const photo = 'https://example.test/api/media/f/listing/property/one.jpg';
    const inventory = await db.inventoryItem.create({ data: { organizationId: org, createdById: agent.id, photoUrls: [photo] } });
    const confirm = (actor = agent) =>
      request(app.getHttpServer())
        .patch('/api/leads/' + lead + '/photos-shared')
        .set(headers(actor))
        .send({ inventoryId: inventory.id });
    await db.lead.update({ where: { id: lead }, data: { stage: 'FOLLOW_UP' } });
    await confirm(outsider).expect(404);
    const wa = app.get(WhatsAppService);
    const credentials = jest.spyOn(wa, 'requireCreds').mockResolvedValue({ scope: 'organization', values: {} });
    const transport = jest
      .spyOn(wa as any, 'graphSend')
      .mockRejectedValueOnce(new Error('Provider rejected send'))
      .mockResolvedValueOnce('photo-' + uid);
    try {
      const send = () => wa.send(org, '+919876543210', { type: 'text', text: 'Property photos:\n' + photo }, { leadId: lead, userId: agent.id });
      await expect(send()).rejects.toThrow('Provider rejected');
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).stage).toBe('FOLLOW_UP');
      const sent = await send();
      expect(sent.status).toBe('SENT');
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).stage).toBe('FOLLOW_UP');
      await (wa as any).onStatus({ id: sent.externalId, status: 'delivered' }, org);
      expect(await db.job.findUnique({ where: { key: 'whatsapp-photo-stage:' + sent.id } })).not.toBeNull();
      await app.get(LeadsService).recordSentPropertyPhotos(sent.id);
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).stage).toBe('PHOTOS_SHARED');
      await db.lead.update({ where: { id: lead }, data: { stage: 'INTERESTED' } });
      expect((await confirm().expect(200)).body.stage).toBe('PHOTOS_SHARED');
    } finally {
      credentials.mockRestore();
      transport.mockRestore();
      await db.message.deleteMany({ where: { conversation: { organizationId: org } } });
      await db.lead.update({ where: { id: lead }, data: { stage: 'NEW' } });
    }
  });

  it('preserves compatibility for old installed clients without a submission key', async () => {
    const { clientMutationId, ...old } = payload();
    const saved = await post({ ...old, dueAt: '2026-12-05T04:30:00Z' }).expect(201);
    expect(saved.body.clientMutationId).toBeNull();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).nextFollowUpAt?.toISOString()).toBe('2026-12-05T04:30:00.000Z');
  });
  it('rolls back the task and pointer if the real activity write fails', async () => {
    const functionName = 'followup_failure_' + uid;
    const before = await db.lead.findUniqueOrThrow({ where: { id: lead } });
    const count = await db.followUp.count({ where: { leadId: lead } });
    try {
      await db.$executeRawUnsafe(
        `CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.content LIKE '%atomic-write-failure-${uid}%' THEN RAISE EXCEPTION 'Isolated follow-up activity failure'; END IF; RETURN NEW; END; $$`,
      );
      await db.$executeRawUnsafe(`CREATE TRIGGER "${functionName}" BEFORE INSERT ON "Activity" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      await post({ ...payload(), clientMutationId: 'failed-' + uid, note: 'atomic-write-failure-' + uid, dueAt: '2026-11-10T10:00:00Z' }).expect(500);
      expect(await db.followUp.count({ where: { leadId: lead } })).toBe(count);
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).nextFollowUpAt).toEqual(before.nextFollowUpAt);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${functionName}" ON "Activity"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }
  });
  it('schedules explicit SMS and Email tasks without provider dispatch or fabricated delivery', async () => {
    for (const type of ['SMS', 'EMAIL']) {
      const saved = await post({ ...payload(), type, clientMutationId: `${type}-${uid}`, dueAt: '2026-12-07T10:00:00Z' }).expect(201);
      expect(saved.body.type).toBe(type);
      expect(saved.body.status).toBe('PENDING');
    }
    expect(await db.message.count({ where: { conversation: { organizationId: org } } })).toBe(0);
  });
  it('serializes reassignment with creation and transfers every pending task to the current owner', async () => {
    const service = app.get(LeadsService);
    const results = await Promise.all([
      service.assign(lead, peer.id, admin.user),
      post({ ...payload(), clientMutationId: 'racing-' + uid, dueAt: '2026-12-04T04:30:00Z' }),
    ]);
    expect([201, 404]).toContain((results[1] as any).status);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).assignedToId).toBe(peer.id);
    expect(await db.followUp.count({ where: { leadId: lead, status: 'PENDING', assignedToId: { not: peer.id } } })).toBe(0);
    await post(payload()).expect(404);
  });
});
