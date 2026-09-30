import sharp from 'sharp';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ShareKitService } from './share-kit.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';

@ApiTags('share-kit')
@Controller()
export class ShareKitController {
  constructor(private readonly kit: ShareKitService) {}

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('broker/share-kit/:listingId')
  create(
    @CurrentUser() user: RequestUser,
    @Param('listingId') listingId: string,
    @Body(new ZodPipe(z.object({ leadId: z.string().optional().nullable() }))) body: { leadId?: string | null },
  ) {
    return this.kit.create(requireOrg(user), user.id, listingId, body.leadId);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('public/share-kit/:code')
  async image(
    @Param('code') code: string,
    @Query('format') format: string,
    @Query('download') download: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const fmt = format === 'story' ? 'story' : 'post';
    const png = await this.kit.render(code, fmt);
    // Instagram's publishing API only accepts JPEG image URLs.
    const jpg = type === 'jpg';
    const body = jpg ? await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer() : png;
    res.setHeader('Content-Type', jpg ? 'image/jpeg' : 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    if (download) res.setHeader('Content-Disposition', `attachment; filename="brokeriq-${fmt}-${code}.${jpg ? 'jpg' : 'png'}"`);
    res.send(body);
  }
}
