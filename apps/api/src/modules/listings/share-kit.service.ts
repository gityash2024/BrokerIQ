import { existsSync } from 'fs';
import { join } from 'path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import QRCode from 'qrcode';
import opentype from 'opentype.js';
import { FURNISHING_LABELS, PROPERTY_TYPE_LABELS, formatINR } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { shortCode } from '../../common/utils';
import { env } from '../../config/env';

type Format = 'post' | 'story';
const SIZES: Record<Format, { w: number; h: number; photoH: number }> = { post: { w: 1080, h: 1080, photoH: 700 }, story: { w: 1080, h: 1920, photoH: 1180 } };

/** Finds the bundled fonts from both src (ts-node/jest) and dist (production) layouts. */
function fontDir() {
  const candidates = [
    join(__dirname, '../../../assets/fonts'),
    join(__dirname, '../../../../assets/fonts'),
    join(process.cwd(), 'assets/fonts'),
    join(process.cwd(), 'apps/api/assets/fonts'),
  ];
  return candidates.find((d) => existsSync(join(d, 'Inter_700Bold.ttf'))) ?? candidates[0];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Share kit: ready-to-post WhatsApp / Instagram images for a listing with a tracked short link + QR.
 * Text is rendered as vector paths from the bundled Inter font, so it looks identical on any server
 * (no system fonts needed).
 */
@Injectable()
export class ShareKitService {
  private readonly logger = new Logger(ShareKitService.name);
  private fonts?: { bold: opentype.Font; medium: opentype.Font };
  private cache = new Map<string, { at: number; png: Buffer }>();

  constructor(private readonly prisma: PrismaService) {}

  private font() {
    if (!this.fonts) {
      const dir = fontDir();
      this.fonts = { bold: opentype.loadSync(join(dir, 'Inter_700Bold.ttf')), medium: opentype.loadSync(join(dir, 'Inter_500Medium.ttf')) };
    }
    return this.fonts;
  }

  /** Creates a tracked link for a listing (optionally tied to a lead) and returns caption + image URLs. */
  async create(orgId: string, userId: string, listingId: string, leadId?: string | null) {
    const l = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId: orgId, deletedAt: null },
      include: { locality: { select: { name: true } }, organization: { select: { name: true, phone: true, whatsapp: true } } },
    });
    if (!l) throw new NotFoundException('Listing नहीं मिली');
    if (l.status !== 'ACTIVE') throw new BadRequestException('Share kit सिर्फ़ live listing के लिए बनता है');
    if (leadId && !(await this.prisma.lead.findFirst({ where: { id: leadId, organizationId: orgId }, select: { id: true } })))
      throw new BadRequestException('Lead नहीं मिली');
    const code = shortCode(8);
    await this.prisma.shareLink.create({ data: { code, organizationId: orgId, listingId, leadId: leadId ?? null, createdById: userId } });
    const web = env().PUBLIC_WEB_URL.replace(/\/$/, '');
    const api = env().PUBLIC_API_URL.replace(/\/$/, '');
    const link = `${web}/s/${code}`;
    const lines = [
      `🏠 ${l.title}`,
      `💰 ${formatINR(l.price)}/month${l.securityDeposit ? ` · Deposit ${formatINR(l.securityDeposit)}` : ''}`,
      [l.bedrooms ? `${l.bedrooms} BHK` : null, l.furnishing ? FURNISHING_LABELS[l.furnishing] : null, l.superArea ? `${l.superArea} sqft` : null]
        .filter(Boolean)
        .join(' · '),
      `📍 ${[l.societyName, l.locality.name, 'Gurgaon'].filter(Boolean).join(', ')}`,
      l.organization
        ? `📞 ${l.organization.name}${l.organization.whatsapp || l.organization.phone ? ` — ${l.organization.whatsapp ?? l.organization.phone}` : ''}`
        : null,
      `👉 Photos और details: ${link}`,
    ].filter(Boolean);
    return {
      code,
      link,
      caption: lines.join('\n'),
      images: { post: `${api}/api/public/share-kit/${code}?format=post`, story: `${api}/api/public/share-kit/${code}?format=story` },
    };
  }

  /** Renders the PNG for a share link (public: the listing itself is public). */
  async render(code: string, format: Format): Promise<Buffer> {
    const key = `${code}:${format}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.png;
    const link = await this.prisma.shareLink.findUnique({
      where: { code },
      include: { listing: { include: { locality: { select: { name: true } }, organization: { select: { name: true, logoUrl: true } } } } },
    });
    if (!link?.listing || link.listing.deletedAt) throw new NotFoundException();
    const l = link.listing;
    const { w, h, photoH } = SIZES[format];
    const f = this.font();
    const url = `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/s/${code}`;

    const photo = l.coverUrl ? await this.fetchImage(l.coverUrl, w, photoH) : null;
    const qrSize = format === 'story' ? 300 : 230;
    const qr = await QRCode.toBuffer(url, { width: qrSize, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } });

    const pad = 60;
    // Story: QR sits below the text, so text gets the full width; post: QR is beside it.
    const textW = format === 'story' ? w - pad * 2 : w - pad * 2 - qrSize - 40;
    const nameW = w - pad * 2 - qrSize - 40;
    const big = format === 'story' ? 92 : 70;
    const mid = format === 'story' ? 44 : 34;
    const small = format === 'story' ? 34 : 28;
    const y0 = photoH + (format === 'story' ? 150 : 110);
    const facts = [
      l.bedrooms ? `${l.bedrooms} BHK` : PROPERTY_TYPE_LABELS[l.propertyType],
      l.furnishing ? FURNISHING_LABELS[l.furnishing] : null,
      l.superArea ? `${l.superArea} sqft` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const place = [l.societyName, l.locality.name].filter(Boolean).join(', ');
    const paths = [
      this.path(f.bold, `${formatINR(l.price)}/month`, pad, y0, big, textW, '#FFFFFF'),
      this.path(f.medium, facts, pad, y0 + big * 0.95, mid, textW, '#E2E8F0'),
      this.path(f.medium, `${place}, Gurgaon`, pad, y0 + big * 0.95 + mid * 1.45, mid, textW, '#E2E8F0'),
      l.organization ? this.path(f.bold, l.organization.name, pad, h - pad - (format === 'story' ? 40 : 10), small, nameW, '#A5B4FC') : '',
      this.path(f.bold, 'FOR RENT', pad + 26, 94, 30, 400, '#0F172A'),
      this.path(f.medium, 'Scan for photos', w - pad - qrSize, h - pad + 4 - (format === 'story' ? 30 : 0), 22, qrSize, '#CBD5E1'),
    ].join('');
    const rentPillW = Math.ceil(f.bold.getAdvanceWidth('FOR RENT', 30)) + 52;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E1B4B"/><stop offset="1" stop-color="#0F172A"/></linearGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#0F172A" stop-opacity="0"/><stop offset="1" stop-color="#0F172A" stop-opacity="0.85"/></linearGradient></defs>
      ${photo ? '' : `<rect width="${w}" height="${photoH}" fill="#4F46E5"/>`}
      <rect y="0" width="${w}" height="${photoH}" fill="url(#fade)"/>
      <rect y="${photoH}" width="${w}" height="${h - photoH}" fill="url(#g)"/>
      <rect x="${pad}" y="52" rx="26" ry="26" width="${rentPillW}" height="56" fill="#F59E0B"/>
      <rect x="${w - pad - qrSize - 12}" y="${h - pad - qrSize - 12 - (format === 'story' ? 60 : 30)}" width="${qrSize + 24}" height="${qrSize + 24}" rx="20" fill="#FFFFFF"/>
      ${paths}
    </svg>`;
    const layers: sharp.OverlayOptions[] = [];
    if (photo) layers.push({ input: photo, top: 0, left: 0 });
    layers.push({ input: Buffer.from(svg), top: 0, left: 0 });
    layers.push({ input: qr, top: h - pad - qrSize - (format === 'story' ? 60 : 30), left: w - pad - qrSize });
    const png = await sharp({ create: { width: w, height: h, channels: 4, background: '#0F172A' } })
      .composite(layers)
      .png({ compressionLevel: 8 })
      .toBuffer();
    this.cache.set(key, { at: Date.now(), png });
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
    return png;
  }

  /** Single-line text as an SVG path, shrunk with an ellipsis to fit maxWidth. */
  private path(font: opentype.Font, text: string, x: number, y: number, size: number, maxWidth: number, fill: string) {
    let t = text;
    while (t.length > 1 && font.getAdvanceWidth(t, size) > maxWidth) t = `${t.slice(0, -2).trimEnd()}…`;
    return `<path d="${esc(font.getPath(t, x, y, size).toPathData(2))}" fill="${fill}"/>`;
  }

  private async fetchImage(src: string, w: number, h: number): Promise<Buffer | null> {
    try {
      const url = src.startsWith('http') ? src : `${env().PUBLIC_API_URL.replace(/\/$/, '')}${src.startsWith('/') ? '' : '/'}${src}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      return await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(w, h, { fit: 'cover' })
        .toBuffer();
    } catch (e) {
      this.logger.warn(`share-kit photo ${src}: ${(e as Error).message}`);
      return null;
    }
  }
}
