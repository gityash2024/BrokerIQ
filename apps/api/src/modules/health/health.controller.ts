import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { Public, Roles } from '../../common/decorators';
import { SettingsService } from '../../core/settings/settings.service';

const startedAt = new Date();

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get()
  async health() {
    let db = 'ok';
    const t = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return { status: db === 'ok' ? 'ok' : 'degraded', db, dbLatencyMs: Date.now() - t, uptimeSec: Math.round((Date.now() - startedAt.getTime()) / 1000), time: new Date().toISOString() };
  }

  @Roles('SUPER_ADMIN')
  @Get('details')
  async details() {
    const base = await this.health();
    const [jobStats, failedJobs, integrations, webhookFailures, integrationErrors, errorsOpen] = await Promise.all([
      this.jobs.stats(),
      this.prisma.job.findMany({ where: { status: 'FAILED' }, orderBy: { updatedAt: 'desc' }, take: 10 }),
      this.settings.platformOverview(),
      this.prisma.webhookEvent.count({ where: { status: 'FAILED', createdAt: { gt: new Date(Date.now() - 86400_000) } } }),
      this.prisma.integrationLog.findMany({ where: { success: false }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.errorLog.count({ where: { resolvedAt: null } }),
    ]);
    return {
      ...base,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      node: process.version,
      jobs: Object.fromEntries(jobStats.map((s) => [s.status, s._count._all])),
      failedJobs,
      integrations: integrations.map((i) => ({ key: i.key, configured: i.configured, lastTestOk: i.lastTestOk, lastTestedAt: i.lastTestedAt })),
      webhookFailures24h: webhookFailures,
      integrationErrors,
      errorsOpen,
    };
  }
}
