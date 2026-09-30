import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FURNISHING_LABELS, PROPERTY_TYPE_LABELS } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { randomToken } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { pdfMoney, pdfText, renderPdf } from '../../common/pdf';
import { env } from '../../config/env';

const api = () => env().PUBLIC_API_URL.replace(/\/$/, '');
const web = () => env().PUBLIC_WEB_URL.replace(/\/$/, '');

/** Branded side-by-side PDF of 2–5 listings that a broker sends to a client (public via an unguessable token). */
@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: LocalStorageService,
  ) {}

  async create(user: RequestUser, orgId: string, listingIds: string[], leadId?: string | null) {
    const ids = [...new Set(listingIds)];
    if (ids.length < 2) throw new BadRequestException('कम से कम 2 अलग properties चुनें');
    const found = await this.prisma.listing.count({ where: { id: { in: ids }, status: 'ACTIVE', deletedAt: null } });
    if (found !== ids.length) throw new BadRequestException('कुछ properties अब live नहीं हैं — दोबारा चुनें');
    if (leadId && !(await this.prisma.lead.findFirst({ where: { id: leadId, organizationId: orgId, deletedAt: null }, select: { id: true } })))
      throw new NotFoundException('Lead नहीं मिली');
    const c = await this.prisma.comparison.create({
      data: { organizationId: orgId, leadId: leadId ?? null, createdById: user.id, listingIds: ids, token: randomToken(18) },
    });
    if (leadId)
      await this.prisma.activity.create({
        data: { organizationId: orgId, leadId, userId: user.id, type: 'PROPERTY_SHARED', content: `📊 ${ids.length} properties की comparison PDF बनाई` },
      });
    return { id: c.id, token: c.token, pdfUrl: `${api()}/api/public/comparisons/${c.token}/pdf` };
  }

  list(orgId: string, leadId?: string) {
    return this.prisma.comparison.findMany({ where: { organizationId: orgId, ...(leadId ? { leadId } : {}) }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  private async photo(url: string | null): Promise<Buffer | null> {
    if (!url) return null;
    try {
      // Own media store: read directly (no HTTP round trip); anything else: fetch a small version.
      const m = /\/api\/media\/f\/(.+?)(\?|$)/.exec(url);
      if (m && this.store.enabled) {
        const { body } = await this.store.read(m[1], 480);
        return body;
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }

  async pdf(token: string): Promise<Buffer> {
    const c = await this.prisma.comparison.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true, phone: true, whatsapp: true, email: true, reraNumber: true, slug: true } },
        lead: { select: { name: true } },
      },
    });
    if (!c) throw new NotFoundException();
    await this.prisma.comparison.update({ where: { id: c.id }, data: { opens: { increment: 1 } } });
    const rows = await this.prisma.listing.findMany({
      where: { id: { in: c.listingIds }, deletedAt: null },
      include: { locality: { select: { name: true } } },
    });
    const listings = c.listingIds.map((id) => rows.find((r) => r.id === id)).filter((l): l is (typeof rows)[number] => !!l);
    // PDF images must be JPEG/PNG; the media store serves WebP.
    const sharp = (await import('sharp')).default;
    const photos = await Promise.all(
      listings.map(async (l) => {
        const raw = await this.photo(l.coverUrl);
        return raw
          ? sharp(raw)
              .resize(480, 320, { fit: 'cover' })
              .jpeg({ quality: 80 })
              .toBuffer()
              .catch(() => null)
          : null;
      }),
    );
    const org = c.organization;
    return renderPdf(
      (doc) => {
        const left = doc.page.margins.left;
        const width = doc.page.width - left - doc.page.margins.right;
        doc
          .font('B')
          .fontSize(18)
          .fillColor('#4F46E5')
          .text(pdfText(org.name) || 'BrokerIQ');
        doc.font('R').fontSize(9).fillColor('#475569');
        doc.text([org.phone ?? org.whatsapp, org.email, org.reraNumber ? `RERA ${org.reraNumber}` : null].filter(Boolean).join('  |  '));
        doc.moveDown(0.6).font('B').fontSize(13).fillColor('#0f172a').text('Property comparison');
        doc
          .font('R')
          .fontSize(9)
          .fillColor('#475569')
          .text(
            `${c.lead ? `Prepared for ${pdfText(c.lead.name)}  |  ` : ''}${c.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          );
        doc.moveDown(0.8);

        const labelW = 120;
        const colW = (width - labelW) / listings.length;
        // Photos
        const top = doc.y;
        listings.forEach((_, i) => {
          const x = left + labelW + i * colW + 4;
          const img = photos[i];
          if (img) doc.image(img, x, top, { fit: [colW - 8, (colW - 8) * 0.66], align: 'center' });
          else doc.rect(x, top, colW - 8, (colW - 8) * 0.66).fill('#E2E8F0');
        });
        doc.y = top + (colW - 8) * 0.66 + 8;
        const specs: [string, (l: (typeof listings)[number]) => string][] = [
          ['Property', (l) => pdfText(l.title)],
          ['Location', (l) => pdfText([l.societyName, l.locality.name].filter(Boolean).join(', '))],
          ['Rent / month', (l) => pdfMoney(l.price) + (l.priceNegotiable ? ' (negotiable)' : '')],
          ['Deposit', (l) => pdfMoney(l.securityDeposit)],
          ['Maintenance', (l) => (l.maintenance ? pdfMoney(l.maintenance) : 'Included / -')],
          ['Type', (l) => `${l.bedrooms ? `${l.bedrooms} BHK ` : ''}${PROPERTY_TYPE_LABELS[l.propertyType] ?? l.propertyType}`],
          ['Area', (l) => (l.superArea || l.carpetArea || l.builtUpArea ? `${l.superArea ?? l.builtUpArea ?? l.carpetArea} sq ft` : '-')],
          ['Furnishing', (l) => (l.furnishing ? FURNISHING_LABELS[l.furnishing] : '-')],
          ['Floor', (l) => (l.floor != null ? `${l.floor}${l.totalFloors ? ` of ${l.totalFloors}` : ''}` : '-')],
          ['Bathrooms', (l) => (l.bathrooms != null ? String(l.bathrooms) : '-')],
          ['Parking', (l) => (l.parking != null ? String(l.parking) : '-')],
          ['Available from', (l) => (l.availableFrom ? l.availableFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Immediately')],
          ['Amenities', (l) => (l.amenities.length ? pdfText(l.amenities.slice(0, 8).join(', ')) : '-')],
          ['Ref', (l) => `#${l.refNo}`],
        ];
        specs.forEach(([label, get], r) => {
          const cells = listings.map(get);
          doc.fontSize(8.5);
          const h = Math.max(doc.heightOfString(label, { width: labelW - 8 }), ...cells.map((t) => doc.heightOfString(t, { width: colW - 8 }))) + 8;
          if (doc.y + h > doc.page.height - doc.page.margins.bottom - 30) doc.addPage();
          const y = doc.y;
          if (r % 2 === 0) doc.rect(left, y, width, h).fill('#F8FAFC');
          doc
            .font('B')
            .fillColor('#334155')
            .text(label, left + 4, y + 4, { width: labelW - 8 });
          cells.forEach((t, i) =>
            doc
              .font(r === 2 ? 'B' : 'R')
              .fillColor('#0f172a')
              .text(t, left + labelW + i * colW + 4, y + 4, { width: colW - 8 }),
          );
          doc.x = left;
          doc.y = y + h;
        });
        doc.moveDown(0.8);
        listings.forEach((l, i) =>
          doc
            .font('R')
            .fontSize(8)
            .fillColor('#4F46E5')
            .text(`${i + 1}. ${pdfText(l.title)}: ${web()}/property/${l.slug}`, { link: `${web()}/property/${l.slug}`, underline: false }),
        );
        doc
          .moveDown(1)
          .font('R')
          .fontSize(7.5)
          .fillColor('#94a3b8')
          .text(`Prices and availability as listed on ${c.createdAt.toLocaleDateString('en-IN')}; please confirm before visiting. Generated with BrokerIQ.`);
      },
      { layout: listings.length > 3 ? 'landscape' : 'portrait' },
    );
  }
}
