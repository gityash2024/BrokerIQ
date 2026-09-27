import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CryptoService } from './settings/crypto.service';
import { SettingsService } from './settings/settings.service';
import { AuditService } from './audit/audit.service';
import { JobsService } from './jobs/jobs.service';
import { MailService } from './mail/mail.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { NotificationsService } from './notifications/notifications.service';
import { AiService } from './ai/ai.service';
import { MediaService } from './media/media.service';
import { env } from '../config/env';

const services = [CryptoService, SettingsService, AuditService, JobsService, MailService, RealtimeGateway, NotificationsService, AiService, MediaService];

@Global()
@Module({
  imports: [JwtModule.register({ global: true, secret: env().JWT_ACCESS_SECRET, signOptions: { expiresIn: env().JWT_ACCESS_TTL as any } })],
  providers: services,
  exports: services,
})
export class CoreModule {}
