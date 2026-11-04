import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../settings/crypto.service';
import { SettingsService } from '../settings/settings.service';
import { LocalStorageService } from './local-storage.service';
import { env } from '../../config/env';

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const prefix = 'kyc.private-migration.';
type Legacy = {
  url: string;
  cloudName: string;
  publicId: string;
  resourceType: 'image';
  sha256: string;
  sourceMd5: string;
  providerVersion: number;
  providerFormat: string;
  assetId: string;
  bytes: number;
  copiedAt: string;
  retiredAt?: string;
  oldUrlBlockedAt?: string;
};

/** Only original KYC assets in the configured Cloudinary account may be migrated. No arbitrary remote URLs. */
export function legacyKycReference(value: string, cloudName: string, folder = 'brokeriq') {
  const url = new URL(value);
  const base = `/${cloudName}/image/upload/`;
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'res.cloudinary.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith(base)
  )
    throw Object.assign(new Error('Legacy KYC provider URL requires manual review'), { safeCode: 'KYC_LEGACY_KYC_PROVIDER_URL_REQUIRES_MANUAL_REVIEW' });
  const asset = url.pathname.slice(base.length).replace(/^v\d+\//, '');
  if (
    !/^[A-Za-z0-9_/-]+$/.test(folder) ||
    !asset.startsWith(folder + '/kyc/') ||
    !/^[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp|pdf)$/i.test(asset) ||
    asset.split('/').some((s) => s === '.' || s === '..') ||
    !asset.split('/').includes('kyc')
  )
    throw Object.assign(new Error('Only an original KYC asset is eligible'), { safeCode: 'KYC_ONLY_AN_ORIGINAL_KYC_ASSET_IS_ELIGIBLE' });
  return { url: url.href, cloudName, publicId: asset.replace(/\.[^.]+$/, ''), resourceType: 'image' as const };
}

async function original(url: string) {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body)
    throw Object.assign(new Error('Legacy KYC download failed; original was retained'), { safeCode: 'KYC_LEGACY_KYC_DOWNLOAD_FAILED_ORIGINAL_WAS_RETAINED' });
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!contentType || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(contentType))
    throw Object.assign(new Error('Unexpected KYC media type'), { safeCode: 'KYC_UNEXPECTED_KYC_MEDIA_TYPE' });
  const chunks: Buffer[] = [];
  let length = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 20 * 1024 * 1024)
        throw Object.assign(new Error('KYC migration file exceeds safety limit'), { safeCode: 'KYC_MIGRATION_FILE_EXCEEDS_LIMIT' });
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks);
  if (contentType === 'application/pdf') {
    if (body.subarray(0, 5).toString() !== '%PDF-') throw Object.assign(new Error('Invalid KYC PDF'), { safeCode: 'KYC_INVALID_KYC_PDF' });
  } else {
    const metadata = await sharp(body, { limitInputPixels: 20_000_000 }).metadata();
    if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format ?? ''))
      throw Object.assign(new Error('Invalid KYC image'), { safeCode: 'KYC_INVALID_KYC_IMAGE' });
  }
  return { body, contentType };
}

/** Deliberately not a CoreModule provider/job/API. Invoke only through the explicit operations command. */
export class KycPrivateMigration {
  constructor(
    private readonly db: PrismaService,
    private readonly local: LocalStorageService,
    private readonly crypto: CryptoService,
    private readonly settings: SettingsService,
  ) {}

  async plan() {
    const [total, remaining, copied] = await Promise.all([
      this.db.kycDocument.count(),
      this.db.kycDocument.count({ where: { privateKey: null } }),
      this.db.systemSetting.count({ where: { key: { startsWith: prefix } } }),
    ]);
    return { total, remaining, copied };
  }

  async verifyCopies(expected: { count: string; digest: string }) {
    const records = await this.db.systemSetting.findMany({ where: { key: { startsWith: prefix } } });
    const references: { id: string; url: string }[] = [];
    let bytes = 0;
    for (const record of records) {
      const legacy: Legacy = JSON.parse(this.crypto.decrypt((record.value as { enc: string }).enc));
      const id = record.key.slice(prefix.length);
      const doc = await this.db.kycDocument.findUniqueOrThrow({ where: { id } });
      if (!doc.privateKey || !doc.fileSha256) throw Error('Private copy missing');
      const body = (await this.local.read(doc.privateKey)).body;
      if (digest(body) !== legacy.sha256 || doc.fileSha256 !== legacy.sha256 || body.length !== legacy.bytes) throw Error('Private copy checksum mismatch');
      references.push({ id, url: legacy.url });
      bytes += body.length;
    }
    const [result] = await this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      return tx.$queryRaw<{ count: string; digest: string }[]>`
        SELECT count(*)::text AS count, md5(COALESCE(string_agg(md5(r::text), '' ORDER BY md5(r::text)), '')) AS digest
        FROM (
          SELECT (to_jsonb(t) - 'privateKey' - 'fileSha256' - 'supersededAt') || jsonb_build_object('fileUrl', legacy.url) AS r
          FROM "KycDocument" t JOIN jsonb_to_recordset(${JSON.stringify(references)}::jsonb) AS legacy(id text, url text) ON t.id = legacy.id
        ) original_rows`;
    });
    if (result.count !== expected.count || result.digest !== expected.digest) throw Error('Original KYC fields differ from the backup snapshot');
    return { documentsVerified: references.length, originalBytesVerified: bytes, originalFieldsMatchSnapshot: true };
  }

  async inspect(id: string) {
    const doc = await this.db.kycDocument.findUniqueOrThrow({ where: { id } });
    const { credentials, folder } = await this.provider(doc.organizationId);
    const reference = legacyKycReference(doc.fileUrl, credentials.cloud_name, folder);
    const asset = await cloudinary.api.resource(reference.publicId, { ...credentials, timeout: 15000, resource_type: 'image', type: 'upload' });
    const delivered = await original(reference.url);
    const signed = cloudinary.utils.private_download_url(reference.publicId, asset.format, {
      ...credentials,
      resource_type: 'image',
      type: 'upload',
      attachment: false,
    });
    if (new URL(signed).origin !== 'https://api.cloudinary.com') throw Error('Unexpected original download origin');
    const source = await original(signed);
    return {
      providerEtagPresent: typeof asset.etag === 'string',
      providerEtagLength: typeof asset.etag === 'string' ? asset.etag.length : 0,
      providerBytes: Number(asset.bytes),
      deliveryBytes: delivered.body.length,
      originalDownloadBytes: source.body.length,
      deliveryMatchesProviderEtag: createHash('md5').update(delivered.body).digest('hex') === asset.etag,
      originalDownloadMatchesProviderEtag: createHash('md5').update(source.body).digest('hex') === asset.etag,
      deliveryAndOriginalIdentical: delivered.body.equals(source.body),
      urlVersionMatchesProvider: Number(/\/upload\/v(\d+)\//.exec(reference.url)?.[1]) === Number(asset.version),
    };
  }

  private async provider(organizationId: string | null) {
    const values = await this.settings.resolve('cloudinary', organizationId);
    if (!values?.cloudName || !values.apiKey || !values.apiSecret)
      throw Object.assign(new Error('Existing Cloudinary connection is required for this legacy asset'), {
        safeCode: 'KYC_EXISTING_CLOUDINARY_CONNECTION_IS_REQUIRED_FOR_THIS_LEGACY_ASSET',
      });
    return {
      credentials: { cloud_name: String(values.cloudName), api_key: String(values.apiKey), api_secret: String(values.apiSecret) },
      folder: String(values.folder ?? 'brokeriq'),
    };
  }

  async copy(id: string) {
    const doc = await this.db.kycDocument.findUniqueOrThrow({ where: { id } });
    if (!this.local.enabled) throw Object.assign(new Error('Private storage is required'), { safeCode: 'KYC_PRIVATE_STORAGE_IS_REQUIRED' });
    if (doc.privateKey && doc.fileSha256) {
      if (digest((await this.local.read(doc.privateKey)).body) !== doc.fileSha256)
        throw Object.assign(new Error('Existing private copy integrity failed'), { safeCode: 'KYC_EXISTING_PRIVATE_COPY_INTEGRITY_FAILED' });
      return { id, copied: false, alreadyPrivate: true };
    }
    const { credentials, folder } = await this.provider(doc.organizationId);
    const reference = legacyKycReference(doc.fileUrl, credentials.cloud_name, folder);
    const asset = await cloudinary.api.resource(reference.publicId, { ...credentials, timeout: 15000, resource_type: reference.resourceType, type: 'upload' });
    const file = await original(reference.url);
    const originalUrl = cloudinary.utils.private_download_url(reference.publicId, asset.format, {
      ...credentials,
      resource_type: 'image',
      type: 'upload',
      attachment: false,
    });
    if (new URL(originalUrl).origin !== 'https://api.cloudinary.com') throw Error('Unexpected original download origin');
    const source = await original(originalUrl);
    const sha256 = digest(file.body);
    const sourceMd5 = createHash('md5').update(file.body).digest('hex');
    const after = await cloudinary.api.resource(reference.publicId, { ...credentials, timeout: 15000, resource_type: 'image', type: 'upload' });
    const version = Number(/\/upload\/v(\d+)\//.exec(reference.url)?.[1]);
    // Admin resource responses need not include upload-response etag. Use two byte-identical
    // delivery/original downloads plus stable asset identity/version, then our own SHA-256.
    if (
      !asset.asset_id ||
      !Number.isFinite(version) ||
      version !== Number(asset.version) ||
      after.asset_id !== asset.asset_id ||
      Number(after.version) !== Number(asset.version) ||
      Number(asset.bytes) !== file.body.length ||
      !file.body.equals(source.body) ||
      (asset.etag && asset.etag !== sourceMd5)
    )
      throw Object.assign(new Error('Provider original differs from legacy URL; manual review required'), {
        safeCode: 'KYC_PROVIDER_ORIGINAL_DIFFERS_FROM_LEGACY_URL_MANUAL_REVIEW_REQUIRED',
      });
    const key = await this.local.putKyc(file.body, file.contentType, doc.userId || doc.organizationId || 'legacy');
    if (digest((await this.local.read(key)).body) !== sha256)
      throw Object.assign(new Error('Copied KYC checksum mismatch'), { safeCode: 'KYC_COPIED_KYC_CHECKSUM_MISMATCH' });
    const legacy: Legacy = {
      ...reference,
      sha256,
      sourceMd5,
      providerVersion: Number(asset.version),
      providerFormat: String(asset.format),
      assetId: asset.asset_id,
      bytes: file.body.length,
      copiedAt: new Date().toISOString(),
    };
    const record = { enc: this.crypto.encrypt(JSON.stringify(legacy)) };
    await this.db.$transaction(async (tx) => {
      const update = await tx.kycDocument.updateMany({
        where: { id, privateKey: null, fileUrl: doc.fileUrl },
        data: { privateKey: key, fileSha256: sha256, fileUrl: `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/media/f/${key}` },
      });
      if (update.count !== 1)
        throw Object.assign(new Error('KYC changed during migration; no provider asset was modified'), {
          safeCode: 'KYC_KYC_CHANGED_DURING_MIGRATION_NO_PROVIDER_ASSET_WAS_MODIFIED',
        });
      await tx.systemSetting.create({ data: { key: prefix + id, value: record } });
      await tx.auditLog.create({
        data: {
          action: 'kyc.media.copy',
          entity: 'KycDocument',
          entityId: id,
          organizationId: doc.organizationId,
          meta: { sha256, bytes: file.body.length, originalPreserved: true },
        },
      });
    });
    return { id, copied: true, sha256, bytes: file.body.length };
  }

  async retire(id: string) {
    const doc = await this.db.kycDocument.findUniqueOrThrow({ where: { id } });
    const row = await this.db.systemSetting.findUnique({ where: { key: prefix + id } });
    const encrypted = (row?.value as { enc?: string } | undefined)?.enc;
    if (!encrypted || !doc.privateKey || !doc.fileSha256)
      throw Object.assign(new Error('Verified private copy and retained legacy reference are required'), {
        safeCode: 'KYC_VERIFIED_PRIVATE_COPY_AND_RETAINED_LEGACY_REFERENCE_ARE_REQUIRED',
      });
    const legacy: Legacy = JSON.parse(this.crypto.decrypt(encrypted));
    if (digest((await this.local.read(doc.privateKey)).body) !== legacy.sha256 || doc.fileSha256 !== legacy.sha256)
      throw Object.assign(new Error('Private copy no longer matches original'), { safeCode: 'KYC_PRIVATE_COPY_NO_LONGER_MATCHES_ORIGINAL' });
    if (await this.db.kycDocument.count({ where: { fileUrl: legacy.url } }))
      throw Object.assign(new Error('Other KYC records still depend on this public asset'), {
        safeCode: 'KYC_OTHER_KYC_RECORDS_STILL_DEPEND_ON_THIS_PUBLIC_ASSET',
      });
    const { credentials, folder } = await this.provider(doc.organizationId);
    legacyKycReference(legacy.url, credentials.cloud_name, folder);
    if (!legacy.retiredAt) {
      // Retry can find an asset already moved by the previous request before its DB acknowledgement.
      let alreadyAuthenticated = false;
      try {
        const current = await cloudinary.api.resource(legacy.publicId, {
          ...credentials,
          timeout: 15000,
          resource_type: legacy.resourceType,
          type: 'authenticated',
        });
        if (current.asset_id !== legacy.assetId || Number(current.bytes) !== legacy.bytes || (current.etag && current.etag !== legacy.sourceMd5))
          throw Object.assign(new Error('Authenticated asset does not match the preserved original'), {
            safeCode: 'KYC_AUTHENTICATED_ASSET_DOES_NOT_MATCH_THE_PRESERVED_ORIGINAL',
          });
        alreadyAuthenticated = true;
      } catch (error) {
        if ((error as { error?: { http_code?: number }; http_code?: number }).error?.http_code !== 404 && (error as { http_code?: number }).http_code !== 404)
          throw Object.assign(new Error('Provider asset status could not be verified'), { safeCode: 'KYC_PROVIDER_ASSET_STATUS_COULD_NOT_BE_VERIFIED' });
      }
      if (!alreadyAuthenticated) {
        const current = await cloudinary.api.resource(legacy.publicId, { ...credentials, timeout: 15000, resource_type: legacy.resourceType, type: 'upload' });
        if (
          current.asset_id !== legacy.assetId ||
          Number(current.version) !== legacy.providerVersion ||
          Number(current.bytes) !== legacy.bytes ||
          (current.etag && current.etag !== legacy.sourceMd5)
        )
          throw Object.assign(new Error('Public asset changed after private copy; manual review required'), {
            safeCode: 'KYC_PUBLIC_ASSET_CHANGED_AFTER_PRIVATE_COPY_MANUAL_REVIEW_REQUIRED',
          });
        const options = {
          ...credentials,
          timeout: 15000,
          resource_type: legacy.resourceType,
          type: 'upload' as const,
          to_type: 'authenticated' as const,
          overwrite: false,
          invalidate: true,
        };
        await cloudinary.uploader.rename(legacy.publicId, legacy.publicId, options);
      }
      const signed = cloudinary.utils.private_download_url(legacy.publicId, legacy.providerFormat, {
        ...credentials,
        resource_type: legacy.resourceType,
        type: 'authenticated',
        attachment: false,
      });
      if (new URL(signed).origin !== 'https://api.cloudinary.com' || digest((await original(signed)).body) !== legacy.sha256)
        throw Object.assign(new Error('Authenticated original checksum mismatch'), { safeCode: 'KYC_AUTHENTICATED_ORIGINAL_CHECKSUM_MISMATCH' });
      legacy.retiredAt = new Date().toISOString();
      await this.db.systemSetting.update({ where: { key: prefix + id }, data: { value: { enc: this.crypto.encrypt(JSON.stringify(legacy)) } } });
    }
    const response = await fetch(legacy.url, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    // 429/5xx are not evidence that a public asset was secured.
    const blocked = [401, 403, 404, 410].includes(response.status);
    if (blocked && !legacy.oldUrlBlockedAt) {
      legacy.oldUrlBlockedAt = new Date().toISOString();
      await this.db.systemSetting.update({ where: { key: prefix + id }, data: { value: { enc: this.crypto.encrypt(JSON.stringify(legacy)) } } });
      await this.db.auditLog.create({
        data: {
          action: 'kyc.media.public-access-retired',
          entity: 'KycDocument',
          entityId: id,
          meta: { sha256: legacy.sha256, publicHttpStatus: response.status },
        },
      });
    }
    return { id, retired: true, publicAccessBlocked: blocked, publicHttpStatus: response.status };
  }
}
