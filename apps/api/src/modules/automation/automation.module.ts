import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { LeadsModule } from '../leads/leads.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RemindersService } from './reminders.service';

@Module({ imports: [LeadsModule, WhatsAppModule], controllers: [AutomationController], providers: [AutomationService, RemindersService] })
export class AutomationModule {}
