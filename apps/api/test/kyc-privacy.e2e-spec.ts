process.env.MEDIA_ROOT ||= require('node:path').join(require('node:os').tmpdir(), 'brokeriq-tests', 'kyc-' + Date.now());
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { LocalStorageService } from '../src/core/media/local-storage.service';

type Actor = { id: string; token: string; organizationId: string | null };
describe('KYC private transport, ownership and immutable review (real encrypted files/PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService;
  let org: string, otherOrg: string, agent: Actor, peer: Actor, admin: Actor, peerAdmin: Actor, outsider: Actor, superAdmin: Actor;
  let submission: any, docs: any[], firstUpload: any;
  const auth = (actor: Actor) => ({ Authorization: 'Bearer ' + actor.token });
  const actor = async (role: Role, organizationId: string | null) => {
    const user = await db.user.create({
      data: { role, organizationId, name: 'Isolated privacy fixture', email: `private.kyc.${Date.now()}.${Math.random()}@e2e.test` },
      include: { organization: true },
    });
    return { id: user.id, organizationId, token: (await app.get(AuthService).issue(user)).accessToken };
  };
  const upload = async (owner: Actor, color: number) => {
    const bytes = await sharp({ create: { width: 48, height: 48, channels: 3, background: { r: color, g: 80, b: 140 } } })
      .png()
      .toBuffer();
    const sign = await request(app.getHttpServer()).post('/api/me/uploads/sign').set(auth(owner)).send({ kind: 'kyc', contentType: 'image/png' }).expect(201);
    expect(sign.body.provider).toBe('local');
    expect(sign.body.key.split('/')[1]).toBe(owner.id);
    const path = new URL(sign.body.uploadUrl).pathname;
    await request(app.getHttpServer()).put(path).set('Content-Type', 'image/png').send(bytes).expect(200);
    return { ...sign.body, bytes, path };
  };
  const body = async (owner: Actor, start: number) => {
    const files = [];
    for (let i = 0; i < 5; i++) files.push(await upload(owner, start + i * 20));
    return {
      files,
      body: {
        aadhaarNumber: '111122223333',
        panNumber: 'ABCDE1234F',
        aadhaarPhotoUrl: files[0].publicUrl,
        panPhotoUrl: files[1].publicUrl,
        livelinessStraightUrl: files[2].publicUrl,
        livelinessLeftUrl: files[3].publicUrl,
        livelinessRightUrl: files[4].publicUrl,
      },
    };
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Isolated KYC firm', slug: 'kyc-a-' + Date.now() } })).id;
    otherOrg = (await db.organization.create({ data: { name: 'Isolated other firm', slug: 'kyc-b-' + Date.now() } })).id;
    agent = await actor('BROKER_AGENT', org);
    peer = await actor('BROKER_AGENT', org);
    admin = await actor('BROKER_ADMIN', org);
    peerAdmin = await actor('BROKER_ADMIN', org);
    outsider = await actor('BROKER_ADMIN', otherOrg);
    superAdmin = await actor('SUPER_ADMIN', null);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('rejects external/foreign upload URLs and repeated pose captures before writing any records', async () => {
    const fixture = await body(agent, 10);
    submission = fixture.body;
    firstUpload = fixture.files[0];
    await request(app.getHttpServer())
      .post('/api/broker/team/agent-kyc')
      .set(auth(agent))
      .send({ ...submission, aadhaarPhotoUrl: 'https://untrusted.invalid/private' })
      .expect(400);
    const foreign = await upload(peer, 230);
    await request(app.getHttpServer())
      .post('/api/broker/team/agent-kyc')
      .set(auth(agent))
      .send({ ...submission, panPhotoUrl: foreign.publicUrl })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/broker/team/agent-kyc')
      .set(auth(agent))
      .send({ ...submission, livelinessLeftUrl: submission.livelinessStraightUrl })
      .expect(400);
    expect(await db.kycDocument.count({ where: { userId: agent.id } })).toBe(0);
  });

  it('submits privately, exposes only document-id previews, and denies peer/other-firm access', async () => {
    await request(app.getHttpServer()).post('/api/broker/team/agent-kyc').set(auth(agent)).send(submission).expect(201);
    docs = await db.kycDocument.findMany({ where: { userId: agent.id, supersededAt: null } });
    expect(docs).toHaveLength(5);
    expect(docs.every((d) => d.privateKey && d.fileSha256)).toBe(true);
    const mine = await request(app.getHttpServer()).get('/api/broker/team/agent-kyc/mine').set(auth(agent)).expect(200);
    expect(mine.body.documents.every((d: any) => !d.privateKey && !d.fileSha256 && /\/api\/media\/kyc\//.test(d.fileUrl))).toBe(true);
    const path = new URL(mine.body.aadhaarPhotoUrl).pathname;
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer()).get(path).set(auth(peer)).expect(404);
    await request(app.getHttpServer()).get(path).set(auth(outsider)).expect(404);
    const own = await request(app.getHttpServer()).get(path).set(auth(agent)).expect(200);
    expect(own.headers['cache-control']).toContain('no-store');
    await request(app.getHttpServer()).get(path).set(auth(admin)).expect(200);
    await request(app.getHttpServer()).get(path).set(auth(superAdmin)).expect(200);
    const raw = new URL(firstUpload.publicUrl).pathname;
    await request(app.getHttpServer()).get(raw).set(auth(peer)).expect(403);
    await request(app.getHttpServer()).get(raw).expect(401);
    const firm = await request(app.getHttpServer()).get('/api/broker/firm-kyc').set(auth(peer)).expect(200);
    expect(firm.body.documents).toEqual([]);
    expect(firm.body.panDocument).toBeNull();
  });

  it('signed PUT retries preserve bytes and cannot overwrite an already submitted file', async () => {
    const original = await app.get(LocalStorageService).read(firstUpload.key);
    await request(app.getHttpServer()).put(firstUpload.path).set('Content-Type', 'image/png').send(firstUpload.bytes).expect(200);
    const replacement = await sharp({ create: { width: 48, height: 48, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    await request(app.getHttpServer()).put(firstUpload.path).set('Content-Type', 'image/png').send(replacement).expect(409);
    const after = await app.get(LocalStorageService).read(firstUpload.key);
    expect(after.body.equals(original.body)).toBe(true);
  });

  it('requires the exact reviewed submission and does not verify the firm while approving personal KYC', async () => {
    const path = '/api/broker/team/agents/' + agent.id + '/kyc';
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(agent))
      .send({ status: 'VERIFIED', expectedDocumentIds: docs.map((d) => d.id) })
      .expect(403);
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(admin))
      .send({ status: 'VERIFIED', expectedDocumentIds: ['stale'] })
      .expect(409);
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(admin))
      .send({ status: 'VERIFIED', expectedDocumentIds: docs.map((d) => d.id) })
      .expect(200);
    expect((await db.organization.findUniqueOrThrow({ where: { id: org } })).verification).toBe('UNVERIFIED');
    const changed = await body(agent, 110);
    await request(app.getHttpServer()).post('/api/broker/team/agent-kyc').set(auth(agent)).send(changed.body).expect(409);
    await request(app.getHttpServer())
      .post('/api/kyc')
      .set(auth(agent))
      .send({ docType: 'AADHAAR', docNumber: '111122223333', fileUrl: changed.body.aadhaarPhotoUrl })
      .expect(process.env.BROKER_FIRST === 'true' ? 403 : 400);
    expect(await db.kycDocument.count({ where: { userId: agent.id } })).toBe(5);
  });

  it('keeps personal Admin documents from peer Admins and prevents self approval', async () => {
    const fixture = await body(admin, 50);
    await request(app.getHttpServer()).post('/api/broker/team/agent-kyc').set(auth(admin)).send(fixture.body).expect(201);
    const ownDocs = await db.kycDocument.findMany({ where: { userId: admin.id, supersededAt: null } });
    await request(app.getHttpServer())
      .get('/api/broker/team/agents/' + admin.id + '/kyc')
      .set(auth(peerAdmin))
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/broker/team/agents/' + admin.id + '/kyc')
      .set(auth(admin))
      .send({ status: 'VERIFIED', expectedDocumentIds: ownDocs.map((d) => d.id) })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/media/kyc/' + ownDocs[0].id)
      .set(auth(peerAdmin))
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/media/kyc/' + ownDocs[0].id)
      .set(auth(superAdmin))
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/admin/kyc/' + ownDocs[0].id)
      .set(auth(superAdmin))
      .send({ status: 'VERIFIED', verifyOrganization: true })
      .expect(200);
    expect((await db.organization.findUniqueOrThrow({ where: { id: org } })).verification).toBe('UNVERIFIED');
  });

  it('keeps rejected history, rejects stale review IDs and retries a pending submission without duplicate records', async () => {
    const fixture = await body(peer, 70);
    await request(app.getHttpServer()).post('/api/broker/team/agent-kyc').set(auth(peer)).send(fixture.body).expect(201);
    const previous = await db.kycDocument.findMany({ where: { userId: peer.id, supersededAt: null } });
    const review = '/api/broker/team/agents/' + peer.id + '/kyc';
    await request(app.getHttpServer())
      .patch(review)
      .set(auth(admin))
      .send({ status: 'REJECTED', expectedDocumentIds: previous.map((d) => d.id) })
      .expect(400);
    await request(app.getHttpServer())
      .patch(review)
      .set(auth(admin))
      .send({ status: 'REJECTED', reviewNote: 'Retake left pose', expectedDocumentIds: previous.map((d) => d.id) })
      .expect(200);
    const next = await body(peer, 95);
    await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/broker/team/agent-kyc').set(auth(peer)).send(next.body).expect(201)));
    expect(await db.kycDocument.count({ where: { userId: peer.id } })).toBe(10);
    expect(await db.kycDocument.count({ where: { userId: peer.id, supersededAt: { not: null }, reviewNote: 'Retake left pose' } })).toBe(5);
    const history = await request(app.getHttpServer()).get('/api/broker/team/agent-kyc/history').set(auth(peer)).expect(200);
    expect(history.body.items).toHaveLength(5);
    expect(history.body.items.every((d: any) => !d.privateKey && !d.fileSha256 && /\/api\/media\/kyc\//.test(d.fileUrl))).toBe(true);
    await request(app.getHttpServer())
      .get('/api/broker/team/agent-kyc/history?member=' + peer.id)
      .set(auth(agent))
      .expect(404);
    await request(app.getHttpServer())
      .patch(review)
      .set(auth(admin))
      .send({ status: 'VERIFIED', expectedDocumentIds: previous.map((d) => d.id) })
      .expect(409);
  });

  it('reviews only firm documents into firm verification and prevents repeated review notifications', async () => {
    const first = await upload(admin, 150),
      second = await upload(admin, 180);
    const payload = { panNumber: 'ABCDE1234F', panPhotoUrl: first.publicUrl, reraNumber: 'RERA-FIXTURE', reraCertificateUrl: second.publicUrl };
    await request(app.getHttpServer()).post('/api/broker/firm-kyc').set(auth(admin)).send(payload).expect(201);
    const replay = await request(app.getHttpServer()).post('/api/broker/firm-kyc').set(auth(admin)).send(payload).expect(201);
    expect(replay.body.replayed).toBe(true);
    const firmDocs = await db.kycDocument.findMany({ where: { organizationId: org, userId: null, supersededAt: null } });
    expect(firmDocs).toHaveLength(2);
    await request(app.getHttpServer())
      .patch('/api/admin/kyc/' + firmDocs[0].id)
      .set(auth(superAdmin))
      .send({ status: 'VERIFIED' })
      .expect(200);
    expect((await db.organization.findUniqueOrThrow({ where: { id: org } })).verification).toBe('PENDING');
    await request(app.getHttpServer())
      .patch('/api/admin/kyc/' + firmDocs[1].id)
      .set(auth(superAdmin))
      .send({ status: 'VERIFIED' })
      .expect(200);
    expect((await db.organization.findUniqueOrThrow({ where: { id: org } })).verification).toBe('VERIFIED');
    const count = await db.notification.count({ where: { userId: admin.id } });
    await request(app.getHttpServer())
      .patch('/api/admin/kyc/' + firmDocs[1].id)
      .set(auth(superAdmin))
      .send({ status: 'VERIFIED' })
      .expect(200);
    expect(await db.notification.count({ where: { userId: admin.id } })).toBe(count);
    await request(app.getHttpServer())
      .post('/api/broker/firm-kyc')
      .set(auth(admin))
      .send({ panNumber: 'ABCDE1234F', panPhotoUrl: first.publicUrl })
      .expect(409);
  });

  it('renders private PDF pages locally with the same ownership checks and validates page boundaries', async () => {
    const bytes = await new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument(),
        chunks: Buffer[] = [];
      doc.on('data', (b) => chunks.push(b));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.text('Isolated PDF page one').addPage().text('Isolated PDF page two').end();
    });
    const sign = await request(app.getHttpServer())
      .post('/api/me/uploads/sign')
      .set(auth(peer))
      .send({ kind: 'kyc', contentType: 'application/pdf' })
      .expect(201);
    await request(app.getHttpServer()).put(new URL(sign.body.uploadUrl).pathname).set('Content-Type', 'application/pdf').send(bytes).expect(200);
    const path = new URL(sign.body.publicUrl).pathname;
    await request(app.getHttpServer())
      .get(path + '?render=page&page=1')
      .set(auth(agent))
      .expect(403);
    const response = await request(app.getHttpServer())
      .get(path + '?render=page&page=2')
      .set(auth(peer))
      .expect(200);
    expect(response.body.pages).toBe(2);
    expect(response.body.page).toBe(2);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(Buffer.from(response.body.data, 'base64').subarray(1, 4).toString()).toBe('PNG');
    await request(app.getHttpServer())
      .get(path + '?render=page&page=3')
      .set(auth(peer))
      .expect(400);
  });
});
