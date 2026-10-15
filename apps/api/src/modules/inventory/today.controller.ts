import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { ModulesService } from '../../core/features/modules.service';

@Roles('SUPER_ADMIN', 'BROKER_ADMIN')
@Controller('broker/today')
export class TodayController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly modules: ModulesService,
  ) {}
  @Get() async today(@CurrentUser() user: RequestUser) {
    const organizationId = this.inventory.orgId(user)!;
    const [leadsOn, inventoryOn, inboxOn] = await Promise.all(['leads', 'inventory', 'inbox'].map((key) => this.modules.enabled(key)));
    const now = new Date();
    // Gurgaon workday boundaries are computed explicitly, independently of the host timezone.
    const offset = 330 * 60_000;
    const local = new Date(now.getTime() + offset);
    local.setUTCHours(0, 0, 0, 0);
    const start = new Date(local.getTime() - offset);
    const end = new Date(start.getTime() + 86400_000);
    const [followUps, visits, newLeads, requirements, inventory, pendingReview, unread] = await Promise.all([
      leadsOn
        ? this.prisma.followUp.findMany({
            where: { organizationId, status: 'PENDING', dueAt: { lt: end } },
            orderBy: { dueAt: 'asc' },
            take: 20,
            include: { lead: { select: { id: true, name: true, phone: true } } },
          })
        : [],
      leadsOn
        ? this.prisma.siteVisit.findMany({
            where: { organizationId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { gte: start, lt: end } },
            orderBy: { scheduledAt: 'asc' },
            take: 20,
            include: { lead: { select: { id: true, name: true, phone: true } } },
          })
        : [],
      leadsOn ? this.prisma.lead.count({ where: { organizationId, deletedAt: null, createdAt: { gte: start, lt: end } } }) : null,
      leadsOn ? this.prisma.brokerRequirement.count({ where: { organizationId, deletedAt: null, status: 'OPEN' } }) : null,
      inventoryOn ? this.inventory.getStats(user) : null,
      inboxOn ? this.prisma.sourceEntry.count({ where: { batch: { organizationId }, reviewState: 'NEEDS_REVIEW' } }) : null,
      inboxOn ? this.prisma.conversation.aggregate({ where: { organizationId }, _sum: { unreadCount: true } }) : null,
    ]);
    return {
      date: start.toISOString(),
      followUps,
      visits,
      newLeads,
      requirements,
      inventory,
      pendingReview,
      unreadMessages: unread ? (unread._sum.unreadCount ?? 0) : null,
    };
  }
}
