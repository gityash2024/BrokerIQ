import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { offeredRequirement } from '@brokeriq/shared';

describe('Independent requirement conversion (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, org: string, admin: string, agent: string, other: string;
  const req = () => request(app.getHttpServer());
  const h = (token = admin) => ({ Authorization: `Bearer ${token}` });
  const stamp = Date.now().toString(36);
  const offer = () =>
    offeredRequirement({
      sector: 'Sector 43',
      houseNo: 'Conversion fixture',
      floor: '2nd floor',
      purpose: 'RENT',
      monthlyRent: 35000,
      availability: 'UNKNOWN',
      contacts: [{ phone: '+919700000901', role: 'OWNER' }],
    });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Conversion fixture ' + stamp, slug: 'conversion-' + stamp } })).id;
    for (const [name, role] of [
      ['admin', 'BROKER_ADMIN'],
      ['agent', 'BROKER_AGENT'],
      ['other', 'BROKER_AGENT'],
    ] as const) {
      const user = await db.user.create({
        data: { name, email: `${name}.conversion.${stamp}@e2e.test`, role, organizationId: org },
        include: { organization: true },
      });
      const token = (await app.get(AuthService).issue(user)).accessToken;
      if (name === 'admin') admin = token;
      else if (name === 'agent') agent = token;
      else other = token;
    }
  });
  afterAll(async () => {
    await app?.close();
  });
  it('preserves unknowns and demand independently; neither can be converted', async () => {
    for (const input of [
      { intent: 'UNKNOWN', title: 'Ambiguous source', notes: 'Needs review' },
      { intent: 'DEMAND', purpose: 'RENT', localityNames: ['Sector 43'], maxBudget: 40000 },
    ]) {
      const result = await req().post('/api/broker-requirements').set(h()).send(input).expect(201);
      await req().post(`/api/broker-requirements/${result.body.id}/convert`).set(h()).send({ expectedRevision: result.body.revision }).expect(400);
    }
    expect(await db.inventoryItem.count({ where: { organizationId: org } })).toBe(0);
  });
  it('keeps ownership boundaries and converts exactly once under concurrent requests', async () => {
    const record = (await req().post('/api/broker-requirements').set(h(agent)).send(offer()).expect(201)).body;
    await req().get(`/api/broker-requirements/${record.id}`).set(h(other)).expect(404);
    await req().post(`/api/broker-requirements/${record.id}/convert`).set(h(other)).send({ expectedRevision: record.revision }).expect(404);
    await req()
      .patch(`/api/broker-requirements/${record.id}`)
      .set(h(agent))
      .send({ ...offer(), expectedRevision: 99 })
      .expect(409);
    const converted = await Promise.all(
      [1, 2, 3].map(() => req().post(`/api/broker-requirements/${record.id}/convert`).set(h(agent)).send({ expectedRevision: record.revision }).expect(201)),
    );
    expect(new Set(converted.map((r) => r.body.inventoryId)).size).toBe(1);
    const inventoryId = converted[0].body.inventoryId;
    const inventory = (await req().get(`/api/inventory/${inventoryId}`).set(h(agent)).expect(200)).body;
    await req().patch(`/api/inventory/${inventoryId}`).set(h(agent)).send({ expectedRevision: inventory.revision, monthlyRent: 37000 }).expect(200);
    const original = (await req().get(`/api/broker-requirements/${record.id}`).set(h(agent)).expect(200)).body;
    expect(original.offerDetails.monthlyRent).toBe(35000);
    expect(original.convertedInventoryId).toBe(inventoryId);
    expect(original.convertedAt).toBeTruthy();
    expect(await db.inventoryItem.count({ where: { organizationId: org } })).toBe(1);
    await req().get(`/api/inventory/${inventoryId}`).set(h(other)).expect(404);
  });
  it('requires reviewed purpose/address and rejects stale conversion without inventing data', async () => {
    const input = offeredRequirement({ notes: 'Property facts incomplete' });
    const item = (await req().post('/api/broker-requirements').set(h()).send(input).expect(201)).body;
    await req().post(`/api/broker-requirements/${item.id}/convert`).set(h()).send({ expectedRevision: item.revision }).expect(400);
    const saved = (
      await req()
        .patch(`/api/broker-requirements/${item.id}`)
        .set(h())
        .send({ ...offer(), expectedRevision: item.revision })
        .expect(200)
    ).body;
    await req().post(`/api/broker-requirements/${item.id}/convert`).set(h()).send({ expectedRevision: item.revision }).expect(409);
    await req().post(`/api/broker-requirements/${item.id}/convert`).set(h()).send({ expectedRevision: saved.revision }).expect(201);
  });
});
