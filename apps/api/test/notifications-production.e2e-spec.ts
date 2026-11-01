import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { NotificationsService } from '../src/core/notifications/notifications.service';
import { RealtimeGateway } from '../src/core/realtime/realtime.gateway';

describe('Owned notifications and complete pagination (real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService;
  let a: { id: string; token: string }, b: { id: string; token: string };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    const actor = async () => {
      const user = await db.user.create({
        data: { email: `notifications.${Date.now()}.${Math.random()}@e2e.test`, name: 'Isolated notification account', role: 'USER' },
      });
      return { id: user.id, token: (await app.get(AuthService).issue({ ...user, organization: null })).accessToken };
    };
    a = await actor();
    b = await actor();
    await db.notification.createMany({
      data: Array.from({ length: 103 }, (_, i) => ({ userId: a.id, kind: 'SYSTEM', title: 'Isolated notification ' + i, link: '/account/messages' })),
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  const auth = (actor: { token: string }) => ({ Authorization: 'Bearer ' + actor.token });
  it('returns every row once, including ties, and denies another account cursor', async () => {
    const ids: string[] = [];
    let cursor = '';
    do {
      const result = await request(app.getHttpServer())
        .get('/api/me/notifications' + (cursor ? '?cursor=' + cursor : ''))
        .set(auth(a))
        .expect(200);
      ids.push(...result.body.items.map((n: any) => n.id));
      cursor = result.body.nextCursor;
    } while (cursor);
    expect(ids.length).toBe(103);
    expect(new Set(ids).size).toBe(103);
    await request(app.getHttpServer())
      .get('/api/me/notifications?cursor=' + ids[0])
      .set(auth(b))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/me/notifications/' + ids[0] + '/open')
      .set(auth(b))
      .send({})
      .expect(404);
    expect((await db.notification.findUniqueOrThrow({ where: { id: ids[0] } })).readAt).toBeNull();
    await request(app.getHttpServer())
      .post('/api/me/notifications/' + ids[0] + '/open')
      .set(auth(a))
      .send({})
      .expect(201);
    expect((await request(app.getHttpServer()).get('/api/me/notifications').set(auth(a))).body.unreadCount).toBe(102);
  });
  it('an empty selection marks nothing, malformed input fails, all-read remains explicit', async () => {
    const before = await db.notification.count({ where: { userId: a.id, readAt: null } });
    await request(app.getHttpServer()).post('/api/me/notifications/read').set(auth(a)).send({ ids: [] }).expect(201);
    expect(await db.notification.count({ where: { userId: a.id, readAt: null } })).toBe(before);
    await request(app.getHttpServer()).post('/api/me/notifications/read').set(auth(a)).send({ ids: 'wrong' }).expect(400);
    await request(app.getHttpServer()).post('/api/me/notifications/read').set(auth(a)).send({}).expect(201);
    expect(await db.notification.count({ where: { userId: a.id, readAt: null } })).toBe(0);
  });
  it('emits durable per-recipient ids that custom data cannot replace; excludes inactive/excluded recipients', async () => {
    const realtime = jest.spyOn(app.get(RealtimeGateway), 'toUser');
    const service = app.get(NotificationsService);
    await service.notify(
      [a.id, a.id, b.id],
      { kind: 'SYSTEM', title: 'Durable id', link: '/account/messages', push: false, data: { recipientUserId: b.id, notificationId: 'fake', link: '/admin' } },
      { excludeUserId: b.id },
    );
    const note = await db.notification.findFirstOrThrow({ where: { userId: a.id, title: 'Durable id' } });
    expect(realtime).toHaveBeenCalledWith(
      a.id,
      'notification',
      expect.objectContaining({ notificationId: note.id, recipientUserId: a.id, link: '/account/messages' }),
    );
    expect(await db.notification.count({ where: { userId: b.id, title: 'Durable id' } })).toBe(0);
    await db.user.update({ where: { id: b.id }, data: { status: 'SUSPENDED' } });
    await service.notify(b.id, { kind: 'SYSTEM', title: 'Inactive account', push: false });
    expect(await db.notification.count({ where: { userId: b.id } })).toBe(0);
    realtime.mockRestore();
  });
});
