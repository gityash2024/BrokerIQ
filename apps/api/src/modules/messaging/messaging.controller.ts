import { Throttle } from '@nestjs/throttler';
import { GmailService } from './gmail.service';
import type { Response } from 'express';
import { env } from '../../config/env';
import { Body, Controller, Get, HttpCode, Param, Post, Req, Query, Res, Delete } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { MessagingService } from './messaging.service';

const resolveSchema = z.object({ leadId: z.string().min(1), channel: z.enum(['SMS', 'EMAIL']) });
const sendSchema = z.object({ conversationId: z.string().min(1), text: z.string().trim().min(1).max(1600), requestId: z.string().uuid() });
@Controller()
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly gmail: GmailService,
  ) {}
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('messaging/gmail/connect')
  @Roles('BROKER_ADMIN')
  connect(@CurrentUser() user: RequestUser, @Req() req: { sessionId?: string }) {
    return this.gmail.begin(user, req.sessionId);
  }
  @Delete('messaging/gmail/connection')
  @Roles('BROKER_ADMIN')
  disconnect(@CurrentUser() user: RequestUser, @Req() req: { sessionId?: string }) {
    return this.gmail.disconnect(user);
  }
  @Public()
  @Get('webhooks/gmail/callback')
  async gmailCallback(@Query('state') state: string, @Query('code') code: string, @Res() res: Response) {
    let outcome = 'connected';
    try {
      await this.gmail.complete(state || '', code || '');
    } catch {
      outcome = 'connection_failed';
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(303, `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/broker/connectors?key=gmail&gmail=${outcome}`);
  }
  @Get('messaging/status')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  status(@CurrentUser() user: RequestUser) {
    return this.messaging.status(user);
  }
  @Post('messaging/resolve-lead')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  resolve(@CurrentUser() user: RequestUser, @Body(new ZodPipe(resolveSchema)) body: z.infer<typeof resolveSchema>) {
    return body.channel === 'EMAIL' ? this.gmail.resolve(user, body.leadId) : this.messaging.resolveSms(user, body.leadId);
  }
  @Post('messaging/sms/send')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  send(@CurrentUser() user: RequestUser, @Body(new ZodPipe(sendSchema)) body: z.infer<typeof sendSchema>) {
    return this.messaging.sendSms(user, body);
  }
  @Post('messaging/email/send')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  sendEmail(
    @CurrentUser() user: RequestUser,
    @Body(
      new ZodPipe(
        z.object({
          conversationId: z.string().min(1),
          requestId: z.string().uuid(),
          subject: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .refine((value) => !/[\r\n]/.test(value)),
          text: z.string().trim().min(1).max(20_000),
          replyToId: z.string().optional(),
        }),
      ),
    )
    body: { conversationId: string; requestId: string; subject: string; text: string; replyToId?: string },
  ) {
    return this.gmail.sendEmail(user, body);
  }
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('messaging/email/:id/sync')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  syncEmail(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ cursor: z.string().max(2048).optional() }))) body: { cursor?: string },
  ) {
    return this.gmail.sync(user, id, body.cursor);
  }
  @Public()
  @HttpCode(200)
  @Post('webhooks/textbee/:key')
  webhook(@Param('key') key: string, @Req() req: { rawBody?: Buffer; headers: Record<string, unknown> }, @Body() body: unknown) {
    return this.messaging.webhook(key, req.rawBody, req.headers['x-signature'], body);
  }
}
