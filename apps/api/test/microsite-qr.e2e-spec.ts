import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { env } from '../src/config/env';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Firm microsite QR and authenticated enquiry attribution', () => {
  let app: INestApplication;
  let db: PrismaService;
  let firm: { id: string; slug: string };
  let otherFirm: { id: string; slug: string };
  const tokens = new Map<Role, string>();
  const stamp = randomUUID();
  const path = '/api/broker/profile/microsite-qr';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    firm = await db.organization.create({ data: { name: 'Isolated QR firm', slug: 'microsite-' + stamp } });
    otherFirm = await db.organization.create({ data: { name: 'Isolated second firm', slug: 'other-' + stamp } });
    for (const role of ['BROKER_ADMIN', 'BROKER_AGENT', 'USER', 'SUPER_ADMIN'] as const) {
      const user = await db.user.create({
        data: { name: role, email: `${role}.${stamp}@e2e.test`, role, organizationId: role.startsWith('BROKER_') ? firm.id : null },
        include: { organization: true },
      });
      tokens.set(role, (await app.get(AuthService).issue(user)).accessToken);
    }
  });
  afterAll(async () => {
    await app?.close();
  });

  it('generates a PNG for the current firm even when a different organizationId is supplied', async () => {
    const response = await request(app.getHttpServer())
      .get(path)
      .query({ organizationId: otherFirm.id })
      .auth(tokens.get('BROKER_ADMIN')!, { type: 'bearer' })
      .expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    const target = new URL(response.body.url);
    expect(target.origin).toBe(new URL(env().PUBLIC_WEB_URL).origin);
    expect(target.pathname).toBe(`/brokers/${firm.slug}`);
    expect(target.search).toBe('?via=qr');
    expect(response.body.qrPngDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(Buffer.from(response.body.qrPngDataUrl.split(',')[1], 'base64').subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('rejects guest, customer, agent and platform-admin QR generation requests', async () => {
    await request(app.getHttpServer()).get(path).expect(401);
    for (const role of ['USER', 'BROKER_AGENT', 'SUPER_ADMIN'] as const) {
      await request(app.getHttpServer()).get(path).auth(tokens.get(role)!, { type: 'bearer' }).expect(403);
    }
  });

  it('attributes an authenticated QR enquiry to the selected firm and rejects a listing or project QR claim', async () => {
    const body = { organizationId: firm.id, name: 'Isolated microsite visitor', phone: '+919700004101', source: 'MICROSITE_QR' };
    const post = () => request(app.getHttpServer()).post('/api/enquiries').auth(tokens.get('USER')!, { type: 'bearer' });
    await request(app.getHttpServer()).post('/api/enquiries').send(body).expect(401);
    await post()
      .send({ ...body, projectId: 'unrelated-project' })
      .expect(400);
    await post()
      .send({ ...body, listingId: 'unrelated-listing' })
      .expect(400);
    const result = await post().send(body).expect(201);
    const enquiry = await db.enquiry.findUniqueOrThrow({ where: { id: result.body.id } });
    expect(enquiry).toMatchObject({ organizationId: firm.id, source: 'MICROSITE_QR' });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: enquiry.leadId! } });
    expect(lead).toMatchObject({ organizationId: firm.id, source: 'MICROSITE', sourceDetail: 'Microsite QR contact form' });
  });
});
