import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { LeadsModule } from '../leads/leads.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({ imports: [LeadsModule, WhatsAppModule], controllers: [ConnectorsController], providers: [ConnectorsService] })
export class ConnectorsModule {}
