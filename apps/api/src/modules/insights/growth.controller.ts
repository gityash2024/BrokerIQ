import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RankingService } from './ranking.service';
import { WeeklyReportService } from './weekly-report.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';

@ApiTags('insights')
@Controller()
export class GrowthController {
  constructor(
    private readonly ranking: RankingService,
    private readonly weekly: WeeklyReportService,
  ) {}

  /** Preview of this week's report (same text brokers get every Monday). */
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/weekly-report')
  async preview(@CurrentUser() user: RequestUser) {
    const orgId = requireOrg(user);
    const s = await this.weekly.summary(orgId);
    return { summary: s };
  }

  @Roles('BROKER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @Post('broker/weekly-report/send')
  send(@CurrentUser() user: RequestUser) {
    return this.weekly.send(requireOrg(user));
  }

  /** This firm's current response time and rank. */
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/rank')
  rank(@CurrentUser() user: RequestUser) {
    return this.ranking.recompute(requireOrg(user));
  }

  @Roles('SUPER_ADMIN')
  @Post('admin/ranking/recompute')
  recompute() {
    return this.ranking.recomputeAll();
  }
}
