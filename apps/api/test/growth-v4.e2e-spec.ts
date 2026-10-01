import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json, urlencoded } from 'express';
import webpush from 'web-push';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeaturesService } from '../src/core/features/features.service';
import { NotificationsService } from '../src/core/notifications/notifications.service';

/** Website push (VAPID) and user referrals. */
jest.setTimeout(60000);

const uniq = `${process.env.E2E_UNIQ!}g`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Web push & referrals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json());
    app.use(urlencoded({ extended: true }));
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.featureFlag.deleteMany({ where: { key: { in: ['web_push', 'referrals'] } } });
    app.get(FeaturesService).invalidate();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('web push: stable VAPID key, validated subscriptions, delivery and cleanup of dead ones', async () => {
    const k1 = await http.get('/api/public/webpush-key').expect(200);
    const k2 = await http.get('/api/public/webpush-key').expect(200);
    expect(k1.body.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(k2.body.publicKey).toBe(k1.body.publicKey);
    const stored = await prisma.systemSetting.findUniqueOrThrow({ where: { key: 'webpush.vapid' } });
    expect(JSON.stringify(stored.value)).not.toMatch(/"privateKey"/);

    const u = await http
      .post('/api/auth/register')
      .send({ name: 'Push User', email: email('push'), password: 'Passw0rd!' })
      .expect(201);
    await http.post('/api/me/push-tokens').set(auth(u.body.accessToken)).send({ platform: 'web', token: '{"endpoint":"http://evil"}' }).expect(400);
    const good = JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/${uniq}a`, keys: { p256dh: 'p', auth: 'a' } });
    const dead = JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/${uniq}b`, keys: { p256dh: 'p', auth: 'a' } });
    await http.post('/api/me/push-tokens').set(auth(u.body.accessToken)).send({ platform: 'web', token: good }).expect(201);
    await http.post('/api/me/push-tokens').set(auth(u.body.accessToken)).send({ platform: 'web', token: dead }).expect(201);

    const sent: any[] = [];
    jest.spyOn(webpush, 'sendNotification').mockImplementation(async (sub: any, payload: any) => {
      if (sub.endpoint.endsWith('b')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push({ sub, payload: JSON.parse(payload) });
      return { statusCode: 201, body: '', headers: {} };
    });
    await app.get(NotificationsService).notify(u.body.user.id, { kind: 'TEST', title: 'Hello', body: 'World', link: '/account' });
    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ title: 'Hello', body: 'World', link: '/account' });
    expect(await prisma.pushToken.count({ where: { userId: u.body.user.id, platform: 'web' } })).toBe(1);
  });

  it('referrals: personal link, friend signup is counted and the referrer is thanked', async () => {
    const a = await http
      .post('/api/auth/register')
      .send({ name: 'Asha Inviter', email: email('asha'), password: 'Passw0rd!' })
      .expect(201);
    const r = await http.get('/api/me/referral').set(auth(a.body.accessToken)).expect(200);
    expect(r.body.code).toMatch(/^[A-Z2-9]{7}$/);
    expect(r.body.url).toContain(`/signup?ref=${r.body.code}`);
    expect((await http.get('/api/me/referral').set(auth(a.body.accessToken)).expect(200)).body.code).toBe(r.body.code);

    await http
      .post('/api/auth/register')
      .send({ name: 'Ravi Friend', email: email('ravi'), password: 'Passw0rd!', ref: r.body.code.toLowerCase() })
      .expect(201);
    await http
      .post('/api/auth/register')
      .send({ name: 'No Ref', email: email('noref'), password: 'Passw0rd!', ref: 'ZZZZZZZ' })
      .expect(201);
    const after = await http.get('/api/me/referral').set(auth(a.body.accessToken)).expect(200);
    expect(after.body).toMatchObject({ signups: 1, movedIn: 0, badge: 'Helper' });
    const thanks = await prisma.notification.findFirst({ where: { userId: a.body.user.id, kind: 'REFERRAL' } });
    expect(thanks?.body).toContain('Ravi');
  });
});
