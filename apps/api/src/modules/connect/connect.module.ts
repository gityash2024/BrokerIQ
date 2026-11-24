import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AuthModule } from '../auth/auth.module';
import { ConnectService } from './connect.service';
import { connectCapture, connectRecording, connectRegistration, connectSettings,
  type ConnectCapture, type ConnectRecording, type ConnectRegistration, type ConnectSettings } from './connect.schemas';

type SessionRequest = Request & { sessionId: string };
const optionalId = z.string().min(1).max(100).optional();

@Controller('connect')
class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get('profile')
  profile(@CurrentUser() user: RequestUser) { return this.connect.profile(user); }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('devices')
  register(@CurrentUser() user: RequestUser, @Req() request: SessionRequest, @Body(new ZodPipe(connectRegistration)) input: ConnectRegistration) {
    return this.connect.register(user, request.sessionId, input);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Patch('settings')
  settings(@CurrentUser() user: RequestUser, @Req() request: SessionRequest, @Body(new ZodPipe(connectSettings)) input: ConnectSettings) {
    return this.connect.settings(user, request.sessionId, input);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Delete('devices/:id')
  revoke(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.connect.revoke(user, id); }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('directory')
  directory(@CurrentUser() user: RequestUser, @Req() request: SessionRequest, @Query(new ZodPipe(z.object({ after: optionalId }))) { after }: { after?: string }) {
    return this.connect.directory(user, request.sessionId, after);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('events')
  capture(@CurrentUser() user: RequestUser, @Req() request: SessionRequest, @Body(new ZodPipe(connectCapture)) input: ConnectCapture) {
    return this.connect.capture(user, request.sessionId, input);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('recordings')
  recording(@CurrentUser() user: RequestUser, @Req() request: SessionRequest, @Body(new ZodPipe(connectRecording)) input: ConnectRecording) {
    return this.connect.recording(user, request.sessionId, input);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('events')
  activity(@CurrentUser() user: RequestUser, @Query(new ZodPipe(z.object({ leadId: optionalId }))) { leadId }: { leadId?: string }) {
    return this.connect.activity(user, leadId);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('events/:id')
  details(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.connect.detail(user, id); }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('events/:id/recording')
  async playback(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() response: Response) {
    const file = await this.connect.playback(user, id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(file.body);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('events/:id/retry')
  retry(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.connect.retry(user, id); }
}

@Module({ imports: [AuthModule], controllers: [ConnectController], providers: [ConnectService] })
export class ConnectModule {}
