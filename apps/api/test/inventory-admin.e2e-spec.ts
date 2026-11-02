import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Inventory all-firms hierarchy, complete exports and safe assignment (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService;
  let org: string, other: string, sa: string, broker: string, agent: string, outsider: string;
  let agentId: string, foreignId: string, item: any, foreign: any;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const h = (token = sa) => ({ Authorization: 'Bearer ' + token });
  const get = (path: string, token = sa) =>
    request(app.getHttpServer())
      .get('/api/inventory' + path)
      .set(h(token));
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Inventory firm ' + uid, slug: 'inventory-admin-' + uid } })).id;
    other = (await db.organization.create({ data: { name: 'Other inventory firm ' + uid, slug: 'inventory-other-' + uid } })).id;
    const actor = async (name: string, role: Role, organizationId?: string) => {
      const user = await db.user.create({ data: { name, role, organizationId, email: name + uid + '@e2e.test' }, include: { organization: true } });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    sa = (await actor('inventory-super', 'SUPER_ADMIN')).token;
    broker = (await actor('inventory-broker', 'BROKER_ADMIN', org)).token;
    const a = await actor('inventory-agent', 'BROKER_AGENT', org);
    agent = a.token;
    agentId = a.id;
    const o = await actor('inventory-outsider', 'BROKER_AGENT', other);
    outsider = o.token;
    foreignId = o.id;
    await db.user.createMany({
      data: Array.from({ length: 34 }, (_, i) => ({
        name: 'Paged member ' + i,
        role: 'BROKER_AGENT',
        organizationId: org,
        email: `paged.${i}.${uid}@e2e.test`,
      })),
    });
    item = await db.inventoryItem.create({
      data: {
        organizationId: org,
        assignedToId: agentId,
        houseNo: 'Own-' + uid,
        sector: 'Sector 45',
        purpose: 'RENT',
        monthlyRent: 23000,
        bhk: 2,
        ownerName: '=HYPERLINK("bad")',
        ownerPhone: '+919899980802',
      },
    });
    foreign = await db.inventoryItem.create({
      data: { organizationId: other, assignedToId: foreignId, houseNo: 'Foreign-' + uid, sector: 'Sector 45', purpose: 'RENT', monthlyRent: 23000, bhk: 2 },
    });
    await db.inventoryItem.createMany({
      data: Array.from({ length: 56 }, (_, i) => ({
        organizationId: org,
        assignedToId: agentId,
        houseNo: `Paged-${i}-${uid}`,
        sector: 'Sector 45',
        purpose: 'SALE',
        totalSalePrice: 15000000,
      })),
    });
    const lead = await db.lead.create({
      data: { name: 'Matching ' + uid, phone: '+919876543210', organizationId: other, assignedToId: foreignId, stage: 'NEW' },
    });
    await db.leadRequirement.create({ data: { leadId: lead.id, purpose: 'RENT', bedrooms: [2], minBudget: 22000, maxBudget: 24000 } });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('shows every authorized firm without selecting one and keeps match counts within each firm', async () => {
    const result = (await get(`?search=${uid}&pageSize=100`).expect(200)).body;
    expect(result.items.some((i: any) => i.id === item.id && i.organization.id === org)).toBe(true);
    expect(result.items.some((i: any) => i.id === foreign.id && i.organization.id === other)).toBe(true);
    expect(result.items.find((i: any) => i.id === item.id).matchingLeadsCount).toBe(0);
    expect(result.items.find((i: any) => i.id === foreign.id).matchingLeadsCount).toBe(1);
    const own = (await get(`?organizationId=${org}&search=${uid}`).expect(200)).body;
    expect(own.total).toBe(57);
    expect(own.items.every((i: any) => i.organizationId === org)).toBe(true);
  });
  it('pages lean hierarchy choices and denies hierarchy access to broker roles', async () => {
    const first = (await get(`/hierarchy/members?organizationId=${org}`).expect(200)).body;
    const second = (await get(`/hierarchy/members?organizationId=${org}&page=2`).expect(200)).body;
    expect(first.items.length).toBe(30);
    expect(first.total).toBe(36);
    expect(second.items.length).toBe(6);
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(36);
    expect(Object.keys(first.items[0]).sort()).toEqual(['id', 'name', 'organization', 'role', 'status']);
    for (const token of [broker, agent, outsider]) await get('/hierarchy/organizations', token).expect(403);
    await get('/hierarchy/members?page=0').expect(400);
  });
  it('exports all filtered rows regardless of page, with escaped names and preserved phone text', async () => {
    const result = await get(`/export?organizationId=${org}&search=${uid}&page=2&pageSize=1`).expect(200);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.text.split('\n').length).toBe(58);
    expect(result.text).toContain("'+919899980802");
    expect(result.text).toContain('"\'=HYPERLINK(""bad"")"');
    expect(result.text).not.toContain(foreign.houseNo);
    const selected = await get(`/export?ids=${item.id},${foreign.id}`, agent).expect(200);
    expect(selected.text).toContain(item.houseNo);
    expect(selected.text).not.toContain(foreign.houseNo);
    expect(selected.text.split('\n').length).toBe(2);
    const forced = await get(`/export?organizationId=${other}&search=${uid}`, broker).expect(200);
    expect(forced.text).not.toContain(foreign.houseNo);
    await get('/export?ids=').expect(400);
    await get('/export?dateFrom=2026-11-02T00:00:00Z&dateTo=2026-11-01T00:00:00Z').expect(400);
  });
  it('rejects cross-firm reassignment even for Super Admin and preserves all original fields', async () => {
    await request(app.getHttpServer())
      .patch('/api/inventory/' + item.id)
      .set(h())
      .send({ assignedToId: foreignId })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/inventory/' + item.id)
      .set(h())
      .send({ organizationId: other, assignedToId: foreignId })
      .expect(400);
    const current = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(current.organizationId).toBe(org);
    expect(current.assignedToId).toBe(agentId);
    expect(Number(current.monthlyRent)).toBe(23000);
  });
  it('requires an explicit firm on Super Admin create and accepts a full editable Sale record', async () => {
    await request(app.getHttpServer()).post('/api/inventory').set(h()).send({ sector: 'Sector 45', purpose: 'SALE' }).expect(403);
    const saved = (
      await request(app.getHttpServer())
        .post('/api/inventory')
        .set(h())
        .send({
          organizationId: org,
          sector: 'Sector 45',
          purpose: 'SALE',
          totalSalePrice: 18000000,
          assignedToId: agentId,
          details: { projectName: 'Reviewed source' },
        })
        .expect(201)
    ).body;
    expect(saved.organizationId).toBe(org);
    expect(saved.totalSalePrice).toBe(18000000);
    expect(saved.details.projectName).toBe('Reviewed source');
  });
  it('archives reversibly, prevents agent/cross-firm restoration and never republishes automatically', async () => {
    await request(app.getHttpServer())
      .delete('/api/inventory/' + item.id)
      .set(h())
      .expect(200);
    expect((await get(`?organizationId=${org}&houseNo=${item.houseNo}`).expect(200)).body.total).toBe(0);
    const archived = (await get(`?organizationId=${org}&archived=only&houseNo=${item.houseNo}`).expect(200)).body;
    expect(archived.items[0].deletedAt).toBeTruthy();
    expect(archived.items[0].ownerPhone).toBe(item.ownerPhone);
    await get('?archived=include', agent).expect(403);
    await request(app.getHttpServer()).post(`/api/inventory/${item.id}/restore`).set(h(agent)).expect(403);
    await request(app.getHttpServer()).post(`/api/inventory/${item.id}/restore`).set(h(outsider)).expect(403);
    const restored = (await request(app.getHttpServer()).post(`/api/inventory/${item.id}/restore`).set(h(broker)).expect(201)).body;
    expect(restored.deletedAt).toBeNull();
    expect(restored.ownerPhone).toBe(item.ownerPhone);
    expect(restored.isPublished).toBe(false);
  });
});
