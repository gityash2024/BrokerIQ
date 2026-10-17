import { Module, Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { dashboardQuerySchema, type DashboardQuery } from '@brokeriq/shared';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { DashboardService } from './dashboard.service';
@Controller()
class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  private records(role: 'admin' | 'broker' | 'user', q: Record<string, string>, user: RequestUser) {
    const parsed = dashboardQuerySchema.safeParse(q);
    if (!parsed.success) throw new BadRequestException('Invalid reporting dates');
    const page = Number(q.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new BadRequestException('Invalid page');
    return this.dashboard.records(role, parsed.data, user, q.chart ?? '', q.value ?? '', page);
  }
  @Roles('SUPER_ADMIN') @Get('admin/dashboard/records') adminRecords(@Query() q: Record<string, string>, @CurrentUser() u: RequestUser) {
    return this.records('admin', q, u);
  }
  @Roles('BROKER_ADMIN') @Get('broker/dashboard/records') brokerRecords(@Query() q: Record<string, string>, @CurrentUser() u: RequestUser) {
    return this.records('broker', q, u);
  }
  @Roles('USER') @Get('me/dashboard/records') userRecords(@Query() q: Record<string, string>, @CurrentUser() u: RequestUser) {
    return this.records('user', q, u);
  }

  @Roles('SUPER_ADMIN') @Get('admin/dashboard/metrics') admin(@Query(new ZodPipe(dashboardQuerySchema)) q: DashboardQuery, @CurrentUser() user: RequestUser) {
    return this.dashboard.metrics('admin', q, user);
  }
  @Roles('BROKER_ADMIN') @Get('broker/dashboard/metrics') broker(
    @Query(new ZodPipe(dashboardQuerySchema)) q: DashboardQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dashboard.metrics('broker', q, user);
  }
  @Roles('USER') @Get('me/dashboard') me(@Query(new ZodPipe(dashboardQuerySchema)) q: DashboardQuery, @CurrentUser() user: RequestUser) {
    return this.dashboard.metrics('user', q, user);
  }
}
@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
