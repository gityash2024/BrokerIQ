import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { whatsappSendSchema, renderTemplate, formatPriceShort } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';
import { env } from '../../config/env';
import type { z } from 'zod';

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
  async conversations(@CurrentUser() user: RequestUser, @Query() q: { q?: string; unread?: string; channel?: string }) {
    const orgId = requireOrg(user);
    const channel = (q.channel as any) || 'WHATSAPP';
    const isWhatsApp = channel === 'WHATSAPP';

    return this.prisma.conversation.findMany({
      where: {
        organizationId: orgId,
        channel,
        ...(isWhatsApp
          ? {
              lead: {
                is: {
                  source: 'HOUSING',
                  ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
                },
              },
            }
          : {
              ...(user.role === 'BROKER_AGENT' ? { OR: [{ lead: { assignedToId: user.id } }, { leadId: null }] } : {}),
            }),
        ...(q.unread === 'true' ? { unreadCount: { gt: 0 } } : {}),
        ...(q.q ? { OR: [{ contactName: { contains: q.q, mode: 'insensitive' } }, { contactKey: { contains: q.q.replace(/\D/g, '') || q.q } }] } : {}),
      },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      take: 200,
      include: {
        lead: { select: { id: true, name: true, stage: true, source: true, assignedTo: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  private async conv(id: string, user: RequestUser) {
    const c = await this.prisma.conversation.findFirst({ where: { id, organizationId: requireOrg(user) }, include: { lead: true } });
    if (!c) throw new NotFoundException();
    if (user.role === 'BROKER_AGENT' && c.lead && c.lead.assignedToId !== user.id) throw new ForbiddenException();
    return c;
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/conversations/:id/messages')
  async messages(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query('before') before?: string) {
    const c = await this.conv(id, user);
    const items = await this.prisma.message.findMany({
      where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { sender: { select: { id: true, name: true } } },
    });
    const windowOpen = !!c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < 24 * 3600_000;
    return { conversation: c, windowOpen, items: items.reverse() };
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('whatsapp/unread-stats')
  async unreadStats(@CurrentUser() user: RequestUser) {
    const orgId = requireOrg(user);
    const mine = user.role === 'BROKER_AGENT';
    const waWhere: Prisma.ConversationWhereInput = {
      organizationId: orgId,
      channel: 'WHATSAPP',
      unreadCount: { gt: 0 },
      ...(mine
        ? {
            lead: {
              is: {
                source: 'HOUSING',
                assignedToId: user.id,
              },
            },
          }
        : {}),
    };
    const chatWhere: Prisma.ConversationWhereInput = {
      organizationId: orgId,
      channel: 'CHAT',
      unreadCount: { gt: 0 },
      ...(mine
        ? {
            OR: [{ lead: { assignedToId: user.id } }, { leadId: null }],
          }
        : {}),
    };

    const [waAgg, chatAgg, waUnreadConvs, chatUnreadConvs] = await Promise.all([
      this.prisma.conversation.aggregate({ where: waWhere, _sum: { unreadCount: true } }),
      this.prisma.conversation.aggregate({ where: chatWhere, _sum: { unreadCount: true } }),
      this.prisma.conversation.count({ where: waWhere }),
      this.prisma.conversation.count({ where: chatWhere }),
    ]);

    const waUnreadMessages = waAgg._sum.unreadCount ?? 0;
    const chatUnreadMessages = chatAgg._sum.unreadCount ?? 0;
    return {
      whatsapp: {
        unreadConversations: waUnreadConvs,
        unreadMessages: waUnreadMessages,
      },
      chat: {
        unreadConversations: chatUnreadConvs,
        unreadMessages: chatUnreadMessages,
      },
      total: {
        unreadConversations: waUnreadConvs + chatUnreadConvs,
        unreadMessages: waUnreadMessages + chatUnreadMessages,
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
      this.realtime.toOrg(c.organizationId, 'wa:read', { conversationId: id, userId: user.id });
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
    await this.prisma.conversation.delete({ where: { id } });
    if (c.organizationId) {
      this.realtime.toOrg(c.organizationId, 'wa:conversation_deleted', { conversationId: id, leadId: c.leadId });
    }
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
      phone = c.contactPhone;
      leadId = leadId ?? c.leadId;
      name = c.contactName;
    }
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: leadId, organizationId: orgId, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
      });
      if (!lead) throw new NotFoundException('Lead नहीं मिली');
      phone = phone ?? lead.phone;
      name = name ?? lead.name;
    }
    if (!phone) throw new BadRequestException('leadId या conversationId ज़रूरी है');
    let text: string | undefined = body.text;
    if (body.listingId && !text) {
      const l = await this.prisma.listing.findFirst({ where: { id: body.listingId }, include: { locality: true } });
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
