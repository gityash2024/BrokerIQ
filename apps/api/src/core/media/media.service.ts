import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SettingsService } from '../settings/settings.service';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { shortCode } from '../../common/utils';
import { LocalStorageService } from './local-storage.service';

export type UploadKind = 'listing' | 'avatar' | 'logo' | 'kyc' | 'project' | 'cms' | 'scan' | 'chat';

const NOT_CONFIGURED = 'File upload configured नहीं है। Super Admin → Settings → Integrations में Cloudinary (या S3/R2) जोड़ें।';

/**
 * Signed uploads. Self-hosted deployments (MEDIA_ROOT set) store files on the server's own
 * disk, compressed + encrypted; otherwise files go straight from the browser/app to
 * Cloudinary or S3 — zero bandwidth cost on our server.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly settings: SettingsService,
    private readonly local: LocalStorageService,
  ) {}

  async sign(kind: UploadKind, contentType = 'image/jpeg', ownerId = 'anon') {
    if (this.local.enabled) return this.local.presign(kind, contentType, ownerId);
    const folderSuffix = `${kind}/${ownerId}`;
    const cld = await this.settings.resolve('cloudinary');
    if (cld) {
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `${cld.folder ?? 'brokeriq'}/${folderSuffix}`;
      const params = { folder, timestamp };
      const signature = cloudinary.utils.api_sign_request(params, String(cld.apiSecret));
      const resource = contentType.startsWith('video') ? 'video' : contentType.startsWith('image') ? 'image' : 'raw';
      return {
        provider: 'cloudinary' as const,
        method: 'POST' as const,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cld.cloudName}/${resource}/upload`,
        fields: { api_key: String(cld.apiKey), timestamp: String(timestamp), signature, folder },
        fileField: 'file',
      };
    }
    const s3 = await this.settings.resolve('s3');
    if (s3) {
      const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'bin';
      const key = `${folderSuffix}/${Date.now()}-${shortCode(10)}.${ext}`;
      const client = this.s3Client(s3);
      const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: String(s3.bucket), Key: key, ContentType: contentType }), { expiresIn: 600 });
      return {
        provider: 's3' as const,
        method: 'PUT' as const,
        uploadUrl,
        headers: { 'Content-Type': contentType },
        publicUrl: `${String(s3.publicBaseUrl).replace(/\/$/, '')}/${key}`,
        key,
      };
    }
    throw new IntegrationNotConfiguredException('cloudinary', NOT_CONFIGURED);
  }

  /** Server-side upload of a base64 data URL (used for AI scanner images). */
  async uploadDataUrl(dataUrl: string, kind: UploadKind, ownerId: string): Promise<string | null> {
    if (!dataUrl.startsWith('data:')) throw new BadRequestException('Invalid image');
    if (this.local.enabled) return this.local.putDataUrl(dataUrl, kind, ownerId);
    const cld = await this.settings.resolve('cloudinary');
    if (!cld) return null;
    cloudinary.config({ cloud_name: String(cld.cloudName), api_key: String(cld.apiKey), api_secret: String(cld.apiSecret) });
    const res = await cloudinary.uploader.upload(dataUrl, { folder: `${cld.folder ?? 'brokeriq'}/${kind}/${ownerId}` });
    return res.secure_url;
  }

  async testCloudinary(values: Record<string, unknown>) {
    cloudinary.config({ cloud_name: String(values.cloudName), api_key: String(values.apiKey), api_secret: String(values.apiSecret) });
    const r = await cloudinary.api.ping();
    return r.status;
  }

  async testS3(values: Record<string, unknown>) {
    await this.s3Client(values).send(new HeadBucketCommand({ Bucket: String(values.bucket) }));
    return 'ok';
  }

  private s3Client(v: Record<string, unknown>) {
    return new S3Client({
      region: String(v.region ?? 'auto'),
      endpoint: String(v.endpoint),
      forcePathStyle: true,
      credentials: { accessKeyId: String(v.accessKeyId), secretAccessKey: String(v.secretAccessKey) },
    });
  }
}
