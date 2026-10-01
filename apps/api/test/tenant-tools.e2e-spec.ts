import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeaturesService } from '../src/core/features/features.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { MailService } from '../src/core/mail/mail.service';
import { RentService } from '../src/modules/rentals/rent.service';

/** Tenant & owner tools: rent reminders/receipts, move-in/out checklist, agreement OTP-sign, fair rent, video visits, compare & shortlist. */
jest.setTimeout(90000);

const uniq = `${process.env.E2E_UNIQ!}r`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const binary = (res: any, cb: (e: Error | null, b: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

describe('Tenant & owner tools (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let broker: { token: string; orgId: string };
  let tenant: { token: string; id: string; email: string };
  let localityId: string;
  const mails: { to: string; subject: string; html: string }[] = [];
  const lastOtp = () => /(\d{6})/.exec(mails[mails.length - 1].subject)![1];

  const newListing = async (extra: object = {}) => {
    const l = await http
      .post('/api/listings')
      .set(auth(broker.token))
      .send({
        purpose: 'RENT',
        propertyType: 'APARTMENT',
        localityId,
        price: 40000,
        securityDeposit: 80000,
        bedrooms: 2,
        bathrooms: 2,
        superArea: 1200,
        furnishing: 'SEMI_FURNISHED',
        brokerageType: 'MONTH_1',
        photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }],
        ...extra,
      })
      .expect(201);
    await http.post(`/api/admin/moderation/listings/${l.body.id}`).set(auth(admin)).send({ action: 'approve' }).expect(201);
    return l.body as { id: string; slug: string };
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json());
    app.use(urlencoded({ extended: true }));
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    jest.spyOn(app.get(MailService), 'send').mockImplementation(async (m: any) => void mails.push(m));
    admin = (
      await http
        .post('/api/auth/login')
        .send({ email: `admin.${process.env.E2E_UNIQ}@e2e.test`, password: 'Admin@12345' })
        .expect(200)
    ).body.accessToken;
    await app.get(SettingsService).updateAppConfig({ auth: { allowBrokerSignup: true } } as any);
    await prisma.featureFlag.deleteMany({
      where: { key: { in: ['rent_tracker', 'inspections', 'fair_rent', 'video_visits', 'agreement_esign', 'compare_shortlist'] } },
    });
    app.get(FeaturesService).invalidate();
    const b = await http
      .post('/api/auth/register')
      .send({ name: 'Rent Broker', email: email('broker'), password: 'Passw0rd!', accountType: 'BROKER', firmName: `Rent Realty ${uniq}` })
      .expect(201);
    broker = { token: b.body.accessToken, orgId: b.body.user.organizationId };
    const t = await http
      .post('/api/auth/register')
      .send({ name: 'Tara Tenant', email: email('tenant'), password: 'Passw0rd!' })
      .expect(201);
    tenant = { token: t.body.accessToken, id: t.body.user.id, email: email('tenant') };
    localityId = (await prisma.locality.findFirstOrThrow({ where: { name: 'Sector 65' } })).id;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  let tenancyId: string;
  let ownerId: string;

  it('rent: due-date reminder, paid mark, receipt PDF, tenant sees “मेरा किराया”', async () => {
    const owner = await http.post('/api/broker/owners').set(auth(broker.token)).send({ name: 'Omkar Owner', phone: '9811200001' }).expect(201);
    ownerId = owner.body.id;
    await http.patch(`/api/broker/owners/${ownerId}/payment`).set(auth(broker.token)).send({ pan: 'BAD' }).expect(400);
    await http
      .patch(`/api/broker/owners/${ownerId}/payment`)
      .set(auth(broker.token))
      .send({ upiId: 'omkar@okhdfcbank', pan: 'abcde1234f', email: email('owner') })
      .expect(200);
    const start = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const lease = await http
      .post('/api/broker/tenancies')
      .set(auth(broker.token))
      .send({ ownerId, tenantName: 'Tara Tenant', rent: 32000, startDate: start })
      .expect(201);
    tenancyId = lease.body.id;
    const set = await http
      .patch(`/api/broker/tenancies/${tenancyId}/rent`)
      .set(auth(broker.token))
      .send({ rentDueDay: 10, tenantEmail: tenant.email.toUpperCase() })
      .expect(200);
    expect(set.body).toMatchObject({ rentDueDay: 10, tenantUserId: tenant.id, tenantEmail: tenant.email });

    // 3 days before the due date → one reminder (push + email with UPI link); running again doesn't repeat.
    const rent = app.get(RentService);
    const d = new Date(Date.now() + 5.5 * 3600_000);
    const pre = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 7, 6, 0));
    const before = mails.length;
    expect(await rent.sendReminders(pre)).toBeGreaterThanOrEqual(1);
    expect(mails.slice(before).some((m) => m.to === tenant.email && m.html.includes('upi://pay?pa=omkar%40okhdfcbank'))).toBe(true);
    await rent.sendReminders(pre);
    expect(mails.slice(before).filter((m) => m.to === tenant.email)).toHaveLength(1);
    const note = await prisma.notification.findFirst({ where: { userId: tenant.id, kind: 'RENT_DUE' } });
    expect(note?.body).toContain('32,000');

    const month = istToday().slice(0, 7);
    const paid = await http
      .post(`/api/broker/tenancies/${tenancyId}/rent-payments`)
      .set(auth(broker.token))
      .send({ month, amount: 32000, mode: 'UPI', reference: 'UTR9' })
      .expect(201);
    expect(paid.body.receiptNo).toMatch(/^RR-/);
    await http.post(`/api/broker/tenancies/${tenancyId}/rent-payments`).set(auth(broker.token)).send({ month, amount: 32000 }).expect(400);
    const pdf = await http
      .get(paid.body.receiptUrl.slice(paid.body.receiptUrl.indexOf('/api/')))
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const mine = await http.get('/api/me/rent').set(auth(tenant.token)).expect(200);
    expect(mine.body[0]).toMatchObject({ rent: 32000, paidThisMonth: true, upiId: 'omkar@okhdfcbank', upiLink: null });
    expect(mine.body[0].payments[0].month).toBe(month);
    // Other firms can't touch this lease.
    const o = await http
      .post('/api/auth/register')
      .send({ name: 'Other Rent', email: email('other'), password: 'Passw0rd!', accountType: 'BROKER', firmName: `Other Rent ${uniq}` })
      .expect(201);
    await http.get(`/api/broker/tenancies/${tenancyId}/rent`).set(auth(o.body.accessToken)).expect(404);
  });

  it('move-in / move-out checklist with OTP confirmation and deposit settlement', async () => {
    const rooms = [
      {
        name: 'Living room',
        items: [
          { name: 'AC', condition: 'GOOD' },
          { name: 'Sofa', condition: 'OK', note: 'minor stain' },
        ],
      },
    ];
    const mi = await http
      .put(`/api/broker/tenancies/${tenancyId}/inspections`)
      .set(auth(broker.token))
      .send({ kind: 'MOVE_IN', rooms, meters: { electricity: '1200' }, keys: 3 })
      .expect(200);
    const token = mi.body.url.split('/i/')[1];
    const view = await http.get(`/api/public/inspections/${token}`).expect(200);
    expect(view.body.tenant.reachableAt).toContain('@e2e.test');

    const sent = await http.post(`/api/public/inspections/${token}/otp`).send({ party: 'TENANT' }).expect(201);
    expect(sent.body.sentTo).toContain('*');
    const otp = lastOtp();
    await http
      .post(`/api/public/inspections/${token}/confirm`)
      .send({ party: 'TENANT', otp: otp === '000000' ? '111111' : '000000' })
      .expect(400);
    const ok = await http.post(`/api/public/inspections/${token}/confirm`).send({ party: 'TENANT', otp }).expect(201);
    expect(ok.body.tenantConfirmedAt).toBeTruthy();
    await http.post(`/api/public/inspections/${token}/otp`).send({ party: 'LANDLORD' }).expect(201);
    await http.post(`/api/public/inspections/${token}/confirm`).send({ party: 'LANDLORD', otp: lastOtp() }).expect(201);

    // Any edit needs fresh confirmations.
    await http.put(`/api/broker/tenancies/${tenancyId}/inspections`).set(auth(broker.token)).send({ kind: 'MOVE_IN', rooms, keys: 2 }).expect(200);
    const again = await http.get(`/api/public/inspections/${token}`).expect(200);
    expect(again.body.tenantConfirmedAt).toBeNull();

    const mo = await http
      .put(`/api/broker/tenancies/${tenancyId}/inspections`)
      .set(auth(broker.token))
      .send({
        kind: 'MOVE_OUT',
        rooms: [
          {
            name: 'Living room',
            items: [
              { name: 'AC', condition: 'DAMAGED', note: 'remote missing' },
              { name: 'Sofa', condition: 'OK' },
            ],
          },
        ],
        depositAmount: 64000,
        deductions: [{ reason: 'AC remote', amount: 1500 }],
        // Internal / plain-http photo URLs are never fetched by the PDF renderer.
        photos: ['http://127.0.0.1:9/secret.jpg', 'https://169.254.169.254/latest/meta-data.jpg'],
      })
      .expect(200);
    expect(mo.body.refundAmount).toBe(62500);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const moView = await http.get(`/api/public/inspections/${mo.body.url.split('/i/')[1]}`).expect(200);
    expect(moView.body.moveIn.rooms[0].items[0].condition).toBe('GOOD');
    const pdf = await http
      .get(mo.body.pdfUrl.slice(mo.body.pdfUrl.indexOf('/api/')))
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('rent agreement OTP-sign by both parties with a certificate', async () => {
    const a = await http
      .post('/api/agreements')
      .set(auth(broker.token))
      .send({
        landlordName: 'Omkar Owner',
        tenantName: 'Tara Tenant',
        propertyAddress: 'Flat 12, Sector 65, Gurugram',
        rent: 32000,
        deposit: 64000,
        startDate: istToday(),
      })
      .expect(201);
    await http.post(`/api/agreements/${a.body.id}/sign`).set(auth(broker.token)).send({ landlordEmail: 'x', tenantEmail: tenant.email }).expect(400);
    const before = mails.length;
    const st = await http
      .post(`/api/agreements/${a.body.id}/sign`)
      .set(auth(broker.token))
      .send({ landlordEmail: email('owner'), tenantEmail: tenant.email })
      .expect(201);
    expect(st.body.signStatus).toBe('SIGNING');
    expect(st.body.documentHash).toMatch(/^[a-f0-9]{64}$/);
    const links = mails.slice(before).map((m) => /\/sign\/([\w-]+)/.exec(m.html)![1]);
    expect(links).toHaveLength(2);
    // Someone else's agreement can't be sent for signing.
    await http
      .post(`/api/agreements/${a.body.id}/sign`)
      .set(auth(tenant.token))
      .send({ landlordEmail: email('owner'), tenantEmail: tenant.email })
      .expect(404);

    for (const token of links) {
      const v = await http.get(`/api/public/sign/${token}`).expect(200);
      expect(v.body.agreement.rent).toBe(32000);
      await http.post(`/api/public/sign/${token}/otp`).expect(201);
      await http.post(`/api/public/sign/${token}/confirm`).send({ otp: lastOtp() }).expect(201);
    }
    const done = await prisma.rentAgreement.findUniqueOrThrow({ where: { id: a.body.id }, include: { signatures: true } });
    expect(done.signStatus).toBe('SIGNED');
    expect(done.signatures.every((s) => s.signedAt && s.ip)).toBe(true);
    const pdf = await http.get(`/api/public/sign/${links[0]}/pdf`).buffer(true).parse(binary).expect(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('agreement OTP-sign without an email goes on the firm own WhatsApp and keeps the OTP out of the inbox', async () => {
    const sent: { to: string; text: string; opts: any }[] = [];
    const spy = jest
      .spyOn(app.get(WhatsAppService), 'send')
      .mockImplementation(async (_org: any, to: string, msg: any, opts: any) => void sent.push({ to, text: msg.text, opts }) as any);
    const a = await http
      .post('/api/agreements')
      .set(auth(broker.token))
      .send({
        landlordName: 'Omkar Owner',
        landlordPhone: '9811100001',
        tenantName: 'Tara Tenant',
        propertyAddress: 'Flat 14, Sector 65, Gurugram',
        rent: 30000,
        deposit: 60000,
        startDate: istToday(),
      })
      .expect(201);
    // Tenant has neither email nor phone: refused up front, nothing sent.
    await http.post(`/api/agreements/${a.body.id}/sign`).set(auth(broker.token)).send({ landlordEmail: '' }).expect(400);
    expect(sent).toHaveLength(0);
    const before = mails.length;
    const st = await http.post(`/api/agreements/${a.body.id}/sign`).set(auth(broker.token)).send({ tenantEmail: tenant.email }).expect(201);
    expect(st.body.signatures.find((x: any) => x.party === 'LANDLORD').via).toBe('WHATSAPP');
    expect(mails.length - before).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].opts.ownNumberOnly).toBe(true);
    const token = /\/sign\/([\w-]+)/.exec(sent[0].text)![1];
    const r = await http.post(`/api/public/sign/${token}/otp`).expect(201);
    expect(r.body.sentTo).toMatch(/0001$/);
    const otp = /(\d{6})/.exec(sent[1].text)![1];
    expect(sent[1].opts.storedBody).not.toContain(otp);
    await http.post(`/api/public/sign/${token}/confirm`).send({ otp }).expect(201);
    spy.mockRestore();
  });

  it('fair rent: median and range from real listings; says so when data is thin', async () => {
    // 7 BHK keeps this test's listings apart from everything else; earlier runs' copies are removed so reruns stay exact.
    await prisma.listing.deleteMany({ where: { localityId, bedrooms: { in: [7, 9] } } });
    for (const price of [30000, 40000, 50000]) await newListing({ bedrooms: 7, price, securityDeposit: price * 2 });
    const r = await http.get(`/api/public/fair-rent?localityId=${localityId}&bedrooms=7&price=60000`).expect(200);
    expect(r.body).toMatchObject({ enough: true, samples: 3, median: 40000, p25: 35000, p75: 45000, verdict: 'HIGH', scope: 'LOCALITY' });
    const thin = await http.get(`/api/public/fair-rent?localityId=${localityId}&bedrooms=9`).expect(200);
    expect(thin.body.enough).toBe(false);
    await http.get('/api/public/fair-rent?localityId=&bedrooms=2').expect(404);
  });

  it('video visits get a Jitsi room; the switch turns them off', async () => {
    const lead = await http.post('/api/leads').set(auth(broker.token)).send({ name: 'Video Lead', phone: '9811200077', source: 'MANUAL' }).expect(201);
    const v = await http
      .post('/api/visits')
      .set(auth(broker.token))
      .send({ leadId: lead.body.id, scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), mode: 'VIDEO' })
      .expect(201);
    expect(v.body.mode).toBe('VIDEO');
    expect(v.body.meetingUrl).toMatch(/^https:\/\/meet\.jit\.si\/BrokerIQ-[A-Za-z0-9]+$/);
    await prisma.featureFlag.upsert({ where: { key: 'video_visits' }, create: { key: 'video_visits', enabled: false }, update: { enabled: false } });
    app.get(FeaturesService).invalidate();
    await http
      .post('/api/visits')
      .set(auth(broker.token))
      .send({ leadId: lead.body.id, scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), mode: 'VIDEO' })
      .expect(403);
    await prisma.featureFlag.update({ where: { key: 'video_visits' }, data: { enabled: true } });
    app.get(FeaturesService).invalidate();
  });

  it('compare 2–4 homes and share the saved shortlist (revocable)', async () => {
    const [l1, l2] = [await newListing({ price: 41000 }), await newListing({ price: 43000 })];
    const cmp = await http.get(`/api/public/compare?ids=${l1.id},${l2.id}`).expect(200);
    expect(cmp.body.map((x: any) => x.price)).toEqual([41000, 43000]);
    expect(cmp.body[0]).toHaveProperty('amenities');
    await http.get(`/api/public/compare?ids=${l1.id}`).expect(400);

    await http.post(`/api/listings/${l1.id}/save`).set(auth(tenant.token)).expect(201);
    const share = await http.post('/api/me/shortlist/share').set(auth(tenant.token)).expect(201);
    const token = share.body.url.split('/shortlist/')[1];
    const again = await http.post('/api/me/shortlist/share').set(auth(tenant.token)).expect(201);
    expect(again.body.token).toBe(token);
    const view = await http.get(`/api/public/shortlist/${token}`).expect(200);
    expect(view.body.by).toBe('Tara');
    expect(view.body.listings.map((x: any) => x.id)).toContain(l1.id);
    expect(JSON.stringify(view.body)).not.toContain(tenant.email);
    await http.delete('/api/me/shortlist/share').set(auth(tenant.token)).expect(200);
    await http.get(`/api/public/shortlist/${token}`).expect(404);
  });
});
