import { GmailService } from './gmail.service';
import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
@Module({ controllers: [MessagingController], providers: [MessagingService, GmailService], exports: [MessagingService, GmailService] })
export class MessagingModule {}
