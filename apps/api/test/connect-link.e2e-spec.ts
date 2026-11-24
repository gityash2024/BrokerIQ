import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { randomToken, sha256 } from '../src/common/utils';
import { env } from '../src/config/env';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

it('links an approved BrokerIQ session once with its verifier and rejects a revoked approver', async () => {
  const app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
  const config = env();
  const original = config.CONNECT_ENABLED;
  try {
    config.CONNECT_ENABLED = true;
    configureApp(app);
    await app.init();
    const db = app.get(PrismaService);
    const organization = await db.organization.create({ data: { name: 'Device linking validation', slug: 'link-' + randomToken(12) } });
    const user = await db.user.create({
      data: { role: 'BROKER_AGENT', name: 'Device linking validation', email: randomToken(12) + '@e2e.test', organizationId: organization.id },
      include: { organization: true },
    });
    const auth = app.get(AuthService);
    const source = await auth.issue(user);
    const http = () => request(app.getHttpServer());
    const verifier = randomToken(32);
    const start = async () =>
      (await http().post('/api/auth/connect-link/start').send({ verifierHash: sha256(verifier) }).expect(200)).body as { id: string; code: string };
    const link = await start();
    const approve = (accessToken: string, pair: { id: string; code: string }) =>
      http().post('/api/auth/connect-link/approve').set('Authorization', 'Bearer ' + accessToken).send(pair);
    const exchange = (id: string, proof = verifier) => http().post('/api/auth/connect-link/exchange').send({ id, verifier: proof });
    await http().post('/api/auth/connect-link/approve').send({ id: link.id, code: link.code }).expect(401);
    await approve(source.accessToken, { id: link.id, code: link.code === '123456' ? '654321' : '123456' }).expect(401);
    expect((await exchange(link.id).expect(200)).body).toEqual({ pending: true });
    await approve(source.accessToken, { id: link.id, code: link.code }).expect(200);
    await exchange(link.id, randomToken(32)).expect(401);
    const exchanges = await Promise.all([exchange(link.id), exchange(link.id)]);
    expect(exchanges.map((response) => response.status).sort()).toEqual([200, 401]);
    const target = exchanges.find((response) => response.status === 200)!.body;
    expect(target.user.id).toBe(user.id);
    expect(target.refreshToken).not.toBe(source.refreshToken);
    await http().post('/api/connect/devices').set('Authorization', 'Bearer ' + target.accessToken)
      .send({ installId: randomUUID(), label: 'Android handset', version: 4 }).expect(201)
      .expect(({ body }) => expect(body.settings).toMatchObject({ consent: false }));
    await http().get('/api/auth/me').set('Authorization', 'Bearer ' + source.accessToken).expect(200);

    const next = await start();
    await approve(source.accessToken, { id: next.id, code: next.code }).expect(200);
    await auth.logout(source.refreshToken);
    await exchange(next.id).expect(401);
    await http().get('/api/auth/me').set('Authorization', 'Bearer ' + target.accessToken).expect(200);
  } finally {
    config.CONNECT_ENABLED = original;
    await app.close();
  }
}, 30_000);
