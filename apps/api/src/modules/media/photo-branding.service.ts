import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { photoBrandingSchema, type PhotoBranding } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { FeaturesService } from '../../core/features/features.service';

const CACHE_MS = 60_000;
const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

/**
 * Firm branding for listing photos (free, done on our own server with sharp):
 * auto-enhance (levels, colour, sharpness) and a text watermark with the firm's name.
 * Applied once at upload time, so every copy of the photo — site, share kit, portals — carries it.
 */
@Injectable()
export class PhotoBrandingService {
  private readonly logger = new Logger(PhotoBrandingService.name);
  private cache = new Map<string, { at: number; value: (PhotoBranding & { firm: string }) | null }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeaturesService,
  ) {}

  invalidate(orgId: string) {
    this.cache.delete(orgId);
  }

  private async settingsFor(orgId: string) {
    const hit = this.cache.get(orgId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, photoBranding: true } });
    const parsed = org?.photoBranding ? photoBrandingSchema.safeParse(org.photoBranding) : null;
    const value = org && parsed?.success && (parsed.data.watermark || parsed.data.enhance) ? { ...parsed.data, firm: org.name } : null;
    this.cache.set(orgId, { at: Date.now(), value });
    return value;
  }

  /** Returns the branded image for listing photo uploads, or the original bytes when nothing applies. */
  async apply(key: string, contentType: string, data: Buffer): Promise<Buffer> {
    const [kind, owner] = key.split('/');
    if (kind !== 'listing' || !/^image\/(jpe?g|png|webp|heic|heif|avif)$/i.test(contentType)) return data;
    if (!(await this.features.isEnabled('photo_branding'))) return data;
    const cfg = await this.settingsFor(owner);
    if (!cfg) return data;
    try {
      return await this.render(data, cfg);
    } catch (e) {
      this.logger.warn(`branding skipped for ${key}: ${(e as Error).message}`);
      return data;
    }
  }

  async render(data: Buffer, cfg: PhotoBranding & { firm: string }): Promise<Buffer> {
    let img = sharp(data, { failOn: 'none' }).rotate();
    if (cfg.enhance) img = img.normalise({ lower: 1, upper: 99 }).modulate({ saturation: 1.12, brightness: 1.02 }).sharpen({ sigma: 0.8 });
    const base = await img.jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
    if (!cfg.watermark) return base.data;

    const { width, height } = base.info;
    const text = (cfg.text?.trim() || cfg.firm).slice(0, 60);
    const size = Math.max(14, Math.round(Math.min(width, height) * 0.045));
    const pad = Math.round(size * 0.6);
    const boxW = Math.min(width - 8, Math.round(text.length * size * 0.62) + pad * 2);
    const boxH = Math.round(size * 1.7);
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">` +
        `<rect width="100%" height="100%" rx="${Math.round(size * 0.35)}" fill="#000" fill-opacity="${(cfg.opacity * 0.55).toFixed(2)}"/>` +
        `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-weight="700" ` +
        `font-size="${size}" fill="#fff" fill-opacity="${Math.min(1, cfg.opacity + 0.35).toFixed(2)}">${xml(text)}</text></svg>`,
    );
    const margin = Math.round(size * 0.8);
    const placement =
      cfg.position === 'center'
        ? { gravity: 'center' }
        : {
            left: cfg.position.endsWith('l') ? margin : Math.max(0, width - boxW - margin),
            top: cfg.position.startsWith('t') ? margin : Math.max(0, height - boxH - margin),
          };
    return sharp(base.data)
      .composite([{ input: svg, ...placement }])
      .jpeg({ quality: 92 })
      .toBuffer();
  }
}
