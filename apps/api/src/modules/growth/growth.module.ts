import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { GrowthController } from './growth.controller';
import { CardController } from './card.controller';
import { SocialService } from './social.service';
import { ComparisonService } from './comparison.service';
import { ReportsService } from './reports.service';
import { OwnerReportService } from './owner-report.service';

/** Broker growth tools (v4): visiting card, photo branding settings, social auto-post, comparison PDF, reports, owner reports. */
@Module({
  imports: [ListingsModule, MediaModule],
  controllers: [GrowthController, CardController],
  providers: [SocialService, ComparisonService, ReportsService, OwnerReportService],
})
export class GrowthModule {}
