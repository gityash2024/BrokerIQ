import { All, Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CallsService } from './calls.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';

@ApiTags('calls')
@Controller()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('leads/:id/call')
  call(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.calls.clickToCall(user, id);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('leads/:id/calls')
  list(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.calls.list(user, id);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('calls/:id/recording')
  async recording(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() res: Response) {
    const r = await this.calls.recording(user, id);
    res.setHeader('Content-Type', r.type);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(r.buffer);
  }

  // ------------------------------------------------------------------ Exotel webhooks (keyed by the firm's secret webhook key)
  @Public()
  @HttpCode(200)
  @All('webhooks/exotel/:key/status')
  status(@Param('key') key: string, @Body() body: any, @Query() q: any) {
    return this.calls.onStatus(key, { ...(q ?? {}), ...(body ?? {}) });
  }

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @All('webhooks/exotel/:key/connect')
  async connect(@Param('key') key: string, @Query() q: any, @Body() body: any, @Res() res: Response) {
    const number = await this.calls.onIncoming(key, { ...(body ?? {}), ...(q ?? {}) });
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(number);
  }
}
