import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get live admin dashboard metrics and chart series' })
  getOverview() {
    return this.analyticsService.getDashboardOverview();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue metrics' })
  getRevenue() {
    return this.analyticsService.getRevenueAnalytics();
  }

  @Get()
  @ApiOperation({ summary: 'Get default analytics' })
  getDefault() {
    return this.analyticsService.getDashboardOverview();
  }
}
