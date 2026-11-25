import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { SettingsService } from '../src/core/settings/settings.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { WhatsAppBroadcastService } from '../src/modules/whatsapp/whatsapp-broadcast.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Firm-owned WhatsApp broadcast', () => {
  let app: INestApplication;
  let db: PrismaService;
  const http = () => request(app.getHttpServer());
  const base = '/api/whatsapp/broadcast';

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
  });
  afterAll(async () => { await app?.close(); });

  it('deduplicates overlapping groups and queues once, keeps opt-outs and checks firm and grants before sending', async () => {
    const suffix = randomUUID();
    async function member(name: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT' | 'SUB_BROKER_ADMIN', organizationId?: string) {
      const firm = organizationId ?? (await db.organization.create({ data: { name, slug: name + suffix } })).id;
      const user = await db.user.create({ data: {
        name, role, organizationId: firm, email: name + suffix + '@e2e.test',
        delegatedPermissions: role === 'SUB_BROKER_ADMIN' ? ['inbox:view', 'inbox:send'] : [],
      }, include: { organization: true } });
      return { firm, user, headers: { Authorization: 'Bearer ' + (await app.get(AuthService).issue(user)).accessToken } };
    }
    const own = await member('broadcast-admin', 'BROKER_ADMIN');
    const outsider = await member('broadcast-outsider', 'BROKER_ADMIN');
    const agent = await member('broadcast-agent', 'BROKER_AGENT', own.firm);
    const delegate = await member('broadcast-delegate', 'SUB_BROKER_ADMIN', own.firm);
    for (const member of [agent, delegate]) await http().get(base).set(member.headers).expect(403);
    const existing = await http().post(base + '/contacts').set(own.headers).send({ contacts: [
      { name: 'Consented', phone: '9811111101', consentEvidence: 'WhatsApp business offers form' },
      { name: 'Without consent', phone: '9811111102' },
    ] }).expect(201);
    const [consented, noConsent] = existing.body.contacts;
    const group = async (name: string, contactIds: string[]) =>
      (await http().post(base + '/groups').set(own.headers).send({ name, contactIds }).expect(201)).body.id as string;
    const groupIds = [await group('Owners', [consented.id, noConsent.id]), await group('Rentals', [consented.id])];
    await http().post(base + '/groups').set(outsider.headers).send({ name: 'Invalid', contactIds: [consented.id] }).expect(400);
    const draft = { name: 'Open conversations', groupIds, message: { type: 'text', text: 'Thank you for contacting our firm.' } };
    await http().post(base + '/preview').set(outsider.headers).send(draft).expect(424);
    await http().post(base + '/preview').set(own.headers).send(draft).expect(424);
    await app.get(SettingsService).save('whatsapp', { enabled: true,
      fields: { phoneNumberId: '1111', businessAccountId: '2222', accessToken: 'isolated-test-only' } }, { orgId: own.firm, userId: own.user.id });
    await db.conversation.create({ data: { organizationId: own.firm, channel: 'WHATSAPP', contactKey: consented.phone,
      contactPhone: '+' + consented.phone, lastInboundAt: new Date() } });
    const capacity = jest.spyOn(app.get(WhatsAppService), 'broadcastFreeCapacity').mockResolvedValue(900);
    const send = jest.spyOn(app.get(WhatsAppService), 'send').mockRejectedValue(new Error('Provider would have been invoked'));
    try {
      const quote = (await http().post(base + '/preview').set(own.headers).send(draft).expect(201)).body;
      expect(quote).toMatchObject({ selected: 2, eligible: 1, canQueue: 1, estimatedCost: 0, balance: null });
      expect(await db.job.count({ where: { type: 'whatsapp.broadcast-recipient', payload: { path: ['orgId'], equals: own.firm } } })).toBe(0);
      await http().post(base + '/' + quote.id + '/queue').set(outsider.headers).expect(409);
      const requests = await Promise.all([1, 2].map(() => http().post(base + '/' + quote.id + '/queue').set(own.headers).send({})));
      expect(requests.map(({ status }) => status).sort()).toEqual([201, 409]);
      const recipient = await db.whatsAppBroadcastRecipient.findFirstOrThrow({ where: { broadcastId: quote.id } });
      await db.whatsAppBroadcastContact.update({ where: { id: consented.id }, data: { optedOutAt: new Date() } });
      await app.get(WhatsAppBroadcastService)['deliver'](recipient.id);
      expect(send).not.toHaveBeenCalled();
      expect(await db.whatsAppBroadcastRecipient.findUnique({ where: { id: recipient.id } })).toMatchObject({ status: 'SKIPPED' });
      const state = (await http().get(base).set(own.headers).expect(200)).body;
      expect(state.broadcasts).toEqual([expect.objectContaining({ id: quote.id, counts: { SKIPPED: 1 } })]);
      expect(state.contacts).toHaveLength(2);
      expect((await http().get(base).set(outsider.headers).expect(200)).body.contacts).toEqual([]);
    } finally {
      capacity.mockRestore();
      send.mockRestore();
    }
  });
});
