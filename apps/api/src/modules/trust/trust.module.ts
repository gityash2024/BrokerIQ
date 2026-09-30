import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';
import { VisitBookingService } from './visit-booking.service';

@Module({
  imports: [LeadsModule, WhatsAppModule],
  controllers: [TrustController],
  providers: [TrustService, VisitBookingService],
  exports: [TrustService, VisitBookingService],
})
export class TrustModule {}
