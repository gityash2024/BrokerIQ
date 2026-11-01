process.env.MEDIA_ROOT ||= require('node:path').join(require('node:os').tmpdir(), 'brokeriq-tests', 'kyc-migration-' + Date.now());
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { CryptoService } from '../src/core/settings/crypto.service';
import { LocalStorageService } from '../src/core/media/local-storage.service';
import { KycPrivateMigration, legacyKycReference } from '../src/core/media/kyc-migration';
import { runKycPrivateMigration } from '../src/ops/kyc-private-migration';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env } from '../src/config/env';

describe('KYC migration (real PostgreSQL/encrypted storage, stubbed external Cloudinary boundary)', () => {
  let mod: any, db: PrismaService, migration: KycPrivateMigration, crypto: CryptoService, document: any, bytes: Buffer;
  const url = 'https://res.cloudinary.com/isolated-fixture/image/upload/v123/brokeriq/kyc/fixture/original.png';
  beforeAll(async () => {
    mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    db = mod.get(PrismaService);
    crypto = mod.get(CryptoService);
    migration = new KycPrivateMigration(db, mod.get(LocalStorageService), crypto, mod.get(SettingsService));
    bytes = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#335577' } })
      .png()
      .toBuffer();
    const user = await db.user.create({ data: { name: 'Isolated migration fixture', email: `migration.${Date.now()}@e2e.test`, role: 'USER' } });
    document = await db.kycDocument.create({
      data: { userId: user.id, docType: 'OTHER', fileUrl: url, status: 'REJECTED', reviewNote: 'Preserve existing decision' },
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => mod?.close());

  it('refuses an unexpected database and never retires provider assets from a test/restore database', async () => {
    await expect(runKycPrivateMigration({ mode: 'plan', expectedDatabase: 'unexpected-database' })).rejects.toThrow('does not match');
    const directory = await mkdtemp(join(tmpdir(), 'brokeriq-proof-fixture-'));
    const proof = join(directory, 'proof.json');
    const original = process.env.BROKERIQ_KYC_RETIRE_PUBLIC;
    try {
      await writeFile(
        proof,
        JSON.stringify({ result: 'VERIFIED_SCRATCH_RESTORE_NO_APPLICATION_STARTED', tablesVerified: 1, mediaFilesVerified: 1, dumpSha256: 'a'.repeat(64) }),
        { mode: 0o600 },
      );
      process.env.BROKERIQ_KYC_RETIRE_PUBLIC = '1';
      await expect(
        runKycPrivateMigration({ mode: 'retire', expectedDatabase: new URL(env().DATABASE_URL).pathname.slice(1), backupProof: proof }),
      ).rejects.toThrow('never run it from a scratch/test database');
    } finally {
      if (original === undefined) delete process.env.BROKERIQ_KYC_RETIRE_PUBLIC;
      else process.env.BROKERIQ_KYC_RETIRE_PUBLIC = original;
      await rm(directory, { recursive: true });
    }
  });

  const connection = () =>
    jest
      .spyOn(mod.get(SettingsService), 'resolve')
      .mockResolvedValue({ cloudName: 'isolated-fixture', apiKey: 'not-a-live-key', apiSecret: 'not-a-live-secret' });
  it('rejects foreign accounts, transformed images and non-KYC paths before any remote request', () => {
    expect(legacyKycReference(url, 'isolated-fixture').publicId).toBe('brokeriq/kyc/fixture/original');
    for (const input of [
      url.replace('/image/upload/', '/image/upload/w_300/'),
      url.replace('/kyc/', '/listing/'),
      url.replace('isolated-fixture', 'other-account'),
      url.replace('res.cloudinary.com', 'attacker.invalid'),
      url + '?signed=unexpected',
    ])
      expect(() => legacyKycReference(input, 'isolated-fixture')).toThrow();
  });

  it('copies exact original bytes, retains decision/count and encrypts the legacy reference without changing provider access', async () => {
    connection();
    jest.spyOn(cloudinary.api, 'resource').mockResolvedValue({ asset_id: 'fixture-asset', bytes: bytes.length, format: 'png', version: 123 } as any);
    const rename = jest.spyOn(cloudinary.uploader, 'rename');
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } }));
    const before = await db.kycDocument.count();
    const result = await migration.copy(document.id);
    expect(result.copied).toBe(true);
    const after = await db.kycDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(after.status).toBe('REJECTED');
    expect(after.reviewNote).toBe('Preserve existing decision');
    expect(after.fileSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const privateFile = await mod.get(LocalStorageService).read(after.privateKey);
    expect(privateFile.body.equals(bytes)).toBe(true);
    expect(await db.kycDocument.count()).toBe(before);
    const stored = await db.systemSetting.findUniqueOrThrow({ where: { key: 'kyc.private-migration.' + document.id } });
    expect(JSON.stringify(stored.value)).not.toContain('cloudinary.com');
    expect(JSON.parse(crypto.decrypt((stored.value as any).enc)).url).toBe(url);
    expect((await migration.copy(document.id)).alreadyPrivate).toBe(true);
    expect(rename).not.toHaveBeenCalled();
  });

  it('keeps provider acceptance separate from CDN blocking and retries without another rename', async () => {
    connection();
    jest.spyOn(cloudinary.api, 'resource').mockImplementation(async (_id: string, opts: any) => {
      if (opts.type === 'authenticated') throw { http_code: 404 };
      return { asset_id: 'fixture-asset', bytes: bytes.length, format: 'png', version: 123 } as any;
    });
    const rename = jest.spyOn(cloudinary.uploader, 'rename').mockResolvedValue({ asset_id: 'fixture-asset' } as any);
    let headStatus = 200;
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, opts) =>
        opts?.method === 'HEAD'
          ? new Response(null, { status: headStatus })
          : new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } }),
      );
    const first = await migration.retire(document.id);
    expect(first.retired).toBe(true);
    expect(first.publicAccessBlocked).toBe(false);
    expect(rename).toHaveBeenCalledWith(
      'brokeriq/kyc/fixture/original',
      'brokeriq/kyc/fixture/original',
      expect.objectContaining({ to_type: 'authenticated', invalidate: true, overwrite: false }),
    );
    headStatus = 404;
    expect((await migration.retire(document.id)).publicAccessBlocked).toBe(true);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(await db.auditLog.count({ where: { action: 'kyc.media.public-access-retired', entityId: document.id } })).toBe(1);
    await migration.retire(document.id);
    expect(await db.auditLog.count({ where: { action: 'kyc.media.public-access-retired', entityId: document.id } })).toBe(1);
  });
});
