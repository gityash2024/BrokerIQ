import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { assistantChatSchema, assistantConfirmSchema, transcribeSchema } from '@brokeriq/shared';
import { ClientIp, CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AssistantService } from './assistant.service';
import { AccessService } from '../../core/access/access.service';
import type { z } from 'zod';

/** In-app AI agent (web + app floating button). Works only for the signed-in user. */
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly access: AccessService,
    private readonly assistant: AssistantService,
    private readonly prisma: PrismaService,
  ) {}

  private async withName(user: RequestUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
    return { ...user, name: u?.name };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('chat')
  async chat(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Body(new ZodPipe(assistantChatSchema)) body: z.infer<typeof assistantChatSchema>,
    @ClientIp() ip?: string,
  ) {
    await this.access.assertAllowed(user, 'ai');
    return this.assistant.chat(await this.withName(user), String(req.headers.authorization ?? ''), body, ip);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('confirm')
  async confirm(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(assistantConfirmSchema)) body: z.infer<typeof assistantConfirmSchema>,
    @ClientIp() ip?: string,
  ) {
    return this.assistant.confirm(await this.withName(user), body.token, body.lang, ip);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: RequestUser, @Body() body: { token?: string }) {
    return this.assistant.cancel(user, String(body?.token ?? ''));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('transcribe')
  async transcribe(@CurrentUser() user: RequestUser, @Body(new ZodPipe(transcribeSchema)) body: z.infer<typeof transcribeSchema>) {
    await this.access.assertAllowed(user, 'ai');
    return this.assistant.transcribe(user, body.audio, body.mime, body.lang);
  }
}
