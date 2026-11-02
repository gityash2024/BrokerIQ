import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SettingsService } from '../src/core/settings/settings.service';

describe('Explicit Super Admin firm connector management (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, settings: SettingsService;
  let org: string, other: string, admin: { id: string; token: string };
  const actors: Partial<Record<Role, { id: string; token: string }>> = {};
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const secret = 'fixture-only-private-textbee-key-' + uid;
  const headers = (actor = admin) => ({ Authorization: 'Bearer ' + actor.token });
  const endpoint = () => `/api/admin/organizations/${org}/connectors`;
  const payload = {
    enabled: true,
    fields: { apiKey: secret, deviceId: 'fixture-device-' + uid, senderPhone: '+919899980802', simSubscriptionId: 1, inboundEnabled: false },
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    settings = app.get(SettingsService);
    org = (await db.organization.create({ data: { name: 'Isolated connector firm', slug: 'connector-firm-' + uid } })).id;
    other = (await db.organization.create({ data: { name: 'Other isolated connector firm', slug: 'connector-other-' + uid } })).id;
    for (const role of ['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER', 'SUPPORT', 'MODERATOR'] as Role[]) {
      const user = await db.user.create({
        data: { name: role, email: role + '.' + uid + '@e2e.test', role, organizationId: role.startsWith('BROKER_') ? org : null },
        include: { organization: true },
      });
      actors[role] = { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    }
    admin = actors.SUPER_ADMIN!;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('denies every non-Super Admin role on read/write/test/remove even within its own firm', async () => {
    for (const role of ['BROKER_ADMIN', 'BROKER_AGENT', 'USER', 'SUPPORT', 'MODERATOR'] as Role[]) {
      const h = headers(actors[role]!);
      await request(app.getHttpServer()).get(endpoint()).set(h).expect(403);
      await request(app.getHttpServer())
        .patch(endpoint() + '/textbee')
        .set(h)
        .send(payload)
        .expect(403);
      await request(app.getHttpServer())
        .post(endpoint() + '/textbee/test')
        .set(h)
        .expect(403);
      await request(app.getHttpServer())
        .delete(endpoint() + '/textbee')
        .set(h)
        .expect(403);
    }
    expect(await db.orgSetting.count({ where: { organizationId: org } })).toBe(0);
  });
  it('stores encrypted credentials only for the explicit firm and records that firm in the audit', async () => {
    const saved = await request(app.getHttpServer())
      .patch(endpoint() + '/textbee')
      .set(headers())
      .send(payload)
      .expect(200);
    expect(saved.body.configured).toBe(true);
    expect(JSON.stringify(saved.body)).not.toContain(secret);
    const stored = await db.orgSetting.findUniqueOrThrow({ where: { organizationId_key: { organizationId: org, key: 'integration.textbee' } } });
    expect(JSON.stringify(stored.value)).not.toContain(secret);
    expect(stored.updatedById).toBe(admin.id);
    const selected = await request(app.getHttpServer()).get(endpoint()).set(headers()).expect(200);
    expect(selected.body.firm.id).toBe(org);
    expect(JSON.stringify(selected.body)).not.toContain(secret);
    const distinct = await request(app.getHttpServer()).get(`/api/admin/organizations/${other}/connectors`).set(headers()).expect(200);
    expect(distinct.body.connectors.find((x: any) => x.key === 'textbee').config.configured).toBe(false);
    expect(await db.auditLog.count({ where: { actorId: admin.id, organizationId: org, action: 'connector.update', entityId: 'textbee' } })).toBe(1);
    await request(app.getHttpServer()).get('/api/admin/organizations/missing-firm/connectors').set(headers()).expect(404);
  });
  it('never treats a platform credential as a firm connector, including legacy broker delete/test routes', async () => {
    await settings.save(
      'smtp',
      { enabled: false, fields: { host: 'fixture.invalid', port: 465, user: 'fixture', pass: secret, fromEmail: 'fixture@e2e.test' } },
      { userId: admin.id },
    );
    await request(app.getHttpServer()).delete('/api/broker/connectors/smtp').set(headers(actors.BROKER_ADMIN!)).expect(400);
    await request(app.getHttpServer()).post('/api/broker/connectors/smtp/test').set(headers(actors.BROKER_ADMIN!)).expect(400);
    await request(app.getHttpServer())
      .delete(endpoint() + '/smtp')
      .set(headers())
      .expect(400);
    expect(await db.systemSetting.count({ where: { key: 'integration.smtp' } })).toBe(1);
    await expect(settings.remove('smtp', org)).rejects.toThrow('Platform credentials');
    await expect(settings.save('smtp', { enabled: false, fields: {} }, { orgId: org, userId: actors.BROKER_ADMIN!.id })).rejects.toThrow(
      'Platform credentials',
    );
    await request(app.getHttpServer())
      .patch(endpoint() + '/gmail')
      .set(headers())
      .send({ fields: { mailboxEmail: 'forged@e2e.test' } })
      .expect(400);
    await request(app.getHttpServer())
      .delete(endpoint() + '/gmail')
      .set(headers())
      .expect(400);
    await request(app.getHttpServer())
      .delete(endpoint() + '/textbee')
      .set(headers())
      .expect(200);
    expect(await db.orgSetting.count({ where: { organizationId: org, key: 'integration.textbee' } })).toBe(0);
  });
});
