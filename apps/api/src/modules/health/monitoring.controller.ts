import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringService } from '../../core/monitoring/monitoring.service';
import { AuditService } from '../../core/audit/audit.service';

const clientErrorSchema = z.object({
  source: z.enum(['WEB', 'MOBILE']),
  message: z.string().trim().min(1).max(1000),
  stack: z.string().max(8000).optional().nullable(),
  route: z.string().max(300).optional().nullable(),
  appVersion: z.string().max(40).optional().nullable(),
});

@Controller()
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
    private readonly audit: AuditService,
  ) {}

  /** Website error boundary / app crash handler report here (login optional). */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(204)
  @Post('public/client-errors')
  async clientError(@CurrentUser() user: RequestUser | undefined, @Body(new ZodPipe(clientErrorSchema)) body: z.infer<typeof clientErrorSchema>, @Headers('user-agent') ua?: string) {
    await this.monitoring.record({ ...body, userId: user?.id ?? null, userAgent: ua ?? null });
  }

  @Roles('SUPER_ADMIN')
  @Get('admin/errors')
  errors(@Query('status') status?: 'open' | 'resolved') {
    return this.prisma.errorLog.findMany({
      where: status === 'resolved' ? { resolvedAt: { not: null } } : { resolvedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });
  }

  @Roles('SUPER_ADMIN')
  @Patch('admin/errors/:id')
  async resolve(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ resolved: z.boolean() }))) body: { resolved: boolean }) {
    const row = await this.prisma.errorLog.update({ where: { id }, data: { resolvedAt: body.resolved ? new Date() : null } });
    await this.audit.log(user, body.resolved ? 'error.resolve' : 'error.reopen', 'ErrorLog', id);
    return row;
  }

  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  @Post('admin/errors/resolve-all')
  async resolveAll(@CurrentUser() user: RequestUser) {
    const r = await this.prisma.errorLog.updateMany({ where: { resolvedAt: null }, data: { resolvedAt: new Date() } });
    await this.audit.log(user, 'error.resolve_all', 'ErrorLog', null, { count: r.count });
    return r;
  }

  /**
   * Cost & usage (last 24 h / 30 days): AI calls per provider (and failures), emails sent, WhatsApp messages
   * sent, disk — so the free tiers of each provider are not crossed.
   */
  @Roles('SUPER_ADMIN')
  @Get('admin/usage/costs')
  async costs() {
    const day = new Date(Date.now() - 86400_000);
    const month = new Date(Date.now() - 30 * 86400_000);
    const [ai24, ai30, mail24, mail30, wa24, wa30, checks] = await Promise.all([
      this.prisma.aiUsage.groupBy({ by: ['provider', 'success'], where: { createdAt: { gte: day } }, _count: { _all: true }, _sum: { tokens: true } }),
      this.prisma.aiUsage.groupBy({ by: ['provider', 'success'], where: { createdAt: { gte: month } }, _count: { _all: true }, _sum: { tokens: true } }),
      this.prisma.integrationLog.count({ where: { integration: 'smtp', action: 'send', success: true, createdAt: { gte: day } } }),
      this.prisma.integrationLog.count({ where: { integration: 'smtp', action: 'send', success: true, createdAt: { gte: month } } }),
      this.prisma.message.count({ where: { direction: 'OUTBOUND', createdAt: { gte: day }, conversation: { channel: 'WHATSAPP' } } }).catch(() => 0),
      this.prisma.message.count({ where: { direction: 'OUTBOUND', createdAt: { gte: month }, conversation: { channel: 'WHATSAPP' } } }).catch(() => 0),
      this.monitoring.checks().catch(() => null),
    ]);
    const shape = (rows: typeof ai24) =>
      Object.values(
        rows.reduce<Record<string, { provider: string; ok: number; failed: number; tokens: number }>>((acc, r) => {
          const x = (acc[r.provider] ??= { provider: r.provider, ok: 0, failed: 0, tokens: 0 });
          if (r.success) x.ok += r._count._all;
          else x.failed += r._count._all;
          x.tokens += r._sum.tokens ?? 0;
          return acc;
        }, {}),
      );
    return { ai: { day: shape(ai24), month: shape(ai30) }, email: { day: mail24, month: mail30 }, whatsapp: { day: wa24, month: wa30 }, disk: checks?.disk ?? null };
  }

  /** Run the uptime checks now (website, database, disk, watchdog). */
  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  @Post('admin/monitoring/check')
  check() {
    return this.monitoring.checks();
  }
}
