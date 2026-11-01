import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { MessagingService } from './messaging.service';

const resolveSchema = z.object({ leadId: z.string().min(1), channel: z.literal('SMS') });
const sendSchema = z.object({ conversationId: z.string().min(1), text: z.string().trim().min(1).max(1600), requestId: z.string().uuid() });
@Controller()
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}
  @Get('messaging/status')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  status(@CurrentUser() user: RequestUser) {
    return this.messaging.status(user);
  }
  @Post('messaging/resolve-lead')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  resolve(@CurrentUser() user: RequestUser, @Body(new ZodPipe(resolveSchema)) body: z.infer<typeof resolveSchema>) {
    return this.messaging.resolveSms(user, body.leadId);
  }
  @Post('messaging/sms/send')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  send(@CurrentUser() user: RequestUser, @Body(new ZodPipe(sendSchema)) body: z.infer<typeof sendSchema>) {
    return this.messaging.sendSms(user, body);
  }
  @Public()
  @HttpCode(200)
  @Post('webhooks/textbee/:key')
  webhook(@Param('key') key: string, @Req() req: { rawBody?: Buffer; headers: Record<string, unknown> }, @Body() body: unknown) {
    return this.messaging.webhook(key, req.rawBody, req.headers['x-signature'], body);
  }
}
