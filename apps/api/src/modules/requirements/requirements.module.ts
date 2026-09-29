import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';

@Module({ imports: [LeadsModule, WhatsAppModule], controllers: [RequirementsController], providers: [RequirementsService], exports: [RequirementsService] })
export class RequirementsModule {}
