import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ADMIN_BUSINESS_RESOURCES } from '@brokeriq/shared';

/** Isolated real PostgreSQL / HTTP / AuthGuard; no provider request or staging fixture. */
describe('Super Admin business hierarchy', () => {
  let app: INestApplication, db: PrismaService;
  let admin: string, orgA: string, orgB: string, member: string, otherMember: string, first: string, second: string;
  const denied: { id: string; token: string }[] = [];
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const req = () => request(app.getHttpServer());
  const auth = (token = admin) => ({ Authorization: 'Bearer ' + token });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    orgA = (await db.organization.create({ data: { name: 'Business scope A ' + uid, slug: 'business-a-' + uid } })).id;
    orgB = (await db.organization.create({ data: { name: 'Business scope B ' + uid, slug: 'business-b-' + uid, status: 'SUSPENDED' } })).id;
    for (const role of ['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER', 'MODERATOR', 'SUPPORT'] as const) {
      const u = await db.user.create({
        data: { name: 'Business ' + role, email: role.toLowerCase() + uid + '@e2e.test', role, organizationId: role === 'SUPER_ADMIN' ? null : orgA },
      });
      const unsupportedAtLaunch = process.env.BROKER_FIRST === 'true' && ['MODERATOR', 'SUPPORT'].includes(role);
      if (unsupportedAtLaunch) {
        await expect(app.get(AuthService).issue({ ...u, organization: await db.organization.findUnique({ where: { id: orgA } }) } as any)).rejects.toThrow(
          'broker launch',
        );
      }
      // Model a real pre-policy session, then change its stored role. The HTTP
      // guard must enforce the current role rather than its old JWT claim.
      const issuer = unsupportedAtLaunch ? await db.user.update({ where: { id: u.id }, data: { role: 'USER' } }) : u;
      const token = (
        await app
          .get(AuthService)
          .issue({ ...issuer, organization: role === 'SUPER_ADMIN' ? null : await db.organization.findUnique({ where: { id: orgA } }) } as any)
      ).accessToken;
      if (unsupportedAtLaunch) await db.user.update({ where: { id: u.id }, data: { role } });
      if (role === 'SUPER_ADMIN') admin = token;
      else denied.push({ id: u.id, token });
      if (role === 'BROKER_AGENT') member = u.id;
    }
    otherMember = (
      await db.user.create({ data: { name: 'Other business member', email: 'other' + uid + '@e2e.test', role: 'BROKER_AGENT', organizationId: orgB } })
    ).id;
    first = (
      await db.lead.create({
        data: { organizationId: orgA, assignedToId: member, name: '=SUM(1,2) ' + uid, phone: '+919700005601', notes: 'First scope', source: 'MANUAL' },
      })
    ).id;
    second = (
      await db.lead.create({
        data: { organizationId: orgB, assignedToId: otherMember, name: 'Archived ' + uid, phone: '+919700005602', deletedAt: new Date() },
      })
    ).id;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('shows all firms including archived/suspended data, with consistent filtered totals', async () => {
    const all = (await req().get('/api/admin/business/leads').query({ q: uid, pageSize: 1 }).set(auth()).expect(200)).body;
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(1);
    expect(all.totalPages).toBe(2);
    const next = (await req().get('/api/admin/business/leads').query({ q: uid, page: 2, pageSize: 1 }).set(auth()).expect(200)).body;
    expect(next.items[0].id).not.toBe(all.items[0].id);
    const scoped = (await req().get('/api/admin/business/leads').query({ organizationId: orgA, memberId: member }).set(auth()).expect(200)).body;
    expect(scoped.total).toBe(1);
    expect(scoped.items[0]).toMatchObject({ id: first, organizationId: orgA, memberId: member });
    const archived = (await req().get('/api/admin/business/leads').query({ q: uid, archive: 'archived' }).set(auth()).expect(200)).body;
    expect(archived.items.map((x: any) => x.id)).toEqual([second]);
    const counts = (await req().get('/api/admin/business/counts').query({ organizationId: orgA, memberId: member }).set(auth()).expect(200)).body;
    expect(counts.items.find((x: any) => x.resource === 'leads').total).toBe(1);
    expect(counts.items.find((x: any) => x.resource === 'automations').total).toBeNull();
    await req()
      .get('/api/admin/business/leads/' + second)
      .query({ organizationId: orgA })
      .set(auth())
      .expect(404);
    await req()
      .get('/api/admin/business/leads/' + second)
      .set(auth())
      .expect(200);
  });
  it('denies every non-Super-Admin role and rejects stale demoted authority', async () => {
    for (const actor of denied)
      for (const path of ['counts', 'leads', 'leads/' + first, 'leads/export', 'hierarchy/members'])
        await req()
          .get('/api/admin/business/' + path)
          .set(auth(actor.token))
          .expect(403);
    const u = await db.user.create({ data: { name: 'Demoted admin', email: 'demoted' + uid + '@e2e.test', role: 'SUPER_ADMIN' } });
    const token = (await app.get(AuthService).issue({ ...u, organization: null } as any)).accessToken;
    await db.user.update({ where: { id: u.id }, data: { role: 'BROKER_AGENT', organizationId: orgA } });
    const result = await req().get('/api/admin/business/leads').set(auth(token));
    expect([401, 403]).toContain(result.status);
  });
  it('queries every registered resource and explicit safe detail projection, without generic delegate access', async () => {
    for (const resource of Object.keys(ADMIN_BUSINESS_RESOURCES)) {
      const list = (
        await req()
          .get('/api/admin/business/' + resource)
          .set(auth())
          .expect(200)
      ).body;
      expect(Array.isArray(list.items)).toBe(true);
      await req()
        .get('/api/admin/business/' + resource + '/no-such-record')
        .set(auth())
        .expect(404);
    }
    await req().get('/api/admin/business/systemSetting').set(auth()).expect(400);
    await req().get('/api/admin/business/leads').query({ organizationId: orgA, memberId: otherMember }).set(auth()).expect(400);
    await req().get('/api/admin/business/leads').query({ status: 'INVENTED' }).set(auth()).expect(400);
    await req()
      .get('/api/admin/business/leads')
      .query({ q: "%' OR 1=1 --" })
      .set(auth())
      .expect(200)
      .expect((r) => expect(r.body.total).toBe(0));
    await req().get('/api/admin/business/leads').query({ from: '2026-12-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }).set(auth()).expect(400);
    await req().get('/api/admin/business/automations').query({ memberId: member }).set(auth()).expect(400);
  });
  it('exports the full filter instead of the visible page, escapes spreadsheet cells and validates selected IDs', async () => {
    const csv = await req().get('/api/admin/business/leads/export').query({ q: uid, pageSize: 1 }).set(auth()).expect(200);
    expect(csv.text).toContain(first);
    expect(csv.text).toContain(second);
    expect(csv.text).toContain("'=SUM(1,2)");
    expect(csv.headers['cache-control']).toContain('no-store');
    await req().get('/api/admin/business/leads/export').query({ ids: '' }).set(auth()).expect(400);
    await req()
      .get('/api/admin/business/leads/export')
      .query({ ids: [first, second] })
      .set(auth())
      .expect(400);
    const chosen = await req().get('/api/admin/business/leads/export').query({ ids: first, organizationId: orgA }).set(auth()).expect(200);
    expect(chosen.text).toContain(first);
    expect(chosen.text).not.toContain(second);
    await req()
      .get('/api/admin/business/leads/export')
      .query({ ids: [first, second].join(','), organizationId: orgA })
      .set(auth())
      .expect(400);
    const detail = (
      await req()
        .get('/api/admin/business/leads/' + first)
        .set(auth())
        .expect(200)
    ).body;
    expect(detail.notes).toBe('First scope');
    expect(detail.rawPayload).toBeUndefined();
    expect(detail.passwordHash).toBeUndefined();
  });
  it('projects actual linked rows for source/message/job/invoice details without exposing their secrets', async () => {
    const batch = await db.importBatch.create({
      data: { organizationId: orgA, createdById: member, sourceType: 'TEXT', sourceHash: uid, fileName: 'Actual source fixture', status: 'NEEDS_REVIEW' },
    });
    const source = await db.sourceEntry.create({
      data: { organizationId: orgA, batchId: batch.id, entryKey: uid, rawText: 'Property source fixture', extracted: [], reviewState: 'NEEDS_REVIEW' },
    });
    const conv = await db.conversation.create({ data: { organizationId: orgA, channel: 'WHATSAPP', contactKey: '919700005601', leadId: first } });
    const msg = await db.message.create({
      data: { conversationId: conv.id, direction: 'INBOUND', body: 'Source fixture message', meta: { apiKey: 'never-expose-provider-meta' } },
    });
    const job = await db.job.create({ data: { type: 'import.extract', status: 'FAILED', payload: { batchId: batch.id, secret: 'never-expose-job-payload' } } });
    const invoice = await db.clientInvoice.create({
      data: {
        organizationId: orgA,
        number: 'TEST-' + uid,
        clientName: 'Fixture client',
        items: [],
        subtotal: 0,
        gstPct: 0,
        total: 0,
        publicToken: 'never-expose-invoice-' + uid,
        createdById: member,
      },
    });
    for (const [resource, id] of [
      ['sources', source.id],
      ['messages', msg.id],
      ['jobs', job.id],
      ['invoices', invoice.id],
    ]) {
      const response = await req().get(`/api/admin/business/${resource}/${id}`).query({ organizationId: orgA }).set(auth()).expect(200);
      expect(response.body.organizationId).toBe(orgA);
      expect(JSON.stringify(response.body)).not.toContain('never-expose');
    }
    const jobs = (await req().get('/api/admin/business/jobs').query({ organizationId: orgA, status: 'FAILED' }).set(auth()).expect(200)).body;
    expect(jobs.items.some((x: any) => x.id === job.id)).toBe(true);
    const messages = (await req().get('/api/admin/business/messages').query({ organizationId: orgB }).set(auth()).expect(200)).body;
    expect(messages.items.some((x: any) => x.id === msg.id)).toBe(false);
  });
  it('never exposes private KYC reference/numbers or invoice access tokens, and paginates the complete hierarchy', async () => {
    const kyc = await db.kycDocument.create({
      data: {
        userId: member,
        organizationId: orgA,
        docType: 'PAN',
        docNumber: 'PRIVATE_NUMBER',
        privateKey: 'private-key',
        fileUrl: 'https://private.example/kyc',
      },
    });
    const detail = (
      await req()
        .get('/api/admin/business/kyc/' + kyc.id)
        .set(auth())
        .expect(200)
    ).body;
    for (const key of ['docNumber', 'privateKey', 'fileUrl', 'fileSha256']) expect(detail[key]).toBeUndefined();
    const userPage = (await req().get('/api/admin/business/hierarchy/members').query({ organizationId: orgA, search: 'Business' }).set(auth()).expect(200))
      .body;
    expect(userPage.items.some((x: any) => x.role === 'USER')).toBe(true);
    expect(userPage.items.some((x: any) => x.role === 'SUPPORT')).toBe(true);
    expect(userPage.items.every((x: any) => x.organizationId === orgA)).toBe(true);
    const firms = (await req().get('/api/admin/business/hierarchy/organizations').query({ search: uid }).set(auth()).expect(200)).body;
    expect(firms.items.some((x: any) => x.id === orgB && x.status === 'SUSPENDED')).toBe(true);
    expect(await db.auditLog.count({ where: { action: 'ADMIN_BUSINESS_DETAIL', entityId: kyc.id } })).toBeGreaterThan(0);
  });
});
