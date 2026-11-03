import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Lead filters and complete scoped CSV (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, token: string;
  let orgId: string, agentId: string, foreignId: string;
  const uid = Date.now().toString(36);
  const send = () => request(app.getHttpServer());
  const headers = () => ({ Authorization: 'Bearer ' + token });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    orgId = (await db.organization.create({ data: { name: 'Lead export fixture', slug: 'lead-export-' + uid } })).id;
    const actor = await db.user.create({
      data: { organizationId: orgId, role: 'BROKER_AGENT', name: 'Export Agent', email: 'lead-export-' + uid + '@e2e.test' },
      include: { organization: true },
    });
    agentId = actor.id;
    token = (await app.get(AuthService).issue(actor)).accessToken;
    const peer = await db.user.create({
      data: { organizationId: orgId, role: 'BROKER_AGENT', name: 'Peer', email: 'lead-export-peer-' + uid + '@e2e.test' },
    });
    foreignId = peer.id;
    const createdAt = new Date();
    await db.lead.createMany({
      data: Array.from({ length: 5005 }, (_, index) => ({
        organizationId: orgId,
        assignedToId: index < 5001 ? agentId : foreignId,
        name: index === 0 ? '=1+1' : index < 5001 ? 'Visible export ' + index : 'Hidden peer export',
        phone: '+9197' + String(index).padStart(8, '0'),
        notes: index === 0 ? '+SUM(A1:A2)' : null,
        createdAt,
      })),
    });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('rejects malformed list, pipeline and export inputs before querying Prisma', async () => {
    for (const query of ['stage=INVALID', 'source=MANUAL,INVALID', 'temperature=INVALID', 'page=-1', 'pageSize=0', 'view=unknown', 'q=first&q=second']) {
      await send()
        .get('/api/leads?' + query)
        .set(headers())
        .expect(400);
    }
    await send().get('/api/leads/kanban?source=INVALID').set(headers()).expect(400);
    await send().get('/api/leads/export?stage=INVALID').set(headers()).expect(400);
  });

  it('exports more than 5,000 matching rows, excludes peers and neutralizes spreadsheet formula cells', async () => {
    const result = await send().get('/api/leads/export').set(headers()).expect(200);
    const lines = result.text.trimEnd().split('\n');
    expect(lines).toHaveLength(5002);
    expect(result.text).not.toContain('Hidden peer export');
    expect(result.text).toContain("'=1+1");
    expect(result.text).toContain("'+SUM(A1:A2)");
    expect(result.text).toContain("'+9197");
    const filtered = await send().get('/api/leads/export?q=Visible%20export%204999').set(headers()).expect(200);
    expect(filtered.text.trimEnd().split('\n')).toHaveLength(2);
    expect(filtered.text).toContain('Visible export 4999');
    const crossed = await send()
      .get('/api/leads/export?assignedToId=' + foreignId)
      .set(headers())
      .expect(200);
    expect(crossed.text.trimEnd().split('\n')).toHaveLength(1);
  });

  it('keeps tied sort values deterministic across pages', async () => {
    const first = await send().get('/api/leads?sort=created&pageSize=100&page=1').set(headers()).expect(200);
    const repeated = await send().get('/api/leads?sort=created&pageSize=100&page=1').set(headers()).expect(200);
    const second = await send().get('/api/leads?sort=created&pageSize=100&page=2').set(headers()).expect(200);
    const ids = first.body.items.map((row: { id: string }) => row.id);
    expect(repeated.body.items.map((row: { id: string }) => row.id)).toEqual(ids);
    expect(second.body.items.some((row: { id: string }) => ids.includes(row.id))).toBe(false);
    expect(first.body.total).toBe(5001);
  });
  it('commits stage closure and task cancellation atomically, with one activity on concurrent retries', async () => {
    const lead = await db.lead.create({
      data: {
        organizationId: orgId,
        assignedToId: agentId,
        name: 'Atomic stage lead',
        phone: '+919700008903',
        nextFollowUpAt: new Date('2026-12-10T05:00:00Z'),
      },
    });
    await db.followUp.create({
      data: { organizationId: orgId, leadId: lead.id, assignedToId: agentId, type: 'CALL', dueAt: new Date('2026-12-10T05:00:00Z') },
    });
    const functionName = 'stage_failure_' + uid.replace(/[^a-z0-9_]/g, '');
    try {
      await db.$executeRawUnsafe(
        `CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."leadId" = '${lead.id}' AND NEW.status = 'CANCELLED' THEN RAISE EXCEPTION 'Isolated stage cancellation failure'; END IF; RETURN NEW; END; $$`,
      );
      await db.$executeRawUnsafe(`CREATE TRIGGER "${functionName}" BEFORE UPDATE ON "FollowUp" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      await send()
        .patch('/api/leads/' + lead.id + '/stage')
        .set(headers())
        .send({ stage: 'NOT_INTERESTED', lostReason: 'Not moving' })
        .expect(500);
      expect(await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ stage: 'NEW', nextFollowUpAt: new Date('2026-12-10T05:00:00Z') });
      expect(await db.activity.count({ where: { leadId: lead.id, type: 'STAGE_CHANGE' } })).toBe(0);
      expect(await db.followUp.count({ where: { leadId: lead.id, status: 'PENDING' } })).toBe(1);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${functionName}" ON "FollowUp"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }
    await Promise.all(
      Array.from({ length: 10 }, () =>
        send()
          .patch('/api/leads/' + lead.id + '/stage')
          .set(headers())
          .send({ stage: 'NOT_INTERESTED', lostReason: 'Not moving' })
          .expect(200),
      ),
    );
    expect(await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
      stage: 'NOT_INTERESTED',
      lostReason: 'Not moving',
      nextFollowUpAt: null,
    });
    expect(await db.activity.count({ where: { leadId: lead.id, type: 'STAGE_CHANGE' } })).toBe(1);
    expect(await db.followUp.count({ where: { leadId: lead.id, status: 'PENDING' } })).toBe(0);
  });
});
