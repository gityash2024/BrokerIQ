import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MaintenanceService } from './maintenance.service';

@Module({ imports: [ListingsModule, WhatsAppModule], providers: [MaintenanceService] })
export class MaintenanceModule {}
