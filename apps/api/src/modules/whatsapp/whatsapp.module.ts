import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { LeadsModule } from '../leads/leads.module';

@Module({ imports: [LeadsModule], controllers: [WhatsAppController], providers: [WhatsAppService], exports: [WhatsAppService] })
export class WhatsAppModule {}
