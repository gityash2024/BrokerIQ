import { Module } from '@nestjs/common';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { InsightsController } from './insights.controller';
import { GrowthController } from './growth.controller';
import { RankingService } from './ranking.service';
import { WeeklyReportService } from './weekly-report.service';

@Module({
  imports: [WhatsAppModule],
  controllers: [InsightsController, GrowthController],
  providers: [RankingService, WeeklyReportService],
  exports: [RankingService, WeeklyReportService],
})
export class InsightsModule {}
