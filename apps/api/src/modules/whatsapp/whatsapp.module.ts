import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppBroadcastController } from './whatsapp-broadcast.controller';
import { WhatsAppBroadcastService } from './whatsapp-broadcast.service';
import { WhatsAppService } from './whatsapp.service';
import { LeadsModule } from '../leads/leads.module';

@Module({ imports: [LeadsModule], controllers: [WhatsAppController, WhatsAppBroadcastController], providers: [WhatsAppService, WhatsAppBroadcastService], exports: [WhatsAppService] })
export class WhatsAppModule {}
