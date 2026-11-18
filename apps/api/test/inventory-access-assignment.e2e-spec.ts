import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { inventoryDate, inventoryMonth } from '@brokeriq/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { LeadsService } from '../src/modules/leads/leads.service';
import { NotificationsService } from '../src/core/notifications/notifications.service';

describe('Agent catalogue privacy, shared galleries and lead acceptance', () => {
  let app: INestApplication;
  let db: PrismaService;
  let orgId: string;
  let propertyId: string;
  const actors: Record<string, { id: string; token: string }> = {};
  const stamp = Date.now().toString(36);
  const api = () => request(app.getHttpServer());
  const h = (actor: string) => ({ Authorization: 'Bearer ' + actors[actor].token });
  const photo = 'https://brokeriq.example/api/media/f/listing/firm/property.jpg';
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    orgId = (await db.organization.create({ data: { name: 'Access verification', slug: 'access-' + stamp, onboarded: true } })).id;
    const other = (await db.organization.create({ data: { name: 'Isolated other firm', slug: 'other-access-' + stamp } })).id;
    const specs: [string, Role, string, string[]][] = [
      ['admin', 'BROKER_ADMIN', orgId, []],
      ['agent', 'BROKER_AGENT', orgId, []],
      ['second', 'BROKER_AGENT', orgId, []],
      ['outside', 'BROKER_ADMIN', other, []],
      ['delegate', 'SUB_BROKER_ADMIN', orgId, ['inventory:view', 'inventory:approve_details', 'leads:view', 'leads:assign']],
      ['limited', 'SUB_BROKER_ADMIN', orgId, ['inventory:view', 'inventory:approve', 'leads:view']],
    ];
    for (const [label, role, organizationId, delegatedPermissions] of specs) {
      const user = await db.user.create({
        data: { name: label, role, organizationId, delegatedPermissions, email: label + '.access.' + stamp + '@e2e.test' },
        include: { organization: true },
      });
      actors[label] = { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    }
    const created = await api()
      .post('/api/inventory')
      .set(h('admin'))
      .send({
        sector: 'Sector 43, House PRIVATE-HOUSE-81',
        houseNo: 'PRIVATE-HOUSE-81',
        address: 'Private address 81',
        contacts: [{ name: 'Private owner', phone: '+919876543210', role: 'OWNER' }],
        purpose: 'RENT',
        monthlyRent: 40000,
        category: 'RESIDENTIAL',
        propertyType: 'BUILDER_FLOOR',
        floor: '1',
        roomKind: 'BHK',
        bhk: 2,
        furnishing: 'FULLY_FURNISHED',
        area: 1000,
        areaUnit: 'SQ_FT',
        photoUrls: [photo],
        notes: 'Private note 9876543210',
        directionsUrl: 'https://www.google.com/maps?q=28.45,77.07',
        directoryMonth: inventoryMonth(),
        availableSince: inventoryDate(new Date(Date.now() + 45 * 86400_000)),
        details: { availableFrom: '2027-01-01', sourceLayout: 'Private House 81', bathrooms: 2 },
      })
      .expect(201);
    propertyId = created.body.id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('shows another team member’s future property while protecting detail, list and export paths', async () => {
    const detail = (
      await api()
        .get('/api/inventory/' + propertyId)
        .set(h('agent'))
        .expect(200)
    ).body;
    expect(detail).toMatchObject({
      detailAccess: 'LOCKED',
      canEdit: false,
      area: 1000,
      houseNo: null,
      photoUrls: [],
      contacts: [],
      sector: 'Sector 43',
      floor: '1st floor',
    });
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toMatch(/PRIVATE-HOUSE|Private owner|9876543210|28\.45|sourceLayout|property\.jpg/);
    const rows = (await api().get('/api/inventory').query({ folderMode: 'AVAILABLE', currentInventory: 'true' }).set(h('agent')).expect(200)).body;
    expect(rows.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: propertyId, detailAccess: 'LOCKED' })]));
    const csv = await api().get('/api/inventory/export').set(h('agent')).expect(200);
    expect(csv.text).not.toMatch(/PRIVATE-HOUSE|Private owner|9876543210/);
    expect((await api().get('/api/inventory').query({ search: 'PRIVATE-HOUSE-81' }).set(h('agent')).expect(200)).body.items).toEqual([]);
    await api()
      .patch('/api/inventory/' + propertyId)
      .set(h('agent'))
      .send({ monthlyRent: 1 })
      .expect(404);
    await api()
      .post('/api/inventory/' + propertyId + '/photo-gallery')
      .set(h('agent'))
      .expect(400);
  });

  it('records one request on retries and enforces the separate approval permission', async () => {
    await Promise.all(
      [1, 2, 3].map(() =>
        api()
          .post('/api/inventory/' + propertyId + '/access/request')
          .set(h('agent'))
          .expect(201),
      ),
    );
    expect(await db.inventoryDetailAccess.count({ where: { inventoryId: propertyId, agentId: actors.agent.id } })).toBe(1);
    expect(
      await db.notification.count({
        where: { userId: actors.admin.id, kind: 'INVENTORY_ACCESS_REQUESTED', data: { path: ['inventoryId'], equals: propertyId } },
      }),
    ).toBe(1);
    const row = (
      await api()
        .get('/api/inventory/' + propertyId + '/access')
        .set(h('delegate'))
        .expect(200)
    ).body[0];
    await api()
      .post(`/api/inventory/${propertyId}/access/${actors.agent.id}/review`)
      .set(h('limited'))
      .send({ action: 'approve', expectedUpdatedAt: row.updatedAt })
      .expect(403);
    await api()
      .post(`/api/inventory/${propertyId}/access/${actors.agent.id}/review`)
      .set(h('outside'))
      .send({ action: 'approve', expectedUpdatedAt: row.updatedAt })
      .expect(404);
    await api()
      .post(`/api/inventory/${propertyId}/access/${actors.agent.id}/review`)
      .set(h('delegate'))
      .send({ action: 'approve', expectedUpdatedAt: row.updatedAt })
      .expect(201);
    expect(
      (
        await api()
          .get('/api/inventory/' + propertyId)
          .set(h('agent'))
          .expect(200)
      ).body,
    ).toMatchObject({ detailAccess: 'APPROVED', canEdit: false, houseNo: 'PRIVATE-HOUSE-81', photoUrls: [photo] });
    expect(
      (
        await api()
          .get('/api/inventory/' + propertyId)
          .set(h('second'))
          .expect(200)
      ).body.houseNo,
    ).toBeNull();
    await api()
      .patch('/api/inventory/' + propertyId)
      .set(h('agent'))
      .send({ houseNo: 'edited' })
      .expect(404);
  });

  it('shares one opaque gallery link, exposes no property identifiers, and keeps the full photo collection', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        api()
          .post('/api/inventory/' + propertyId + '/photo-gallery')
          .set(h('agent'))
          .expect(201),
      ),
    );
    expect(results[0].body.url).toBe(results[1].body.url);
    const token = new URL(results[0].body.url).pathname.split('/').pop();
    const publicGallery = (
      await api()
        .get('/api/public/photo-galleries/' + token)
        .expect(200)
    ).body;
    expect(publicGallery.photos).toEqual([photo]);
    expect(publicGallery.caption).toMatch(/^📍 Location: Sector 43/);
    expect(publicGallery.caption).not.toMatch(/PRIVATE-HOUSE|9876543210|Managed by|Transaction|reconfirm|1000/);
    await api()
      .get('/api/public/photo-galleries/' + 'a'.repeat(48))
      .expect(404);
    await api()
      .post('/api/inventory/' + propertyId + '/photo-gallery')
      .set(h('outside'))
      .expect(404);
  });

  it('revokes one Agent without accepting stale approvals and supports a new request', async () => {
    const row = await db.inventoryDetailAccess.findUniqueOrThrow({ where: { inventoryId_agentId: { inventoryId: propertyId, agentId: actors.agent.id } } });
    await api()
      .post(`/api/inventory/${propertyId}/access/${actors.agent.id}/review`)
      .set(h('admin'))
      .send({ action: 'revoke', expectedUpdatedAt: row.updatedAt.toISOString() })
      .expect(201);
    await api()
      .post(`/api/inventory/${propertyId}/access/${actors.agent.id}/review`)
      .set(h('delegate'))
      .send({ action: 'approve', expectedUpdatedAt: row.updatedAt.toISOString() })
      .expect(409);
    const locked = (
      await api()
        .get('/api/inventory/' + propertyId)
        .set(h('agent'))
        .expect(200)
    ).body;
    expect(locked).toMatchObject({ detailAccess: 'REVOKED', houseNo: null, contacts: [], photoUrls: [] });
    await api()
      .post('/api/inventory/' + propertyId + '/photo-gallery')
      .set(h('agent'))
      .expect(400);
    await api()
      .post('/api/inventory/' + propertyId + '/access/request')
      .set(h('agent'))
      .expect(201);
    expect((await db.inventoryDetailAccess.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PENDING');
  });

  it('keeps notifications and acceptance atomic across retries and reassignment', async () => {
    const lead = await db.lead.create({ data: { organizationId: orgId, name: 'Assignment verification', phone: '+919701188001' } });
    await Promise.all(
      [1, 2].map(() =>
        api()
          .patch('/api/leads/' + lead.id + '/assign')
          .set(h('admin'))
          .send({ assignedToId: actors.agent.id })
          .expect(200),
      ),
    );
    const first = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(first.assignmentId).toBeTruthy();
    expect(await db.notification.count({ where: { userId: actors.agent.id, kind: 'LEAD_ASSIGNED', data: { path: ['leadId'], equals: lead.id } } })).toBe(1);
    await api()
      .post('/api/leads/' + lead.id + '/assignment/accept')
      .set(h('admin'))
      .send({ assignmentId: first.assignmentId })
      .expect(403);
    await Promise.all(
      [1, 2].map(() =>
        api()
          .post('/api/leads/' + lead.id + '/assignment/accept')
          .set(h('agent'))
          .send({ assignmentId: first.assignmentId })
          .expect(201),
      ),
    );
    expect(await db.activity.count({ where: { leadId: lead.id, content: 'Assigned lead accepted' } })).toBe(1);
    expect(
      await db.notification.count({ where: { userId: actors.admin.id, kind: 'LEAD_ASSIGNMENT_ACCEPTED', data: { path: ['leadId'], equals: lead.id } } }),
    ).toBe(1);
    await api()
      .patch('/api/leads/' + lead.id + '/assign')
      .set(h('admin'))
      .send({ assignedToId: actors.delegate.id })
      .expect(200);
    const next = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(next.assignmentAcceptedAt).toBeNull();
    expect(next.assignmentId).not.toBe(first.assignmentId);
    await api()
      .post('/api/leads/' + lead.id + '/assignment/accept')
      .set(h('delegate'))
      .send({ assignmentId: first.assignmentId })
      .expect(409);
    await api()
      .post('/api/leads/' + lead.id + '/assignment/accept')
      .set(h('delegate'))
      .send({ assignmentId: next.assignmentId })
      .expect(201);
    const hidden = await app.get(NotificationsService).hiddenLeadNotifications(actors.delegate.id);
    const notification = await db.notification.findFirstOrThrow({
      where: { userId: actors.delegate.id, kind: 'LEAD_ASSIGNED', data: { path: ['leadId'], equals: lead.id } },
    });
    expect(hidden).not.toContain(notification.id);
  });

  it('extracts explicit BHK and furnishing while keeping an existing reviewed requirement', async () => {
    const service = app.get(LeadsService);
    const phone = '+919701188002';
    const first = await service.ingest({ orgId, source: 'HOUSING', phone, message: 'Interested in 3 BHK fully furnished in Sector 43' });
    expect(await db.leadRequirement.findUnique({ where: { leadId: first.lead.id } })).toMatchObject({ bedrooms: [3], furnishing: 'FULLY_FURNISHED' });
    await db.leadRequirement.update({ where: { leadId: first.lead.id }, data: { bedrooms: [2], furnishing: 'SEMI_FURNISHED' } });
    await service.ingest({ orgId, source: 'HOUSING', phone, message: 'Interested in 3 BHK fully furnished' });
    expect(await db.leadRequirement.findUnique({ where: { leadId: first.lead.id } })).toMatchObject({ bedrooms: [2], furnishing: 'SEMI_FURNISHED' });
  });
});
