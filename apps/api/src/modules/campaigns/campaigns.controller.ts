import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { campaignSchema, campaignSegmentSchema, type CampaignInput } from '@brokeriq/shared';
import { CampaignsService } from './campaigns.service';
import { AccessService } from '../../core/access/access.service';
import { CurrentUser, Feature, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';

const previewSchema = z.object({ segment: campaignSegmentSchema.default({}) });

/** WhatsApp / email broadcasts to the firm's own leads (sent from the firm's own WhatsApp number). */
@ApiTags('campaigns')
@Controller()
export class CampaignsController {
  constructor(
    private readonly svc: CampaignsService,
    private readonly access: AccessService,
  ) {}

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Get('broker/campaigns')
  list(@CurrentUser() user: RequestUser) {
    return this.svc.list(requireOrg(user));
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Post('broker/campaigns/preview')
  preview(@CurrentUser() user: RequestUser, @Body(new ZodPipe(previewSchema)) body: z.infer<typeof previewSchema>) {
    return this.svc.preview(requireOrg(user), body.segment);
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Get('broker/campaigns/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query('page') page?: string) {
    return this.svc.get(requireOrg(user), id, Number(page) || 1);
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Post('broker/campaigns')
  async create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(campaignSchema)) body: CampaignInput) {
    await this.access.assertAllowed(user, 'campaigns');
    return this.svc.create(requireOrg(user), user.id, body);
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Patch('broker/campaigns/:id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(campaignSchema)) body: CampaignInput) {
    return this.svc.update(requireOrg(user), id, body);
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Delete('broker/campaigns/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.remove(requireOrg(user), id);
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post('broker/campaigns/:id/start')
  async start(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.access.assertAllowed(user, 'campaigns');
    return this.svc.start(user, requireOrg(user), id);
  }

  @Feature('campaigns')
  @Roles('BROKER_ADMIN')
  @Post('broker/campaigns/:id/cancel')
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.cancel(requireOrg(user), id, user);
  }

  // ------------------------------------------------------------------ public unsubscribe (link in campaign emails)
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/unsubscribe/:token')
  async unsubscribe(@Param('token') token: string, @Res() res: Response) {
    const page = (title: string, text: string) =>
      `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#f6f7fb;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">` +
      `<div style="max-width:420px"><h1 style="font-size:22px">${title}</h1><p style="color:#475569;line-height:1.5">${text}</p></div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    try {
      const firm = await this.svc.unsubscribe(token);
      const safe = firm.replace(/[<>&"]/g, '');
      res.send(page('Unsubscribe हो गया', `अब ${safe} की तरफ़ से आपको offers/updates वाले emails नहीं आएँगे।`));
    } catch {
      res.status(404).send(page('Link काम नहीं कर रहा', 'यह link गलत या पुराना है।'));
    }
  }

  // ------------------------------------------------------------------ BrokerIQ team: see and stop any campaign
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Get('admin/campaigns')
  adminList(@Query('status') status?: string) {
    return this.svc.adminList(status);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Get('admin/campaigns/:id')
  adminGet(@Param('id') id: string, @Query('page') page?: string) {
    return this.svc.get(null, id, Number(page) || 1);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Post('admin/campaigns/:id/cancel')
  adminCancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.cancel(null, id, user);
  }
}
