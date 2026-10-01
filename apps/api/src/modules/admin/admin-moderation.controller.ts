import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';

const resolveSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolution: z.string().trim().max(500).optional(),
  /** Close the chat for both sides as part of resolving */
  blockChat: z.boolean().optional(),
});
const blockSchema = z.object({ blocked: z.boolean(), reason: z.string().trim().max(500).optional() });
const SERVICE_REQUEST_STATUS = ['NEW', 'CONTACTED', 'DONE', 'SPAM'] as const;
const serviceStatusSchema = z.object({ status: z.enum(SERVICE_REQUEST_STATUS) });

/** User-generated content queues that aren't listings: reported in-app chats and move-in service requests. */
@ApiTags('admin')
@Roles('SUPER_ADMIN', 'MODERATOR')
@Controller('admin')
export class AdminModerationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ reported chats
  @Get('chat-reports')
  async chatReports(@Query('status') status = 'OPEN') {
    const reports = await this.prisma.contentReport.findMany({
      where: { type: 'CHAT', status: status as 'OPEN' | 'RESOLVED' | 'DISMISSED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const convIds = [...new Set(reports.map((r) => r.targetId))];
    const userIds = [...new Set(reports.map((r) => r.reporterId).filter((x): x is string => !!x))];
    const [convs, reporters] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { id: { in: convIds } },
        select: {
          id: true,
          contactName: true,
          userId: true,
          blockedAt: true,
          blockedReason: true,
          organization: { select: { id: true, name: true, slug: true } },
          // Staff see the recent conversation to judge the report.
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 40,
            select: { id: true, direction: true, body: true, createdAt: true, sender: { select: { name: true } } },
          },
        },
      }),
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    ]);
    return reports.map((r) => {
      const c = convs.find((x) => x.id === r.targetId);
      return {
        ...r,
        reporter: reporters.find((u) => u.id === r.reporterId) ?? null,
        reporterSide: c && r.reporterId === c.userId ? 'USER' : 'BROKER',
        conversation: c ? { ...c, messages: [...c.messages].reverse() } : null,
      };
    });
  }

  @Patch('chat-reports/:id')
  async resolveChatReport(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(resolveSchema)) b: z.infer<typeof resolveSchema>) {
    const r = await this.prisma.contentReport.findFirst({ where: { id, type: 'CHAT' } });
    if (!r) throw new NotFoundException();
    if (b.blockChat) await this.setBlocked(u, r.targetId, true, b.resolution ?? 'Reported chat');
    const updated = await this.prisma.contentReport.update({
      where: { id },
      data: { status: b.status, resolution: b.resolution ?? null, resolvedById: u.id, resolvedAt: new Date() },
    });
    // Other open reports on the same chat are settled by the same decision.
    await this.prisma.contentReport.updateMany({
      where: { type: 'CHAT', targetId: r.targetId, status: 'OPEN' },
      data: { status: b.status, resolution: b.resolution ?? null, resolvedById: u.id, resolvedAt: new Date() },
    });
    await this.audit.log(u, `chat_report.${b.status.toLowerCase()}`, 'ContentReport', id, { blockChat: !!b.blockChat });
    if (r.reporterId)
      await this.notifications
        .notify(r.reporterId, {
          kind: 'SYSTEM',
          title: b.status === 'RESOLVED' ? 'आपकी chat report पर कार्रवाई हुई' : 'आपकी chat report देख ली गई',
          body: b.resolution ?? undefined,
        })
        .catch(() => undefined);
    return updated;
  }

  @Patch('chats/:id/block')
  block(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(blockSchema)) b: z.infer<typeof blockSchema>) {
    return this.setBlocked(u, id, b.blocked, b.reason);
  }

  private async setBlocked(u: RequestUser, id: string, blocked: boolean, reason?: string) {
    const c = await this.prisma.conversation.findFirst({ where: { id, channel: 'CHAT' } });
    if (!c) throw new NotFoundException();
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: blocked ? { blockedAt: new Date(), blockedReason: reason ?? null } : { blockedAt: null, blockedReason: null },
      select: { id: true, blockedAt: true, blockedReason: true },
    });
    await this.audit.log(u, blocked ? 'chat.block' : 'chat.unblock', 'Conversation', id, { reason });
    return updated;
  }

  // ------------------------------------------------------------------ move-in service requests
  @Patch('service-requests/:id')
  async serviceStatus(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(serviceStatusSchema)) b: z.infer<typeof serviceStatusSchema>) {
    const r = await this.prisma.serviceRequest.update({ where: { id }, data: { status: b.status } });
    await this.audit.log(u, 'service_request.status', 'ServiceRequest', id, b);
    return r;
  }

  @Delete('service-requests/:id')
  async deleteService(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    await this.prisma.serviceRequest.delete({ where: { id } });
    await this.audit.log(u, 'service_request.delete', 'ServiceRequest', id);
    return { ok: true };
  }
}
