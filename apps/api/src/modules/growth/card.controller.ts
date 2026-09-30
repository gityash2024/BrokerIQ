import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { Feature, Public } from '../../common/decorators';
import { LISTING_CARD_SELECT } from '../listings/listings.service';
import { env } from '../../config/env';

const vcfEscape = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');

/** Digital visiting card of a firm, or of one agent of the firm (?a=<userId>). */
@ApiTags('card')
@Feature('visiting_card')
@Controller('public/card')
export class CardController {
  constructor(private readonly prisma: PrismaService) {}

  private async load(slug: string, agentId?: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        logoUrl: true,
        coverUrl: true,
        about: true,
        phone: true,
        whatsapp: true,
        email: true,
        address: true,
        website: true,
        reraNumber: true,
        experienceYears: true,
        verification: true,
        rating: true,
        reviewCount: true,
        localities: { select: { name: true, slug: true }, take: 8 },
      },
    });
    if (!org || org.status !== 'ACTIVE') throw new NotFoundException('Card नहीं मिला');
    const agent = agentId
      ? await this.prisma.user.findFirst({
          where: { id: agentId, organizationId: org.id, status: 'ACTIVE', role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] } },
          select: { id: true, name: true, avatarUrl: true, phone: true, email: true, role: true },
        })
      : null;
    return { org, agent };
  }

  private url(slug: string, agentId?: string | null) {
    return `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/card/${slug}${agentId ? `?a=${encodeURIComponent(agentId)}` : ''}`;
  }

  @Public()
  @Get(':slug')
  async card(@Param('slug') slug: string, @Query('a') a?: string) {
    const { org, agent } = await this.load(slug, a);
    const [listings, liveCount] = await Promise.all([
      this.prisma.listing.findMany({
        where: { organizationId: org.id, status: 'ACTIVE', deletedAt: null, ...(agent ? { postedById: agent.id } : {}) },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: LISTING_CARD_SELECT,
      }),
      this.prisma.listing.count({ where: { organizationId: org.id, status: 'ACTIVE', deletedAt: null } }),
    ]);
    const { status: _status, id: _id, ...publicOrg } = org;
    return {
      org: publicOrg,
      agent: agent
        ? {
            id: agent.id,
            name: agent.name,
            avatarUrl: agent.avatarUrl,
            phone: agent.phone,
            email: agent.email,
            title: agent.role === 'BROKER_ADMIN' ? 'Owner' : 'Property consultant',
          }
        : null,
      listings,
      liveCount,
      url: this.url(org.slug, agent?.id),
    };
  }

  /** Saves the contact to the phone's address book. */
  @Public()
  @Get(':slug/vcf')
  async vcf(@Param('slug') slug: string, @Query('a') a: string | undefined, @Res() res: Response) {
    const { org, agent } = await this.load(slug, a);
    const phone = agent?.phone ?? org.phone ?? org.whatsapp;
    const email = agent?.email ?? org.email;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${vcfEscape(agent?.name ?? org.name)}`,
      `ORG:${vcfEscape(org.name)}`,
      agent ? `TITLE:${agent.role === 'BROKER_ADMIN' ? 'Owner' : 'Property consultant'}` : null,
      phone ? `TEL;TYPE=CELL:${phone}` : null,
      org.whatsapp && org.whatsapp !== phone ? `TEL;TYPE=WORK:${org.whatsapp}` : null,
      email ? `EMAIL:${email}` : null,
      org.address ? `ADR;TYPE=WORK:;;${vcfEscape(org.address)};Gurugram;Haryana;;India` : null,
      `URL:${this.url(org.slug, agent?.id)}`,
      org.reraNumber ? `NOTE:RERA ${vcfEscape(org.reraNumber)}` : null,
      'END:VCARD',
    ].filter(Boolean);
    const name = (agent?.name ?? org.name).replace(/[^\w-]+/g, '-').slice(0, 40) || 'contact';
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.vcf"`);
    res.send(lines.join('\r\n') + '\r\n');
  }

  @Public()
  @Get(':slug/qr')
  async qr(@Param('slug') slug: string, @Query('a') a: string | undefined, @Res() res: Response) {
    const { org, agent } = await this.load(slug, a);
    const png = await QRCode.toBuffer(this.url(org.slug, agent?.id), { width: 600, margin: 1, color: { dark: '#1e1b4b' } });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  }
}
