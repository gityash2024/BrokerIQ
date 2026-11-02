import { All, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConnectorsService } from './connectors.service';
import { IntegrationTesterService } from '../integrations/integration-tester.service';
import { AuditService } from '../../core/audit/audit.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';
import { parsePortalEmail } from './portal-parsers';
import { AccessService } from '../../core/access/access.service';
import { PrismaService } from '../../prisma/prisma.service';

const saveSchema = z.object({ enabled: z.boolean().optional(), fields: z.record(z.string(), z.unknown()).default({}) });

@ApiTags('connectors')
@Controller()
export class ConnectorsController {
  constructor(
    private readonly access: AccessService,
    private readonly connectors: ConnectorsService,
    private readonly tester: IntegrationTesterService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  private async targetFirm(orgId: string) {
    const firm = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, slug: true, status: true } });
    if (!firm) throw new NotFoundException('Firm not found');
    return firm;
  }

  @Roles('SUPER_ADMIN')
  @Get('admin/organizations/:orgId/connectors')
  async firmOverview(@Param('orgId') orgId: string) {
    const firm = await this.targetFirm(orgId);
    const { connectors, platformWhatsappFallback } = await this.connectors.overview(firm.id, true);
    return { firm, connectors, platformWhatsappFallback };
  }

  @Roles('SUPER_ADMIN')
  @Patch('admin/organizations/:orgId/connectors/:key')
  async saveFirmConnector(
    @CurrentUser() user: RequestUser,
    @Param('orgId') orgId: string,
    @Param('key') key: string,
    @Body(new ZodPipe(saveSchema)) body: z.infer<typeof saveSchema>,
  ) {
    await this.targetFirm(orgId);
    const result = await this.connectors.saveConnector(orgId, key, body, user.id);
    await this.audit.log({ ...user, orgId }, 'connector.update', 'Connector', key, {
      source: 'explicit-super-admin-firm',
      fields: Object.keys(body.fields ?? {}),
      enabled: body.enabled,
    });
    return result;
  }

  @Roles('SUPER_ADMIN')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('admin/organizations/:orgId/connectors/:key/test')
  async testFirmConnector(@CurrentUser() user: RequestUser, @Param('orgId') orgId: string, @Param('key') key: string) {
    await this.targetFirm(orgId);
    this.connectors.assertOrganizationConnector(key);
    const result = await this.tester.test(key, orgId, user.email);
    await this.audit.log({ ...user, orgId }, 'connector.test', 'Connector', key, { ok: result.ok, source: 'explicit-super-admin-firm' });
    return result;
  }

  @Roles('SUPER_ADMIN')
  @Delete('admin/organizations/:orgId/connectors/:key')
  async removeFirmConnector(@CurrentUser() user: RequestUser, @Param('orgId') orgId: string, @Param('key') key: string) {
    await this.targetFirm(orgId);
    await this.connectors.removeConnector(orgId, key);
    await this.audit.log({ ...user, orgId }, 'connector.delete', 'Connector', key, { source: 'explicit-super-admin-firm' });
    return { ok: true };
  }

  @Roles('BROKER_ADMIN')
  @Get('broker/connectors')
  overview(@CurrentUser() user: RequestUser) {
    return this.connectors.overview(requireOrg(user), user.role !== 'BROKER_AGENT');
  }

  @Roles('BROKER_ADMIN')
  @Patch('broker/connectors/:key')
  async save(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body(new ZodPipe(saveSchema)) body: z.infer<typeof saveSchema>) {
    await this.access.assertAllowed(user, 'connectors');
    const r = await this.connectors.saveConnector(requireOrg(user), key, body, user.id);
    await this.audit.log(user, 'connector.update', 'Connector', key, { fields: Object.keys(body.fields ?? {}) });
    return r;
  }

  @Roles('BROKER_ADMIN')
  @Post('broker/connectors/:key/test')
  test(@CurrentUser() user: RequestUser, @Param('key') key: string) {
    this.connectors.assertOrganizationConnector(key);
    return this.tester.test(key, requireOrg(user), user.email);
  }

  @Roles('BROKER_ADMIN')
  @Delete('broker/connectors/:key')
  async remove(@CurrentUser() user: RequestUser, @Param('key') key: string) {
    await this.connectors.removeConnector(requireOrg(user), key);
    await this.audit.log(user, 'connector.delete', 'Connector', key);
    return { ok: true };
  }

  @Roles('BROKER_ADMIN')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('broker/connectors/email_inbox/sync')
  sync(@CurrentUser() user: RequestUser) {
    return this.connectors.pollInbox(requireOrg(user));
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/portal-pack/:listingId')
  portalPack(@CurrentUser() user: RequestUser, @Param('listingId') listingId: string) {
    return this.connectors.portalPack(requireOrg(user), listingId);
  }

  @Roles('BROKER_ADMIN')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('broker/connectors/housing_api/sync')
  syncHousing(@CurrentUser() user: RequestUser) {
    return this.connectors.pollHousing(requireOrg(user));
  }

  /** Paste a portal email to preview what the parser extracts (helps brokers verify setup). */
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('broker/connectors/email_inbox/preview')
  preview(@Body(new ZodPipe(z.object({ from: z.string().default(''), subject: z.string().default(''), body: z.string().max(100_000) }))) body: any) {
    return parsePortalEmail({
      from: body.from,
      subject: body.subject,
      text: body.body.includes('<') ? null : body.body,
      html: body.body.includes('<') ? body.body : null,
    });
  }

  // ------------------------------------------------------------------ public webhooks
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(200)
  @All('webhooks/leads/:key')
  leadWebhook(@Param('key') key: string, @Body() body: any, @Query() query: any) {
    return this.connectors.ingestWebhook(key, body ?? {}, query ?? {});
  }

  @Public()
  @Get('webhooks/meta-leads/:key')
  async metaVerify(@Param('key') key: string, @Query() q: Record<string, string>, @Res() res: Response) {
    const t = await this.connectors.metaVerifyTarget(key);
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === t.verifyToken) return res.status(200).send(q['hub.challenge']);
    return res.status(403).send('verification failed');
  }

  @Public()
  @HttpCode(200)
  @Post('webhooks/meta-leads/:key')
  async meta(@Param('key') key: string, @Req() req: any, @Body() body: any) {
    const t = await this.connectors.metaVerifyTarget(key);
    const secret = t.cfg?.appSecret as string | undefined;
    if (secret) {
      const header = String(req.headers['x-hub-signature-256'] ?? '');
      const expected =
        'sha256=' +
        createHmac('sha256', secret)
          .update(req.rawBody ?? Buffer.from(''))
          .digest('hex');
      if (header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) throw new ForbiddenException('bad signature');
    }
    await this.connectors.handleMetaWebhook(key, body);
    return { ok: true };
  }
}
