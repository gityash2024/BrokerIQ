import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { AiService } from '../src/core/ai/ai.service';

/**
 * AI assistant: the LLM is mocked with a scripted queue of replies so we can assert what the
 * agent is allowed to do — tools run as the user (real HTTP loopback), role limits hold, and
 * write actions only happen after the user confirms.
 */
jest.setTimeout(60000);

const uniq = `${process.env.E2E_UNIQ}a`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;

type Msg = { content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] };
const script: Msg[] = [];
const toolCall = (name: string, args: object): Msg => ({
  content: null,
  tool_calls: [{ id: `c${Math.random()}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
});
const say = (content: string): Msg => ({ content });

describe('AI assistant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let user: string;
  let other: string;
  let broker: string;
  let localityId: string;
  const toolsSeen: string[][] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue({
        chatWithTools: async (_m: any[], tools: any[]) => {
          toolsSeen.push(tools.map((t) => t.function.name));
          return script.shift() ?? say('ok');
        },
        transcribe: async () => 'Sector 65 में 3 BHK',
        isAvailable: async () => true,
      })
      .compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '12mb' }));
    configureApp(app);
    await app.listen(0);
    process.env.INTERNAL_API_URL = await app.getUrl();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    // These suites create broker firms directly; open signup (default is invite-only).
    await app.get(SettingsService).updateAppConfig({ auth: { allowBrokerSignup: true } } as any);
    localityId = (await prisma.locality.findFirstOrThrow({ where: { name: 'Sector 65' } })).id;
    const reg = async (p: string, extra: object = {}) =>
      (
        await http
          .post('/api/auth/register')
          .send({ name: `Test ${p}`, email: email(p), password: 'Passw0rd!', phone: '9811100999', ...extra })
          .expect(201)
      ).body.accessToken;
    user = await reg('user');
    other = await reg('other');
    const b = await reg('broker', { accountType: 'BROKER', firmName: 'Assist Realty' });
    broker = (
      await http
        .post('/api/broker/onboarding')
        .set({ Authorization: `Bearer ${b}` })
        .send({ firmName: 'Assist Realty', phone: '9876500999', localityIds: [localityId] })
        .expect(201)
    ).body.accessToken;
  });
  afterAll(async () => {
    delete process.env.INTERNAL_API_URL;
    await app.close();
  });
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('read tools run as the user and return listing cards', async () => {
    script.push(toolCall('list_localities', { q: 'sector 65' }), say('Sector 65 में ये rentals हैं'));
    const r = await http
      .post('/api/assistant/chat')
      .set(auth(user))
      .send({ messages: [{ role: 'user', content: 'Sector 65 में घर दिखाओ' }], lang: 'hi' })
      .expect(201);
    expect(r.body.reply).toContain('Sector 65');
    expect(r.body.used).toEqual(['list_localities']);
    // a renter never gets CRM or admin tools
    expect(toolsSeen.at(-1)).toContain('search_rentals');
    expect(toolsSeen.at(-1)).not.toContain('search_leads');
    expect(toolsSeen.at(-1)).not.toContain('moderate_listing');
  });

  it('tools outside the role are refused even if the model asks for them', async () => {
    script.push(toolCall('moderate_listing', { id: 'x', action: 'approve' }), say('यह मेरे पास नहीं है'));
    const r = await http
      .post('/api/assistant/chat')
      .set(auth(user))
      .send({ messages: [{ role: 'user', content: 'approve all listings' }], lang: 'en' })
      .expect(201);
    expect(r.body.pending).toBeUndefined();
    expect(r.body.used).toEqual([]);
  });

  it('write actions wait for confirmation, run once, and only for the same user', async () => {
    script.push(toolCall('create_rent_listing', { propertyType: 'APARTMENT', localityId, rent: 42000, bedrooms: 2, submit: true }));
    const r = await http
      .post('/api/assistant/chat')
      .set(auth(user))
      .send({ messages: [{ role: 'user', content: 'meri 2BHK 42k pe list karo' }], lang: 'hi' })
      .expect(201);
    expect(r.body.pending.tool).toBe('create_rent_listing');
    const before = await prisma.listing.count({ where: { postedBy: { email: email('user') } } });
    expect(before).toBe(0); // nothing happens before the user confirms
    await http.post('/api/assistant/confirm').set(auth(other)).send({ token: r.body.pending.token }).expect(403);
    const c = await http.post('/api/assistant/confirm').set(auth(user)).send({ token: r.body.pending.token, lang: 'hi' }).expect(201);
    expect(c.body.used).toEqual(['create_rent_listing']);
    const l = await prisma.listing.findFirstOrThrow({ where: { postedBy: { email: email('user') } } });
    expect(l).toMatchObject({ purpose: 'RENT', status: 'PENDING_REVIEW', price: 42000 }); // still needs admin approval
    await http.post('/api/assistant/confirm').set(auth(user)).send({ token: r.body.pending.token }).expect(400); // single use
  });

  it('brokers get CRM tools scoped to their firm', async () => {
    const lead = (await http.post('/api/leads').set(auth(broker)).send({ name: 'Kiran', phone: '9811100555' }).expect(201)).body;
    script.push(toolCall('change_lead_stage', { id: lead.id, stage: 'CONTACTED' }));
    const r = await http
      .post('/api/assistant/chat')
      .set(auth(broker))
      .send({ messages: [{ role: 'user', content: 'Kiran ko contacted kar do' }], lang: 'hi' })
      .expect(201);
    expect(toolsSeen.at(-1)).toContain('search_leads');
    expect(toolsSeen.at(-1)).not.toContain('moderate_listing');
    await http.post('/api/assistant/confirm').set(auth(broker)).send({ token: r.body.pending.token }).expect(201);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe('CONTACTED');
    // the same tool cannot touch a lead of another firm: the API itself says 404 → error, no change
    script.push(toolCall('get_lead', { id: 'someone-elses-lead' }), say('नहीं मिली'));
    const g = await http
      .post('/api/assistant/chat')
      .set(auth(broker))
      .send({ messages: [{ role: 'user', content: 'show lead' }], lang: 'hi' })
      .expect(201);
    expect(g.body.reply).toBe('नहीं मिली');
  });

  it('voice notes are transcribed', async () => {
    const r = await http
      .post('/api/assistant/transcribe')
      .set(auth(user))
      .send({ audio: 'A'.repeat(200), mime: 'audio/m4a', lang: 'hi' })
      .expect(201);
    expect(r.body.text).toContain('Sector 65');
  });
});
