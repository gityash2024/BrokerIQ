import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({ imports: [WhatsAppModule], controllers: [CampaignsController], providers: [CampaignsService] })
export class CampaignsModule {}
