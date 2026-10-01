import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { comparisonSchema, photoBrandingSchema } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CurrentUser, Feature, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg, signId, verifySignedId } from '../../common/utils';
import { env } from '../../config/env';
import { PhotoBrandingService } from '../media/photo-branding.service';
import { SocialService } from './social.service';
import { ComparisonService } from './comparison.service';
import { ReportsService, type ReportKind } from './reports.service';
import { OwnerReportService } from './owner-report.service';

const brandingSchema = z.object({ photoBranding: photoBrandingSchema.optional(), socialAutoPost: z.boolean().optional() });
const weeklySchema = z.object({ on: z.boolean() });

const REPORT_KINDS = ['deals', 'invoices', 'gst', 'agents'] as const satisfies readonly ReportKind[];
const reportLinkSchema = z.object({
  format: z.enum(['csv', 'pdf']),
  type: z.enum(REPORT_KINDS).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
interface ReportDownload {
  o: string;
  f: 'csv' | 'pdf';
  k?: string;
  from?: string;
  to?: string;
  e?: number;
}

/** Broker growth tools: photo branding, social auto-post, comparison PDF, reports, owner report links. */
@ApiTags('broker-tools')
@Controller()
export class GrowthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branding: PhotoBrandingService,
    private readonly social: SocialService,
    private readonly comparisons: ComparisonService,
    private readonly reports: ReportsService,
    private readonly owners: OwnerReportService,
  ) {}

  // ------------------------------------------------------------------ branding & social
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/branding')
  async getBranding(@CurrentUser() user: RequestUser) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: requireOrg(user) },
      select: { name: true, photoBranding: true, socialAutoPost: true },
    });
    return { firm: org.name, photoBranding: photoBrandingSchema.parse(org.photoBranding ?? {}), socialAutoPost: org.socialAutoPost };
  }

  @Roles('BROKER_ADMIN')
  @Put('broker/branding')
  async setBranding(@CurrentUser() user: RequestUser, @Body(new ZodPipe(brandingSchema)) body: z.infer<typeof brandingSchema>) {
    const orgId = requireOrg(user);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(body.photoBranding ? { photoBranding: body.photoBranding } : {}),
        ...(body.socialAutoPost !== undefined ? { socialAutoPost: body.socialAutoPost } : {}),
      },
    });
    this.branding.invalidate(orgId);
    await this.audit.log(user, 'broker.branding.update', 'Organization', orgId, body);
    return this.getBranding(user);
  }

  @Feature('social_autopost')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/social-posts')
  socialPosts(@CurrentUser() user: RequestUser) {
    return this.social.list(requireOrg(user));
  }

  @Feature('social_autopost')
  @Roles('BROKER_ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post('broker/listings/:id/social-post')
  postNow(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.social.post(id, requireOrg(user));
  }

  // ------------------------------------------------------------------ comparison PDF
  @Feature('comparison_pdf')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('broker/comparisons')
  compare(@CurrentUser() user: RequestUser, @Body(new ZodPipe(comparisonSchema)) body: z.infer<typeof comparisonSchema>) {
    return this.comparisons.create(user, requireOrg(user), body.listingIds, body.leadId);
  }

  @Feature('comparison_pdf')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/comparisons')
  comparisonsList(@CurrentUser() user: RequestUser, @Query('leadId') leadId?: string) {
    return this.comparisons.list(requireOrg(user), leadId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/comparisons/:token/pdf')
  async comparisonPdf(@Param('token') token: string, @Res() res: Response) {
    const pdf = await this.comparisons.pdf(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="property-comparison.pdf"');
    res.send(pdf);
  }

  // ------------------------------------------------------------------ reports
  @Feature('broker_reports')
  @Roles('BROKER_ADMIN')
  @Get('broker/reports')
  summary(@CurrentUser() user: RequestUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.summary(requireOrg(user), from, to);
  }

  @Feature('broker_reports')
  @Roles('BROKER_ADMIN')
  @Get('broker/reports/export.csv')
  exportCsv(
    @CurrentUser() user: RequestUser,
    @Query('type') type: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    return this.sendReport(res, { o: requireOrg(user), f: 'csv', k: type, from, to });
  }

  @Feature('broker_reports')
  @Roles('BROKER_ADMIN')
  @Get('broker/reports/export.pdf')
  exportPdf(@CurrentUser() user: RequestUser, @Query('from') from: string | undefined, @Query('to') to: string | undefined, @Res() res: Response) {
    return this.sendReport(res, { o: requireOrg(user), f: 'pdf', from, to });
  }

  /** Short-lived signed link (10 min) so the mobile app can open a download in the browser without its auth header. */
  @Feature('broker_reports')
  @Roles('BROKER_ADMIN')
  @Post('broker/reports/download-link')
  downloadLink(@CurrentUser() user: RequestUser, @Body(new ZodPipe(reportLinkSchema)) b: z.infer<typeof reportLinkSchema>) {
    const payload: ReportDownload = { o: requireOrg(user), f: b.format, k: b.type, from: b.from, to: b.to, e: Date.now() + 10 * 60_000 };
    const token = signId('report-download', Buffer.from(JSON.stringify(payload)).toString('base64url'));
    return { url: `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/public/reports/download/${token}` };
  }

  @Public()
  @Feature('broker_reports')
  @Get('public/reports/download/:token')
  download(@Param('token') token: string, @Res() res: Response) {
    const raw = verifySignedId('report-download', token);
    const p = raw ? (JSON.parse(Buffer.from(raw, 'base64url').toString()) as ReportDownload) : null;
    if (!p || !p.e || p.e < Date.now()) throw new NotFoundException('Link expire हो गया — app से दोबारा download करें');
    return this.sendReport(res, p);
  }

  private async sendReport(res: Response, p: ReportDownload) {
    if (p.f === 'pdf') {
      const pdf = await this.reports.pdf(p.o, p.from, p.to);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="business-report.pdf"');
      return res.send(pdf);
    }
    const kind = REPORT_KINDS.find((k) => k === p.k) ?? 'deals';
    const out = await this.reports.csv(p.o, kind, p.from, p.to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.name}"`);
    return res.send(out.body);
  }

  // ------------------------------------------------------------------ owner report links
  @Feature('owner_reports')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('broker/owners/:id/report-link')
  ownerLink(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.owners.createLink(requireOrg(user), id);
  }

  @Feature('owner_reports')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Delete('broker/owners/:id/report-link')
  ownerRevoke(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.owners.revoke(requireOrg(user), id);
  }

  @Feature('owner_reports')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Put('broker/owners/:id/weekly-report')
  ownerWeekly(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(weeklySchema)) body: z.infer<typeof weeklySchema>) {
    return this.owners.setWeekly(requireOrg(user), id, body.on);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('public/owner-report/:token')
  ownerView(@Param('token') token: string) {
    return this.owners.view(token);
  }
}
