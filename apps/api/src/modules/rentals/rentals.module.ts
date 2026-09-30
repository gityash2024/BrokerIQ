import { Module } from '@nestjs/common';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { CommunityModule } from '../community/community.module';
import { RentalsController } from './rentals.controller';
import { RentService } from './rent.service';
import { InspectionService } from './inspection.service';
import { EsignService } from './esign.service';
import { FairRentService } from './fair-rent.service';
import { ShortlistService } from './shortlist.service';

/** Tenant & owner tools (v4). */
@Module({
  imports: [WhatsAppModule, CommunityModule],
  controllers: [RentalsController],
  providers: [RentService, InspectionService, EsignService, FairRentService, ShortlistService],
})
export class RentalsModule {}
