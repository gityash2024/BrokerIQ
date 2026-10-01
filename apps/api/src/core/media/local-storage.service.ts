import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { promisify } from 'util';
import { brotliCompress, brotliDecompress, constants as zlib } from 'zlib';
import sharp from 'sharp';
import { env } from '../../config/env';
import { shortCode } from '../../common/utils';
import type { UploadKind } from './media.service';

const brotli = promisify(brotliCompress);
const unbrotli = promisify(brotliDecompress);

const MAGIC = Buffer.from('BIQ1');
const FLAG_BROTLI = 1;
const MB = 1024 * 1024;

/** Kinds whose files must never be cached by browsers / Cloudflare. */
export const PRIVATE_KINDS: readonly UploadKind[] = ['kyc', 'scan', 'chat', 'inspection'];
/** Widths the API resizes to on `?w=` — a fixed set keeps the CDN cache small. */
export const RESIZE_WIDTHS = [320, 480, 800, 1200] as const;

const KEY_RE = /^([a-z]+)\/([A-Za-z0-9_-]{1,64})\/(\d{6})\/([A-Za-z0-9]{20})$/;

interface UploadClaims {
  key: string;
  ct: string;
  max: number;
  exp: number;
}

/**
 * Server-disk media store (self-hosted deployments, enabled by MEDIA_ROOT).
 *
 * Every file is shrunk before it is written — photos become metadata-free WebP, other
 * documents are brotli'd when that helps — and then sealed with AES-256-GCM using a key
 * derived from ENCRYPTION_MASTER_KEY. On-disk layout: MEDIA_ROOT/<kind>/<owner>/<yyyymm>/<id>.
 *
 * File format: "BIQ1" | flags(1) | ctLen(1) | contentType | iv(12) | tag(16) | ciphertext.
 * The magic/flags/contentType prefix is authenticated as AAD.
 */
@Injectable()
export class LocalStorageService {
  private readonly root = env().MEDIA_ROOT;
  private readonly master = Buffer.from(env().ENCRYPTION_MASTER_KEY, 'hex');
  private readonly fileKey = Buffer.from(hkdfSync('sha256', this.master, 'brokeriq', 'brokeriq-media-v1', 32));
  private readonly tokenKey = Buffer.from(hkdfSync('sha256', this.master, 'brokeriq', 'brokeriq-media-token-v1', 32));

  get enabled() {
    return !!this.root;
  }

  /** Same contract as the S3 branch of MediaService.sign: client PUTs the bytes, then uses publicUrl. */
  presign(kind: UploadKind, contentType: string, ownerId: string) {
    const key = this.newKey(kind, ownerId);
    const claims: UploadClaims = { key, ct: contentType, max: maxBytesFor(contentType), exp: Date.now() + 10 * 60_000 };
    const api = apiBase();
    return {
      provider: 'local' as const,
      method: 'PUT' as const,
      uploadUrl: `${api}/api/media/upload/${this.signToken(claims)}`,
      headers: { 'Content-Type': contentType },
      publicUrl: `${api}/api/media/f/${key}`,
      key,
      maxBytes: claims.max,
    };
  }

  verifyToken(token: string): UploadClaims {
    const [body, sig] = token.split('.');
    if (!body || !sig) throw new BadRequestException('Invalid upload token');
    const expected = createHmac('sha256', this.tokenKey).update(body).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new BadRequestException('Invalid upload token');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UploadClaims;
    if (claims.exp < Date.now()) throw new BadRequestException('Upload link expired, please retry');
    if (!KEY_RE.test(claims.key)) throw new BadRequestException('Invalid upload token');
    return claims;
  }

  /** Compress + encrypt + atomically write. Returns the stored (possibly converted) content type. */
  async store(key: string, contentType: string, data: Buffer): Promise<string> {
    if (!data.length) throw new BadRequestException('Empty file');
    let ct = contentType.toLowerCase();
    let body: Buffer = data;
    let flags = 0;

    if (isRasterImage(ct)) {
      // rotate() applies EXIF orientation; sharp drops EXIF/GPS metadata by default.
      const webp = await sharp(data, { failOn: 'none' })
        .rotate()
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
        .catch(() => null);
      if (webp) {
        body = webp;
        ct = 'image/webp';
      }
    } else if (!ct.startsWith('video/') && !ct.startsWith('audio/')) {
      const packed = await brotli(data, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9, [zlib.BROTLI_PARAM_SIZE_HINT]: data.length } });
      if (packed.length < data.length * 0.95) {
        body = packed;
        flags |= FLAG_BROTLI;
      }
    }

    const ctBuf = Buffer.from(ct.slice(0, 255), 'utf8');
    const prefix = Buffer.concat([MAGIC, Buffer.from([flags, ctBuf.length]), ctBuf]);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.fileKey, iv);
    cipher.setAAD(prefix);
    const enc = Buffer.concat([cipher.update(body), cipher.final()]);
    const out = Buffer.concat([prefix, iv, cipher.getAuthTag(), enc]);

    const path = this.pathFor(key);
    await fs.mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, out, { mode: 0o600 });
    await fs.rename(tmp, path);
    return ct;
  }

  /** Decrypt + decompress; optionally downscale a stored image to one of RESIZE_WIDTHS. */
  async read(key: string, width?: number): Promise<{ contentType: string; body: Buffer }> {
    if (!KEY_RE.test(key)) throw new NotFoundException();
    const raw = await fs.readFile(this.pathFor(key)).catch(() => null);
    if (!raw || raw.length < 6 || !raw.subarray(0, 4).equals(MAGIC)) throw new NotFoundException();
    const flags = raw[4];
    const ctLen = raw[5];
    const prefixLen = 6 + ctLen;
    const contentType = raw.subarray(6, prefixLen).toString('utf8');
    const iv = raw.subarray(prefixLen, prefixLen + 12);
    const tag = raw.subarray(prefixLen + 12, prefixLen + 28);
    const decipher = createDecipheriv('aes-256-gcm', this.fileKey, iv);
    decipher.setAAD(raw.subarray(0, prefixLen));
    decipher.setAuthTag(tag);
    let body: Buffer = Buffer.concat([decipher.update(raw.subarray(prefixLen + 28)), decipher.final()]);
    if (flags & FLAG_BROTLI) body = await unbrotli(body);

    if (width && contentType === 'image/webp') {
      body = await sharp(body).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    }
    return { contentType, body };
  }

  /** Server-side upload of a base64 data URL (AI listing scanner). */
  async putDataUrl(dataUrl: string, kind: UploadKind, ownerId: string): Promise<string> {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) throw new BadRequestException('Invalid image');
    const data = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    if (data.length > maxBytesFor(m[1])) throw new PayloadTooLargeException('File too large');
    const key = this.newKey(kind, ownerId);
    await this.store(key, m[1], data);
    return `${apiBase()}/api/media/f/${key}`;
  }

  isPrivate(key: string) {
    return PRIVATE_KINDS.includes(key.split('/')[0] as UploadKind);
  }

  private newKey(kind: UploadKind, ownerId: string) {
    const owner = ownerId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'anon';
    const d = new Date();
    const month = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return `${kind}/${owner}/${month}/${shortCode(20).padEnd(20, '0')}`;
  }

  private pathFor(key: string) {
    return join(this.root!, key);
  }

  private signToken(claims: UploadClaims) {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${body}.${createHmac('sha256', this.tokenKey).update(body).digest('base64url')}`;
  }
}

function apiBase() {
  return env().PUBLIC_API_URL.replace(/\/$/, '');
}

function isRasterImage(ct: string) {
  return ct.startsWith('image/') && !['image/gif', 'image/svg+xml'].includes(ct);
}

export function maxBytesFor(ct: string) {
  if (ct.startsWith('video/')) return 100 * MB;
  if (ct.startsWith('image/')) return 20 * MB;
  return 25 * MB;
}
