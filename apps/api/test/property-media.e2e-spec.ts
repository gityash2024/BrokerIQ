import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import request from 'supertest';
import { inventoryDate, inventoryMonth } from '@brokeriq/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { env } from '../src/config/env';
import { AiService } from '../src/core/ai/ai.service';
import { LocalStorageService } from '../src/core/media/local-storage.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PropertyVideoService } from '../src/modules/media/property-video.service';
import { SurveyWhatsAppService } from '../src/modules/inventory/survey-whatsapp.service';

describe('Property identity, watermark and video extraction', () => {
  let app: INestApplication;
  let db: PrismaService;
  let firm: string;
  let staffId: string;
  let staff: string;
  let outside: string;
  let delegate: string;
  let owner: string;
  let work: string;
  const stamp = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const auth = (token = staff) => ({ Authorization: `Bearer ${token}` });
  const details = {
    purpose: 'RENT',
    houseNo: '17',
    sector: 'Sector 45',
    category: 'RESIDENTIAL',
    propertyType: 'BUILDER_FLOOR',
    furnishing: 'SEMI_FURNISHED',
    bhk: 2,
    roomKind: 'BHK',
    floor: '3',
    monthlyRent: 36000,
    area: 1000,
    areaUnit: 'SQ_FT',
    directoryMonth: inventoryMonth(),
  };

  beforeAll(async () => {
    work = await mkdtemp(join(tmpdir(), 'brokeriq-property-e2e-'));
    env().MEDIA_ROOT = join(work, 'media');
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    firm = (await db.organization.create({ data: { name: 'Property media verification', slug: 'media-' + stamp } })).id;
    const other = (await db.organization.create({ data: { name: 'Other property firm', slug: 'other-media-' + stamp } })).id;
    const users = await Promise.all(
      (
        [
          ['staff', firm, 'BROKER_ADMIN', []],
          ['outside', other, 'BROKER_ADMIN', []],
          ['delegate', firm, 'SUB_BROKER_ADMIN', ['inventory:view', 'inventory:edit']],
          ['owner', firm, 'PROPERTY_OWNER', []],
        ] as const
      ).map(([name, organizationId, role, permissions]) =>
        db.user.create({
          data: { email: name + '.' + stamp + '@e2e.test', name, organizationId, role, delegatedPermissions: [...permissions] },
          include: { organization: true },
        }),
      ),
    );
    [staff, outside, delegate, owner] = await Promise.all(users.map(async (user) => (await app.get(AuthService).issue(user)).accessToken));
    staffId = users[0].id;
  });
  afterAll(async () => {
    await app?.close();
    if (work) await rm(work, { recursive: true, force: true });
  });

  it('allocates unique codes across saves and preserves the code across edits and a linked listing', async () => {
    const copies = await Promise.all(
      ['17A', '17B', '17C', '17D'].map((houseNo) =>
        http()
          .post('/api/inventory')
          .set(auth())
          .send({ ...details, houseNo })
          .expect(201),
      ),
    );
    expect(new Set(copies.map(({ body }) => body.propertyCode)).size).toBe(4);
    const { id, propertyCode } = copies[0].body;
    expect(propertyCode).toMatch(/^BIQ-\d{6,}$/);
    const lookup = propertyCode.replace('-', '').toLowerCase();
    expect((await http().get('/api/inventory').set(auth()).query({ search: lookup }).expect(200)).body.items.map((row: { id: string }) => row.id)).toEqual([
      id,
    ]);
    expect((await http().get('/api/inventory').set(auth(outside)).query({ search: lookup }).expect(200)).body.items).toEqual([]);
    const locality = await db.locality.findFirstOrThrow({ where: { isActive: true } });
    const listing = await db.listing.create({
      data: {
        postedById: staffId,
        postedByType: 'BROKER',
        organizationId: firm,
        title: 'Property media check',
        slug: 'media-' + stamp,
        purpose: 'RENT',
        category: 'RESIDENTIAL',
        propertyType: 'BUILDER_FLOOR',
        localityId: locality.id,
        price: 36000,
      },
    });
    expect(listing.propertyCode).not.toBe(propertyCode);
    await db.inventoryItem.update({ where: { id }, data: { publishedListingId: listing.id } });
    expect((await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).propertyCode).toBe(propertyCode);
    expect(
      (
        await http()
          .patch('/api/inventory/' + id)
          .set(auth())
          .send({ floor: '4' })
          .expect(200)
      ).body.propertyCode,
    ).toBe(propertyCode);
  });

  it('renders legacy source images in place and saves an edited property without replacing the original', async () => {
    const original = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#3158a8' } })
      .jpeg()
      .toBuffer();
    const source = await app.get(LocalStorageService).putDataUrl('data:image/jpeg;base64,' + original.toString('base64'), 'listing', firm);
    const property = await db.inventoryItem.create({ data: { organizationId: firm, photoUrls: [source] } });
    const { body } = await http()
      .get('/api/inventory/' + property.id)
      .set(auth())
      .expect(200);
    const path = new URL(body.photoUrls[0]).pathname;
    expect(path).toContain('/property-photo/');
    const photo = await http().get(path).expect(200);
    const second = await http().get(path).expect(200);
    const jpg = await http()
      .get(path + '?format=jpeg')
      .expect(200);
    expect(jpg.headers['content-type']).toMatch(/image\/jpeg/);
    expect(second.body.equals(photo.body)).toBe(true);
    const decoded = await sharp(photo.body).metadata();
    expect([decoded.width, decoded.height]).toEqual([900, 600]);
    const top = await sharp(await sharp(photo.body).extract({ left: 30, top: 30, width: 400, height: 25 }).toBuffer()).stats();
    const bottom = await sharp(await sharp(photo.body).extract({ left: 30, top: 575, width: 400, height: 25 }).toBuffer()).stats();
    expect(bottom.channels[2].mean).toBeLessThan(top.channels[2].mean - 40);
    await http()
      .patch('/api/inventory/' + property.id)
      .set(auth())
      .send({ photoUrls: body.photoUrls })
      .expect(200);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: property.id } })).photoUrls).toEqual([source]);
    await http()
      .get(path.slice(0, -3) + 'AAA')
      .expect(404);
  });

  it('reviews eight distinct walkthrough scenes and saves only approved frames to the same property', async () => {
    const file = join(work, 'video.mp4');
    for (let scene = 0; scene < 8; scene++) {
      const hash = createHash('sha256').update(`scene-${scene}`).digest();
      const pixels = Buffer.from(Array.from({ length: 80 }, (_, cell) => (hash[cell % hash.length] & 1 ? 224 : 36)));
      await sharp(pixels, { raw: { width: 10, height: 8, channels: 1 } })
        .resize(320, 240, { fit: 'fill', kernel: 'nearest' })
        .jpeg()
        .toFile(join(work, `scene-${String(scene + 1).padStart(2, '0')}.jpg`));
    }
    await promisify(execFile)(env().PROPERTY_VIDEO_FFMPEG ?? 'ffmpeg', [
      '-v',
      'error',
      '-framerate',
      '1',
      '-i',
      join(work, 'scene-%02d.jpg'),
      '-an',
      '-pix_fmt',
      'yuv420p',
      '-c:v',
      'mpeg4',
      file,
    ]);
    const ai = jest.spyOn(app.get(AiService), 'vision').mockRejectedValue(new Error('Free quota unavailable'));
    const previous = env().JOBS_ENABLED;
    try {
      env().JOBS_ENABLED = true;
      const { body: upload } = await http().post('/api/media/property-video').set(auth()).send({ contentType: 'video/mp4' }).expect(201);
      env().JOBS_ENABLED = false;
      await http()
        .get('/api/media/property-video/' + upload.id)
        .set(auth(outside))
        .expect(404);
      await http()
        .put(new URL(upload.uploadUrl).pathname)
        .set('Content-Type', 'video/mp4')
        .send(await readFile(file))
        .expect(200);
      const row = await db.propertyVideoExtraction.findUniqueOrThrow({ where: { id: upload.id } });
      await http()
        .get('/api/media/f/' + row.sourceKey)
        .expect(404);
      await http()
        .post('/api/media/property-video/' + upload.id + '/start')
        .set(auth())
        .expect(201);
      await (app.get(PropertyVideoService) as any).extract(upload.id);
      const { body: result } = await http()
        .get('/api/media/property-video/' + upload.id)
        .set(auth())
        .expect(200);
      expect(result).toMatchObject({ aiVerified: false, state: 'READY' });
      expect(result.frames).toHaveLength(8);
      expect(ai).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('distinct room'), expect.objectContaining({ feature: 'property_video', strictSchema: true }));
      const save = () =>
        http()
          .post('/api/media/property-video/' + upload.id + '/save')
          .set(auth())
          .send({ indices: [0, 5, 7] })
          .expect(201);
      const first = await save();
      expect((await save()).body).toEqual(first.body);
      expect(first.body.urls).toHaveLength(3);
      const normalPhoto = 'https://example.test/existing-property-photo.jpg';
      const property = await db.inventoryItem.create({ data: { organizationId: firm, sourceType: 'MANUAL', purpose: 'RENT', photoUrls: [normalPhoto] } });
      const attach = (token = staff) => http().patch(`/api/inventory/${property.id}/photos`).set(auth(token)).send(first.body);
      await attach(outside).expect(404);
      await Promise.all([attach().expect(200), attach(delegate).expect(200)]);
      const saved = await db.inventoryItem.findUniqueOrThrow({ where: { id: property.id } });
      expect(saved.photoUrls).toEqual([normalPhoto, ...first.body.urls]);
      expect(saved.revision).toBe(property.revision + 1);
      expect((await app.get(LocalStorageService).read(row.sourceKey)).contentType).toBe('video/mp4');
      await http()
        .post('/api/media/property-video/' + upload.id + '/complete')
        .set(auth())
        .expect(201);
      await expect(app.get(LocalStorageService).read(row.sourceKey)).rejects.toThrow();
      await http().get(new URL(first.body.urls[0]).pathname).expect(200);
    } finally {
      env().JOBS_ENABLED = previous;
      ai.mockRestore();
    }
  });

  it('applies unambiguous Survey facts once and gives the Broker Admin scoped notes for ambiguity', async () => {
    const phone = '+919900001234';
    const property = await db.inventoryItem.create({
      data: { organizationId: firm, sourceType: 'SURVEY', status: 'DRAFT', ownerPhone: phone, purpose: 'RENT' },
    });
    const conv = await db.conversation.create({ data: { organizationId: firm, channel: 'WHATSAPP', contactKey: phone, contactPhone: phone } });
    const ingest = async (body: string) => {
      const msg = await db.message.create({ data: { conversationId: conv.id, direction: 'INBOUND', body, status: 'RECEIVED' } });
      await app.get(SurveyWhatsAppService).ingest({ organizationId: firm, messageId: msg.id });
      return msg.id;
    };
    const messageId = await ingest('2 BHK, SFD, SF, rent 30k');
    const confirmed = await db.inventoryItem.findUniqueOrThrow({ where: { id: property.id } });
    expect(confirmed).toMatchObject({ bhk: 2, furnishing: 'SEMI_FURNISHED', floor: 'SF', rent: 30000, status: 'DRAFT' });
    await app.get(SurveyWhatsAppService).ingest({ organizationId: firm, messageId });
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: property.id } })).revision).toBe(confirmed.revision);
    const review = await ingest('3 BHK or 4 BHK. Rent 40k.');
    expect((await http().get('/api/inventory/survey-notes').set(auth()).expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: review, state: 'REVIEW' })]),
    );
    expect((await http().get('/api/inventory/survey-notes').set(auth(outside)).expect(200)).body).toEqual([]);
    await http().get('/api/inventory/survey-notes').set(auth(delegate)).expect(403);
  });

  it('keeps firm workflow settings restricted and requires confirmation before allowing provider charges', async () => {
    await http().patch('/api/messaging/workflow').set(auth()).send({ freeOnly: true, ownerAuto: true }).expect(200);
    await http().patch('/api/messaging/workflow').set(auth(delegate)).send({ freeOnly: false, confirmCharges: true }).expect(403);
    await http().patch('/api/messaging/workflow').set(auth()).send({ freeOnly: false }).expect(400);
    expect((await http().get('/api/messaging/workflow').set(auth()).expect(200)).body).toEqual({ freeOnly: true, ownerAuto: true });
    expect((await http().get('/api/messaging/workflow').set(auth(outside)).expect(200)).body).toEqual({ freeOnly: false, ownerAuto: false });
    await http().patch('/api/messaging/workflow').set(auth()).send({ freeOnly: false, confirmCharges: true }).expect(200);
  });
});
