import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AiService } from '../src/core/ai/ai.service';
import { OcrService } from '../src/modules/imports/ocr.service';
import { ImportsService } from '../src/modules/imports/imports.service';

describe('Register scan context, source facts and rented-only approval', () => {
  let app: INestApplication;
  let db: PrismaService;
  let token: string;
  let orgId: string;
  let image: Buffer;
  let ocr: jest.SpyInstance;
  let vision: jest.SpyInstance;
  let available: jest.SpyInstance;
  const sessionId = randomUUID();
  const pages: string[] = [];
  const api = () => request(app.getHttpServer());
  const header = () => ({ Authorization: 'Bearer ' + token });
  const facts = {
    intent: 'OFFER',
    purpose: 'RENT',
    society: null,
    sector: null,
    houseNo: null,
    floor: null,
    bhk: null,
    roomKind: null,
    area: null,
    areaUnit: null,
    priceBasis: null,
    priceMin: null,
    priceMax: null,
    furnishing: null,
    contacts: [{ name: null, phone: '9876543210', role: 'UNKNOWN' }],
    warnings: [],
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    const org = await db.organization.create({ data: { name: 'Register verification', slug: 'register-' + Date.now() } });
    orgId = org.id;
    const actor = await db.user.create({
      data: { name: 'Scan reviewer', role: 'BROKER_ADMIN', organizationId: org.id, email: sessionId + '@e2e.test' },
      include: { organization: true },
    });
    token = (await app.get(AuthService).issue(actor)).accessToken;
    image = await sharp({ create: { width: 3, height: 3, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    ocr = jest.spyOn(app.get(OcrService), 'recognize');
    vision = jest.spyOn(app.get(AiService), 'vision');
    available = jest.spyOn(app.get(AiService), 'isAvailable').mockResolvedValue(true);
  });
  afterAll(async () => {
    ocr?.mockRestore();
    vision?.mockRestore();
    available?.mockRestore();
    await app?.close();
  });
  async function upload(pageNo: number) {
    const input = {
      clientKey: sessionId + '-' + pageNo,
      fileName: 'register.png',
      contentType: 'image/png',
      sourceType: 'IMAGE',
      totalBytes: image.length,
      target: 'INVENTORY',
      registerSessionId: sessionId,
      registerPageNo: pageNo,
      registerSector: 'Sector 46',
    };
    const upload = (await api().post('/api/imports/uploads').set(header()).send(input).expect(201)).body;
    await api()
      .post('/api/imports/uploads/' + upload.id + '/chunks/0')
      .set(header())
      .send({ data: image.toString('base64') })
      .expect(201);
    const batch = (
      await api()
        .post('/api/imports/uploads/' + upload.id + '/complete')
        .set(header())
        .send({})
        .expect(201)
    ).body;
    pages[pageNo] = batch.id;
    return { ...input, uploadId: upload.id, batchId: batch.id };
  }
  async function extract(pageNo: number, text: string, registerSector: string | null) {
    ocr.mockResolvedValueOnce({ text, confidence: 90 });
    vision.mockResolvedValueOnce(JSON.stringify({ registerSector, records: [{ ...facts }] }));
    await app.get(ImportsService).extract(pages[pageNo]);
    return (
      await api()
        .get('/api/imports/' + pages[pageNo])
        .set(header())
        .expect(200)
    ).body;
  }
  it('retains page identity on retries and waits for preceding pages when uploads finish out of order', async () => {
    await upload(2);
    expect(await db.job.findUnique({ where: { key: 'import:' + pages[2] } })).toBeNull();
    const first = await upload(1);
    expect(await db.job.findUnique({ where: { key: 'import:' + pages[1] } })).toMatchObject({ type: 'import.extract' });
    const { uploadId, batchId, ...input } = first;
    await api()
      .post('/api/imports/uploads')
      .set(header())
      .send({ ...input, registerSector: 'Sector 47' })
      .expect(409);
    const repeated = (
      await api()
        .post('/api/imports/uploads/' + uploadId + '/complete')
        .set(header())
        .send({})
        .expect(201)
    ).body;
    expect(repeated.id).toBe(batchId);
    expect(await db.importBatch.count({ where: { id: { in: pages.filter(Boolean) } } })).toBe(2);
  });
  it('uses the selected sector for a page without a heading and carries it to the next page', async () => {
    const first = await extract(1, '941 9876543210 SFD FF', null);
    expect(first.metadata.register).toMatchObject({ sector: 'Sector 46', pageNo: 1 });
    expect(first.entries[0].extracted[0].inventory).toMatchObject({ houseNo: '941', sector: 'Sector 46', floor: '1', furnishing: 'SEMI_FURNISHED' });
    expect(await db.job.findUnique({ where: { key: 'import:' + pages[2] } })).toMatchObject({ type: 'import.extract' });
    const next = await extract(2, '942 9876543210 FFD 3rd Floor', null);
    expect(next.entries[0].extracted[0].inventory).toMatchObject({ houseNo: '942', sector: 'Sector 46', floor: '3', furnishing: 'FULLY_FURNISHED' });
    expect(vision.mock.calls.at(-1)?.[1]).toContain('Confirmed preceding register-page sector: Sector 46');
  });
  it('switches at a new printed heading and saves a sparse rented row outside Available inventory', async () => {
    await upload(3);
    await upload(4);
    const changed = await extract(3, 'Sector 47\n943 9876543210 Rent out', 'Sector 47');
    expect(changed.metadata.register.sector).toBe('Sector 47');
    const entity = changed.entries[0].extracted[0];
    expect(entity.inventory).toMatchObject({ houseNo: '943', sector: 'Sector 47', availability: 'RENTED', monthlyRent: null, area: null });
    await api()
      .post('/api/imports/entries/' + changed.entries[0].id + '/approve')
      .set(header())
      .send({ entities: [entity], destination: 'INVENTORY', expectedUpdatedAt: changed.entries[0].updatedAt })
      .expect(201);
    const saved = await db.inventoryItem.findFirstOrThrow({ where: { organizationId: orgId, houseNo: '943' } });
    expect(saved).toMatchObject({ availability: 'RENTED', directoryMonth: null, monthlyRent: null, area: null });
    const current = (await api().get('/api/inventory?folderMode=AVAILABLE&currentInventory=true').set(header()).expect(200)).body;
    expect(current.items.some((row: any) => row.id === saved.id)).toBe(false);
    const rented = (await api().get('/api/inventory?folderMode=RENTED&folderSector=Sector%2047').set(header()).expect(200)).body;
    expect(rented.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: saved.id })]));
    const fourth = await extract(4, '944 9876543210 4th Floor FFD', null);
    expect(fourth.entries[0].extracted[0].inventory).toMatchObject({ sector: 'Sector 47', houseNo: '944', floor: '4', furnishing: 'FULLY_FURNISHED' });
  });
  it('keeps a new register independent of a previous register sector', async () => {
    const fresh = await db.importBatch.create({
      data: {
        organizationId: orgId,
        sourceType: 'IMAGE',
        sourceHash: randomUUID(),
        metadata: { register: { sessionId: randomUUID(), pageNo: 1 } },
      },
    });
    expect(fresh.metadata).not.toHaveProperty('register.sector');
  });
});
