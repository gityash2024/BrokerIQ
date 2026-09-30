import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { LeadsService } from '../leads/leads.service';
import { CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AccessService } from '../../core/access/access.service';

const startSchema = z.object({ organizationId: z.string(), listingId: z.string().optional(), message: z.string().min(1).max(2000) });
const msgSchema = z.object({ text: z.string().min(1).max(4000) });

/** In-app chat between a user (buyer/tenant) and a broker firm. */
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly accessCtl: AccessService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly leads: LeadsService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('start')
  async start(@CurrentUser() user: RequestUser, @Body(new ZodPipe(startSchema)) body: any) {
    if (user.orgId === body.organizationId) throw new BadRequestException('अपनी firm से chat नहीं कर सकते');
    const org = await this.prisma.organization.findFirst({ where: { id: body.organizationId, status: 'ACTIVE' } });
    if (!org) throw new NotFoundException('Broker नहीं मिला');
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    let leadId: string | null = null;
    if (me.phone) {
      const listing = body.listingId ? await this.prisma.listing.findUnique({ where: { id: body.listingId }, select: { id: true, title: true } }) : null;
      const { lead } = await this.leads.ingest({ orgId: org.id, name: me.name, phone: me.phone, email: me.email, source: 'WEBSITE', sourceDetail: listing ? `Chat: ${listing.title}` : 'In-app chat', listingId: listing?.id, message: body.message });
      leadId = lead.id;
    }
    const conv = await this.prisma.conversation.upsert({
      where: { organizationId_channel_contactKey: { organizationId: org.id, channel: 'CHAT', contactKey: user.id } },
      create: { organizationId: org.id, channel: 'CHAT', contactKey: user.id, userId: user.id, contactName: me.name, contactPhone: me.phone, leadId },
      update: { ...(leadId ? { leadId } : {}) },
    });
    await this.post(conv.id, user, body.message);
    return conv;
  }

  @Get('threads')
  threads(@CurrentUser() user: RequestUser) {
    return this.prisma.conversation.findMany({
      where: { channel: 'CHAT', userId: user.id },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true, verification: true } } },
    });
  }

  private async access(id: string, user: RequestUser) {
    const c = await this.prisma.conversation.findFirst({ where: { id, channel: 'CHAT' }, include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } } });
    if (!c) throw new NotFoundException();
    const isUser = c.userId === user.id;
    const isOrg = !!user.orgId && c.organizationId === user.orgId;
    if (!isUser && !isOrg) throw new ForbiddenException();
    return { c, isUser };
  }

  @Get('threads/:id')
  async messages(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const { c, isUser } = await this.access(id, user);
    const items = await this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' }, take: 300, include: { sender: { select: { id: true, name: true } } } });
    if (!isUser) await this.prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
    return { conversation: c, items };
  }

  @Post('threads/:id')
  async send(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(msgSchema)) body: any) {
    await this.accessCtl.assertAllowed(user, 'chat');
    return this.post(id, user, body.text);
  }

  private async post(id: string, user: RequestUser, text: string) {
    const { c, isUser } = await this.access(id, user);
    const msg = await this.prisma.message.create({
      data: { conversationId: id, direction: isUser ? 'INBOUND' : 'OUTBOUND', type: 'TEXT', body: text, status: isUser ? 'RECEIVED' : 'SENT', senderUserId: user.id },
      include: { sender: { select: { id: true, name: true } } },
    });
    await this.prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastPreview: text.slice(0, 140), ...(isUser ? { lastInboundAt: new Date(), unreadCount: { increment: 1 } } : {}) },
    });
    if (c.organizationId) this.realtime.toOrg(c.organizationId, 'chat:message', { conversationId: id, message: msg });
    if (c.userId) this.realtime.toUser(c.userId, 'chat:message', { conversationId: id, message: msg });
    if (isUser && c.organizationId) {
      const lead = c.leadId ? await this.prisma.lead.findUnique({ where: { id: c.leadId } }) : null;
      const input = { kind: 'NEW_MESSAGE', title: `💬 ${c.contactName ?? 'User'}: ${text.slice(0, 60)}`, link: `/broker/inbox?channel=CHAT&c=${id}` };
      if (lead?.assignedToId) await this.notifications.notify(lead.assignedToId, input);
      else await this.notifications.notifyOrg(c.organizationId, input, { adminsOnly: true });
      if (lead) await this.prisma.activity.create({ data: { organizationId: c.organizationId, leadId: lead.id, type: 'NOTE', content: `💬 Chat: ${text.slice(0, 300)}` } });
    } else if (!isUser && c.userId) {
      await this.notifications.notify(c.userId, { kind: 'NEW_MESSAGE', title: `💬 ${c.organization?.name}: ${text.slice(0, 60)}`, link: `/account/messages?c=${id}` });
    }
    return msg;
  }
}
