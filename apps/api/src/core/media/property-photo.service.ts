import { Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync } from 'node:crypto';
import sharp from 'sharp';
import { normalizePropertyCode } from '@brokeriq/shared';
import { env } from '../../config/env';
import { LocalStorageService } from './local-storage.service';

const renditionPath = '/api/media/property-photo/';
const localKey = /^\/api\/media\/f\/(listing\/[A-Za-z0-9_-]{1,64}\/\d{6}\/[A-Za-z0-9]{20})$/;
const maxSourceBytes = 20 * 1024 * 1024;
const xml = (value: string) => value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);

type Photo = { url: string; code: string; firm: string };

export async function renderPropertyPhoto(source: Buffer, code: string, firm: string): Promise<Buffer> {
  const { data, info } = await sharp(source, { limitInputPixels: 36_000_000 })
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const bandHeight = Math.max(1, Math.min(Math.round(height * 0.07), Math.round(width * 0.045)));
  const fontSize = Math.max(1, Math.round(bandHeight * 0.63));
  const padding = Math.round(bandHeight * 0.43);
  const maxFirmChars = Math.max(10, Math.floor((width * 0.64 - padding) / (fontSize * 0.65)));
  const firmChars = Array.from(firm);
  const label = firmChars.length > maxFirmChars ? firmChars.slice(0, maxFirmChars - 1).join('') + '…' : firm;
  const footer = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bandHeight}">
      <rect width="100%" height="100%" fill="#0b1220" fill-opacity=".78"/>
      <g fill="#fff" font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="bold">
        <text x="${padding}" y="${bandHeight * 0.72}">${xml(code)}</text>
        <text x="${width - padding}" y="${bandHeight * 0.72}" text-anchor="end">${xml(label)}</text>
      </g>
    </svg>`,
  );
  return sharp(data)
    .composite([{ input: footer, top: height - bandHeight, left: 0 }])
    .webp({ quality: 87 })
    .toBuffer();
}

@Injectable()
export class PropertyPhotoService {
  private readonly master = Buffer.from(env().ENCRYPTION_MASTER_KEY, 'hex');
  private readonly encryptionKey = Buffer.from(hkdfSync('sha256', this.master, 'brokeriq', 'property-photo-encryption-v1', 32));
  private readonly nonceKey = Buffer.from(hkdfSync('sha256', this.master, 'brokeriq', 'property-photo-nonce-v1', 32));
  private readonly active = new Map<string, Promise<Buffer>>();
  private readonly origin = new URL(env().PUBLIC_API_URL).origin;
  private readonly api = env().PUBLIC_API_URL.replace(/\/$/, '');

  constructor(private readonly storage: LocalStorageService) {}

  private readToken(token: string): Photo {
    try {
      if (!/^[A-Za-z0-9_-]{35,3800}$/.test(token)) throw new Error();
      const data = Buffer.from(token, 'base64url');
      const cipher = createDecipheriv('aes-256-gcm', this.encryptionKey, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString()) as Photo;
    } catch {
      throw new NotFoundException('Property photo not found');
    }
  }

  /** Editing preserves the stored source URL when a client submits the displayed rendition. */
  source(url: string, propertyCode?: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return url;
    }
    if (parsed.origin !== this.origin || !parsed.pathname.startsWith(renditionPath)) return url;
    const photo = this.readToken(parsed.pathname.slice(renditionPath.length));
    if (propertyCode && photo.code !== propertyCode) throw new NotFoundException('Property photo not found');
    return photo.url;
  }

  private sourceLocation(value: string) {
    const url = new URL(value);
    if (url.username || url.password || url.hash) throw new Error('Invalid photo URL');
    const key = url.origin === this.origin && localKey.exec(url.pathname)?.[1];
    if (key) return { key };
    if (url.protocol !== 'https:' || url.origin !== 'https://res.cloudinary.com' || !/^\/[\w-]+\/image\/upload\//.test(url.pathname))
      throw new Error('Unsupported property photo source');
    return { url };
  }

  url(value: string | null | undefined, code?: string, firm?: string | null) {
    if (!value || !normalizePropertyCode(code) || !this.storage.enabled) return value;
    try {
      const url = this.source(value, code);
      this.sourceLocation(url);
      const plain = Buffer.from(JSON.stringify({ url, code, firm: firm?.trim().slice(0, 100) || 'BrokerIQ' }));
      if (plain.length > 1350) return value;
      // A separate key derives a stable nonce from the complete plaintext. Identical inputs reuse the entire token.
      const nonce = createHmac('sha256', this.nonceKey).update(plain).digest().subarray(0, 12);
      const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
      const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
      const token = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
      return `${this.api}${renditionPath}${token}`;
    } catch {
      return value;
    }
  }

  inventory<T extends Record<string, any>>(item: T): T {
    const display = (url: string) => this.url(url, item.propertyCode, item.organization?.name) ?? url;
    return {
      ...item,
      ...(item.photoUrls && { photoUrls: item.photoUrls.map(display) }),
      ...(item.agentCoverPhotoUrl && { agentCoverPhotoUrl: display(item.agentCoverPhotoUrl) }),
    };
  }

  listing<
    T extends { propertyCode: string; coverUrl?: string | null; organization?: { name?: string | null } | null; media?: { url: string; kind: string }[] },
  >(item: T): T {
    const display = (url: string | null | undefined) => this.url(url, item.propertyCode, item.organization?.name);
    return {
      ...item,
      coverUrl: display(item.coverUrl),
      ...(item.media && { media: item.media.map((media) => (media.kind !== 'VIDEO' ? { ...media, url: display(media.url) } : media)) }),
    };
  }

  async warm(value: string, code: string, firm?: string | null): Promise<boolean> {
    const rendition = this.url(value, code, firm);
    const route = this.api + renditionPath;
    if (!rendition?.startsWith(route)) return false;
    await this.read(rendition.slice(route.length));
    return true;
  }

  async read(token: string, width?: number) {
    const photo = this.readToken(token);
    const digest = createHash('sha256').update('v1:').update(token).digest('hex');
    const key = `rendition/property/200001/${digest.slice(0, 20)}`;
    try {
      return (await this.storage.read(key, width)).body;
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    let render = this.active.get(key);
    if (!render) {
      if (this.active.size >= 12) throw new NotFoundException('Property photo is preparing. Retry shortly.');
      render = this.createRendition(key, photo).finally(() => this.active.delete(key));
      this.active.set(key, render);
    }
    const body = await render;
    return width ? sharp(body).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer() : body;
  }

  private async createRendition(key: string, photo: Photo) {
    const location = this.sourceLocation(photo.url);
    const source = location.key ? (await this.storage.read(location.key)).body : await this.fetchSource(location.url!);
    const result = await renderPropertyPhoto(source, photo.code, photo.firm);
    await this.storage.store(key, 'image/webp', result, true);
    return result;
  }

  private async fetchSource(url: URL) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('image/'))
      throw new NotFoundException('Property photo source unavailable');
    const parts: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxSourceBytes) throw new NotFoundException('Property photo source exceeds the image limit');
        parts.push(Buffer.from(value));
      }
      return Buffer.concat(parts);
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
}
