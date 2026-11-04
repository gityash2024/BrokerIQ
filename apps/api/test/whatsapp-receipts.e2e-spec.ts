import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';

/** Actual isolated PostgreSQL locks and durable events; no provider messages are sent. */
describe('WhatsApp receipt ownership and ordering', () => {
  let app: INestApplication, db: PrismaService, wa: WhatsAppService;
  let orgA: string, orgB: string, convA: string, convB: string;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const receipt = (id: string, status: string, org: string | null) => (wa as any).onStatus({ id, status, recipient_id: '919700000901' }, org);
  const message = (conversationId: string, suffix: string, extra = {}) =>
    db.message.create({
      data: { conversationId, direction: 'OUTBOUND', type: 'TEXT', body: 'Isolated test', status: 'SENT', externalId: `receipt-${uid}-${suffix}`, ...extra },
    });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(PrismaService);
    wa = app.get(WhatsAppService);
    orgA = (await db.organization.create({ data: { name: 'Receipt scope A', slug: 'receipt-a-' + uid } })).id;
    orgB = (await db.organization.create({ data: { name: 'Receipt scope B', slug: 'receipt-b-' + uid } })).id;
    for (const org of [orgA, orgB]) {
      const c = await db.conversation.create({ data: { organizationId: org, channel: 'WHATSAPP', contactKey: '919700000901', contactPhone: '+919700000901' } });
      if (org === orgA) convA = c.id;
      else convB = c.id;
    }
  });
  afterAll(async () => {
    await app?.close();
  });

  it('never routes an unknown receipt by contact or first firm and retains it for retry', async () => {
    const before = await db.message.count();
    const conversations = await db.conversation.count();
    await expect(receipt('unknown-' + uid, 'delivered', null)).rejects.toThrow('retained for retry');
    await expect(receipt('unknown-org-' + uid, 'delivered', orgA)).rejects.toThrow('retained for retry');
    expect(await db.message.count()).toBe(before);
    expect(await db.conversation.count()).toBe(conversations);
  });
  it('denies another firm and platform callbacks for organization-owned sends', async () => {
    const m = await message(convA, 'owned', { meta: { scope: 'organization' } });
    await receipt(m.externalId!, 'read', orgB);
    await receipt(m.externalId!, 'read', null);
    expect((await db.message.findUniqueOrThrow({ where: { id: m.id } })).status).toBe('SENT');
    await receipt(m.externalId!, 'delivered', orgA);
    expect((await db.message.findUniqueOrThrow({ where: { id: m.id } })).status).toBe('DELIVERED');
    const platform = await message(convB, 'platform', { meta: { scope: 'platform' } });
    await receipt(platform.externalId!, 'read', null);
    expect((await db.message.findUniqueOrThrow({ where: { id: platform.id } })).status).toBe('READ');
  });
  it('serializes mixed concurrent callbacks and never regresses READ or delivered to failure', async () => {
    const m = await message(convA, 'race');
    await Promise.all(Array.from({ length: 20 }, (_, i) => receipt(m.externalId!, ['sent', 'read', 'failed', 'delivered'][i % 4], orgA)));
    expect((await db.message.findUniqueOrThrow({ where: { id: m.id } })).status).toBe('READ');
    const delivered = await message(convA, 'delivered', { status: 'DELIVERED' });
    await receipt(delivered.externalId!, 'failed', orgA);
    expect((await db.message.findUniqueOrThrow({ where: { id: delivered.id } })).status).toBe('DELIVERED');
    const inbound = await message(convA, 'inbound', { direction: 'INBOUND', status: 'DELIVERED' });
    await receipt(inbound.externalId!, 'read', orgA);
    expect((await db.message.findUniqueOrThrow({ where: { id: inbound.id } })).status).toBe('DELIVERED');
  });
  it('processes known receipts past an unmatched one, retains failure and succeeds on replay once the send is recorded', async () => {
    const known = await message(convA, 'known');
    const unknownId = `receipt-${uid}-later`;
    const event = await db.webhookEvent.create({
      data: {
        provider: 'whatsapp',
        organizationId: orgA,
        externalId: 'event-' + uid,
        payload: {
          entry: [
            {
              changes: [
                {
                  value: {
                    statuses: [
                      { id: unknownId, status: 'delivered' },
                      { id: known.externalId, status: 'read' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    });
    await expect((wa as any).processEvent(event.id)).rejects.toThrow('retained for retry');
    expect((await db.message.findUniqueOrThrow({ where: { id: known.id } })).status).toBe('READ');
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe('FAILED');
    const late = await message(convA, 'later');
    await (wa as any).processEvent(event.id);
    expect((await db.message.findUniqueOrThrow({ where: { id: late.id } })).status).toBe('DELIVERED');
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe('PROCESSED');
  });
  it('retains an oversized attachment as a message without downloading it twice on replay', async () => {
    const externalId = 'oversized-video-' + uid;
    const event = await db.webhookEvent.create({
      data: {
        provider: 'whatsapp',
        organizationId: orgA,
        externalId: externalId + '-event',
        payload: {
          entry: [
            { changes: [{ value: { messages: [{ id: externalId, from: '919700000902', type: 'video', video: { id: '123', caption: 'Visit video' } }] } }] },
          ],
        },
      },
    });
    const credentials = jest.spyOn(wa as any, 'requireCreds').mockResolvedValue({ values: { accessToken: 'isolated-provider-adapter' } });
    const fetchAdapter = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(Response.json({ url: 'https://cdn.fbcdn.net/video', mime_type: 'video/mp4' }))
      .mockResolvedValueOnce(new Response(new Uint8Array(12 * 1024 * 1024 + 1)));
    try {
      await (wa as any).processEvent(event.id);
      await (wa as any).processEvent(event.id);
      expect(fetchAdapter).toHaveBeenCalledTimes(2);
      expect(await db.message.findUniqueOrThrow({ where: { externalId } })).toMatchObject({
        direction: 'INBOUND',
        type: 'VIDEO',
        body: 'Visit video\nAttachment exceeds the 12 MiB download limit.',
        mediaUrl: null,
      });
      expect(await db.webhookEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ status: 'PROCESSED', error: null });
    } finally {
      fetchAdapter.mockRestore();
      credentials.mockRestore();
    }
  });
});
