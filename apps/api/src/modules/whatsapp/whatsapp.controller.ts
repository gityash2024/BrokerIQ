import { inboxChannelWhere } from './inbox-scope';
import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { whatsappSendSchema, renderTemplate, formatPriceShort, phoneForWhatsApp, normalizeIndianPhone, inboxListQuerySchema, type InboxListQuery } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';
import { env } from '../../config/env';
import { z } from 'zod';

@ApiTags('whatsapp')
@Controller()
export class WhatsAppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WhatsAppService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/status')
  async status(@CurrentUser() user: RequestUser) {
    const orgId = requireOrg(user);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const creds = await this.wa.creds(orgId);
    return {
      connected: !!creds,
      scope: creds?.scope ?? null,
      displayPhone: creds?.values.displayPhone ?? null,
      webhookUrl: user.role === 'BROKER_ADMIN' ? `${env().PUBLIC_API_URL}/api/webhooks/whatsapp/${org.webhookKey}` : undefined,
      verifyToken: user.role === 'BROKER_ADMIN' ? this.wa.orgVerifyToken(org.webhookKey) : undefined,
    };
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/conversations')
  @Header('Cache-Control', 'private, no-store')
  async conversations(@CurrentUser() user: RequestUser, @Query(new ZodPipe(inboxListQuerySchema)) q: InboxListQuery) {
    const orgId = requireOrg(user);
    const contactSearch = q.q && /\d/.test(q.q) && /^[+\d\s().-]+$/.test(q.q) ? q.q.replace(/\D/g, '') : q.q;
    const where: Prisma.ConversationWhereInput = {
      ...inboxChannelWhere(orgId, user, q.channel),
      ...(q.unread === 'true' ? { unreadCount: { gt: 0 } } : {}),
      ...(q.q ? { AND: [{ OR: [
        { contactName: { contains: q.q, mode: 'insensitive' } },
        { contactKey: { contains: contactSearch, mode: 'insensitive' } },
        { contactPhone: { contains: contactSearch } },
        { lastPreview: { contains: q.q, mode: 'insensitive' } },
      ] }] } : {}),
    };
    const include = {
      lead: { select: { id: true, name: true, stage: true, source: true, assignedTo: { select: { id: true, name: true } } } },
      user: { select: { id: true, name: true, avatarUrl: true } },
    } as const;
    const orderBy: Prisma.ConversationOrderByWithRelationInput[] = [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    if (q.paginated !== 'true') return this.prisma.conversation.findMany({ where, orderBy, include, take: 200 });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({ where, orderBy, include, take: q.pageSize, skip: (q.page - 1) * q.pageSize }),
      this.prisma.conversation.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  }

  /** Resolve an internal composer without sending a message or broadening the Housing inbox list. */
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('whatsapp/resolve-lead')
  async resolveLead(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ leadId: z.string().min(1) }))) body: { leadId: string }) {
    const orgId = requireOrg(user);
    const scope = { id: body.leadId, organizationId: orgId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) };
    const lead = await this.prisma.lead.findFirst({ where: scope });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!normalizeIndianPhone(lead.phone)) throw new BadRequestException('Lead needs a valid phone number');
    await this.wa.requireCreds(orgId);
    return this.prisma.$transaction(async (tx) => {
      const contactKey = phoneForWhatsApp(lead.phone);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa-composer:${orgId}:${contactKey}`}))`;
      const currentLead = await tx.lead.findFirst({ where: scope });
      if (!currentLead || phoneForWhatsApp(currentLead.phone) !== contactKey) throw new ConflictException('Lead changed. Refresh and try again.');
      const existing = await tx.conversation.findUnique({
        where: { organizationId_channel_contactKey: { organizationId: orgId, channel: 'WHATSAPP', contactKey } },
      });
      if (existing) {
        if (existing.leadId && existing.leadId !== lead.id)
          throw new ConflictException('This number is linked to another lead. Review that contact before opening its history.');
        // An unlinked historical chat is not automatically disclosed to an agent.
        if (!existing.leadId && user.role === 'BROKER_AGENT') throw new ForbiddenException('An administrator must review this unlinked conversation');
        if (existing.blockedAt) throw new ForbiddenException('This conversation is blocked');
        if (existing.leadId) return { conversationId: existing.id, channel: existing.channel };
        const linked = await tx.conversation.update({ where: { id: existing.id }, data: { leadId: lead.id, contactName: lead.name } });
        return { conversationId: linked.id, channel: linked.channel };
      }
      const created = await tx.conversation.create({
        data: { organizationId: orgId, channel: 'WHATSAPP', contactKey, contactPhone: `+${contactKey}`, contactName: lead.name, leadId: lead.id },
      });
      return { conversationId: created.id, channel: created.channel };
    });
  }

  private async conv(id: string, user: RequestUser) {
    const c = await this.prisma.conversation.findFirst({ where: { id, organizationId: requireOrg(user) }, include: { lead: true } });
    if (!c) throw new NotFoundException();
    if (user.role === 'BROKER_AGENT' && (!c.lead || c.lead.deletedAt || c.lead.assignedToId !== user.id)) throw new ForbiddenException();
    return c;
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/conversations/:id/messages')
  async messages(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query('before') before?: string, @Query('cursor') cursor?: string) {
    const c = await this.conv(id, user);
    if (c.unreadCount > 0) {
      await this.prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
      c.unreadCount = 0;
      if (c.organizationId) {
        await this.realtime.toConversation(c.organizationId, id, 'wa:read', { conversationId: id, userId: user.id });
      }
    }
    const position = cursor ? await this.prisma.message.findFirst({ where: { id: cursor, conversationId: id }, select: { id: true, createdAt: true } }) : null;
    if (cursor && !position) throw new BadRequestException('Invalid message cursor');
    if (before && !Number.isFinite(Date.parse(before))) throw new BadRequestException('Invalid message date');
    const items = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        ...(position
          ? { OR: [{ createdAt: { lt: position.createdAt } }, { createdAt: position.createdAt, id: { lt: position.id } }] }
          : before
            ? { createdAt: { lt: new Date(before) } }
            : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 61,
      include: { sender: { select: { id: true, name: true } } },
    });
    const windowOpen = !!c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < 24 * 3600_000;
    return { conversation: c, windowOpen, nextCursor: items.length > 60 ? items[59].id : null, items: items.slice(0, 60).reverse() };
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/unread-stats')
  async unreadStats(@CurrentUser() user: RequestUser) {
    const orgId = requireOrg(user);
    const channels = ['WHATSAPP', 'CHAT', 'SMS', 'EMAIL'] as const;
    const stats = await this.prisma.$transaction(
      channels.map((channel) =>
        this.prisma.conversation.aggregate({
          where: { ...inboxChannelWhere(orgId, user, channel), unreadCount: { gt: 0 } },
          _count: { _all: true },
          _sum: { unreadCount: true },
        }),
      ),
    );
    const [waUnreadConvs, chatUnreadConvs, smsUnreadConvs, emailUnreadConvs] = stats.map((x) => x._count._all);
    const [waUnreadMessages, chatUnreadMessages, smsUnreadMessages, emailUnreadMessages] = stats.map((x) => x._sum.unreadCount ?? 0);

    return {
      whatsapp: {
        unreadConversations: waUnreadConvs,
        unreadMessages: waUnreadMessages,
      },
      chat: {
        unreadConversations: chatUnreadConvs,
        unreadMessages: chatUnreadMessages,
      },
      sms: { unreadConversations: smsUnreadConvs, unreadMessages: smsUnreadMessages },
      email: { unreadConversations: emailUnreadConvs, unreadMessages: emailUnreadMessages },
      total: {
        unreadConversations: waUnreadConvs + chatUnreadConvs + smsUnreadConvs + emailUnreadConvs,
        unreadMessages: waUnreadMessages + chatUnreadMessages + smsUnreadMessages + emailUnreadMessages,
      },
    };
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @HttpCode(200)
  @Post('whatsapp/conversations/:id/read')
  async read(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const c = await this.conv(id, user);
    await this.prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
    if (c.organizationId) {
      await this.realtime.toConversation(c.organizationId, id, 'wa:read', { conversationId: id, userId: user.id });
    }
    return { ok: true };
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @HttpCode(200)
  @Delete('whatsapp/conversations/:id')
  async deleteConversation(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const c = await this.conv(id, user);
    if (user.role === 'BROKER_AGENT' && c.lead && c.lead.assignedToId !== user.id) {
      throw new ForbiddenException('आप इस बातचीत को नहीं हटा सकते');
    }
    // Delete conversation safely: cascading deletes messages,
    // but LEAVES LEAD 100% UNTOUCHED (as foreign key is SetNull).
    if (c.organizationId) {
      await this.realtime.toConversation(c.organizationId, id, 'wa:conversation_deleted', { conversationId: id, leadId: c.leadId });
    }
    await this.prisma.conversation.delete({ where: { id } });
    return { ok: true, deletedConversationId: id };
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('whatsapp/send')
  async send(@CurrentUser() user: RequestUser, @Body(new ZodPipe(whatsappSendSchema)) body: z.infer<typeof whatsappSendSchema>) {
    const orgId = requireOrg(user);
    let phone: string | null = null;
    let leadId: string | null = body.leadId ?? null;
    let name: string | null = null;
    if (body.conversationId) {
      const c = await this.conv(body.conversationId, user);
      if (c.channel !== 'WHATSAPP') throw new BadRequestException('Use website chat for this conversation');
      if (c.blockedAt) throw new ForbiddenException('This conversation is blocked');
      if (leadId && leadId !== c.leadId) throw new BadRequestException('Lead and conversation do not match');
      phone = c.contactPhone;
      leadId = leadId ?? c.leadId;
      name = c.contactName;
    }
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: leadId, organizationId: orgId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
      });
      if (!lead) throw new NotFoundException('Lead नहीं मिली');
      if (phone && phoneForWhatsApp(phone) !== phoneForWhatsApp(lead.phone))
        throw new ConflictException('Lead phone changed; review the conversation before sending');
      phone = phone ?? lead.phone;
      name = name ?? lead.name;
    }
    if (!phone) throw new BadRequestException('leadId या conversationId ज़रूरी है');
    if (!body.conversationId) {
      const existing = await this.prisma.conversation.findUnique({
        where: { organizationId_channel_contactKey: { organizationId: orgId, channel: 'WHATSAPP', contactKey: phoneForWhatsApp(phone) } },
      });
      if (existing) {
        await this.conv(existing.id, user);
        if (existing.blockedAt) throw new ForbiddenException('This conversation is blocked');
        if (existing.leadId && existing.leadId !== leadId) throw new ConflictException('This number is linked to another lead');
      }
    }

    let text: string | undefined = body.text;
    if (body.listingId && !text) {
      const l = await this.prisma.listing.findFirst({
        where: {
          id: body.listingId,
          deletedAt: null,
          OR: [{ status: 'ACTIVE' }, { organizationId: orgId, ...(user.role === 'BROKER_AGENT' ? { postedById: user.id } : {}) }],
        },
        include: { locality: true },
      });
      if (!l) throw new NotFoundException('Listing not available to this account');
      if (l) text = `*${l.title}*\n💰 ${formatPriceShort(l.price)} · 📍 ${l.locality.name}\n${env().PUBLIC_WEB_URL}/property/${l.slug}`;
    }
    if (body.templateName)
      return this.wa.send(
        orgId,
        phone,
        { type: 'template', name: body.templateName, language: body.templateLanguage, params: body.templateParams },
        { leadId, userId: user.id, contactName: name },
      );
    if (body.mediaUrl) return this.wa.send(orgId, phone, { type: 'image', url: body.mediaUrl, caption: text }, { leadId, userId: user.id, contactName: name });
    if (!text) throw new BadRequestException('Message खाली है');
    return this.wa.send(orgId, phone, { type: 'text', text: renderTemplate(text, { lead: { name } }) }, { leadId, userId: user.id, contactName: name });
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/templates')
  templates(@CurrentUser() user: RequestUser) {
    return this.prisma.whatsAppTemplate.findMany({ where: { organizationId: requireOrg(user) }, orderBy: { name: 'asc' } });
  }

  @Roles('BROKER_ADMIN')
  @Post('whatsapp/templates/sync')
  sync(@CurrentUser() user: RequestUser) {
    return this.wa.syncTemplates(requireOrg(user));
  }

  // ------------------------------------------------------------------ Meta webhooks (public)
  @Public()
  @Get('webhooks/whatsapp/:key')
  async verify(@Param('key') key: string, @Query() q: Record<string, string>, @Res() res: Response) {
    const target = await this.wa.resolveWebhookTarget(key);
    if (q['hub.mode'] === 'subscribe' && target.verifyToken && q['hub.verify_token'] === target.verifyToken) return res.status(200).send(q['hub.challenge']);
    return res.status(403).send('verification failed');
  }

  @Public()
  @HttpCode(200)
  @Post('webhooks/whatsapp/:key')
  async webhook(@Param('key') key: string, @Req() req: any, @Body() body: any) {
    const target = await this.wa.resolveWebhookTarget(key);
    if (!this.wa.verifySignature(target.values?.appSecret as string | undefined, req.rawBody, req.headers['x-hub-signature-256']))
      throw new ForbiddenException('bad signature');
    await this.wa.handleWebhook(key, body);
    return { ok: true };
  }
}
