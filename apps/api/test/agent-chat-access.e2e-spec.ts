import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { NotificationsService } from '../src/core/notifications/notifications.service';
import { RealtimeGateway } from '../src/core/realtime/realtime.gateway';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Broker Agent Chat permission', () => {
  let app: INestApplication;
  let db: PrismaService;
  const token = (accessToken: string) => ({ Authorization: 'Bearer ' + accessToken });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
  });
  afterAll(async () => { await app?.close(); });

  it('applies a firm administrator’s changes to an existing session and its inbox notifications', async () => {
    const key = randomUUID();
    const firm = await db.organization.create({ data: { name: 'Chat access QA', slug: 'chat-access-' + key } });
    const outer = await db.organization.create({ data: { name: 'Other Chat access QA', slug: 'chat-access-outer-' + key } });
    const identity = async (name: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT' | 'SUB_BROKER_ADMIN', organizationId = firm.id) => {
      const user = await db.user.create({ data: { organizationId, name, role, email: name + key + '@e2e.test',
        delegatedPermissions: role === 'SUB_BROKER_ADMIN' ? ['team:view', 'team:edit', 'inbox:view'] : [] }, include: { organization: true } });
      return { user, headers: token((await app.get(AuthService).issue(user)).accessToken) };
    };
    const admin = await identity('admin', 'BROKER_ADMIN');
    const agent = await identity('agent', 'BROKER_AGENT');
    const peer = await identity('peer', 'BROKER_AGENT');
    const delegate = await identity('delegate', 'SUB_BROKER_ADMIN');
    const outsider = await identity('outside', 'BROKER_ADMIN', outer.id);
    const path = '/api/broker/team/members/' + agent.user.id + '/chat-access';
    const inbox = '/api/whatsapp/conversations?channel=CHAT';
    const notify = app.get(NotificationsService);
    const realtime = jest.spyOn(app.get(RealtimeGateway), 'toUser');
    await http().get('/api/auth/me').set(agent.headers).expect(200).expect(({ body }) => expect(body.agentChatEnabled).toBe(true));
    await http().get(inbox).set(agent.headers).expect(200);
    await notify.notify(agent.user.id, { kind: 'NEW_MESSAGE', title: 'Inbox item', link: '/broker/inbox?channel=CHAT', push: false });
    await http().patch(path).set(outsider.headers).send({ enabled: false }).expect(404);
    await http().patch(path).set(delegate.headers).send({ enabled: false }).expect(403);
    await http().patch(path).set(agent.headers).send({ enabled: false }).expect(403);
    await http().patch(path).set(admin.headers).send({ enabled: false }).expect(200).expect(({ body }) => expect(body.enabled).toBe(false));
    expect(realtime).toHaveBeenCalledWith(agent.user.id, 'agent.chat_access_changed', {});
    await http().get('/api/auth/me').set(agent.headers).expect(200).expect(({ body }) => expect(body.agentChatEnabled).toBe(false));
    await http().get(inbox).set(agent.headers).expect(403);
    await http().get('/api/chat/threads').set(agent.headers).expect(403);
    await http().get('/api/messaging/status').set(agent.headers).expect(403);
    await http().get('/api/leads').set(agent.headers).expect(200);
    await http().get(inbox).set(peer.headers).expect(200);
    await notify.notify(agent.user.id, { kind: 'NEW_MESSAGE', title: 'Denied item', link: '/broker/inbox?channel=CHAT', push: false });
    expect(await db.notification.count({ where: { userId: agent.user.id } })).toBe(1);
    await http().get('/api/me/notifications').set(agent.headers).expect(200).expect(({ body }) => expect(body.items).toHaveLength(0));
    await http().patch(path).set(admin.headers).send({ enabled: true }).expect(200);
    await http().get(inbox).set(agent.headers).expect(200);
    await http().get('/api/me/notifications').set(agent.headers).expect(200).expect(({ body }) => expect(body.items).toHaveLength(1));
    expect(await db.auditLog.count({ where: { entityId: agent.user.id, action: 'team.agent_chat_access' } })).toBe(2);
    realtime.mockRestore();
  });
});
