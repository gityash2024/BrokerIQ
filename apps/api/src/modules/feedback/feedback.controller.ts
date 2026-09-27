import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { FEEDBACK_STATUS_LABELS, feedbackAdminSchema, feedbackSchema } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuditService } from '../../core/audit/audit.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { paged } from '../../common/utils';

const PUBLIC_STATUSES = ['UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'DONE'] as const;

/** Feedback, bug reports and feature requests + public roadmap with voting. */
@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async withVoted<T extends { id: string }>(items: T[], userId?: string) {
    if (!userId || !items.length) return items.map((i) => ({ ...i, voted: false }));
    const votes = await this.prisma.feedbackVote.findMany({ where: { userId, feedbackId: { in: items.map((i) => i.id) } }, select: { feedbackId: true } });
    const set = new Set(votes.map((v) => v.feedbackId));
    return items.map((i) => ({ ...i, voted: set.has(i.id) }));
  }

  @Public()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post()
  async create(@CurrentUser() user: RequestUser | undefined, @Body(new ZodPipe(feedbackSchema)) body: any) {
    if (!user && !body.contactEmail) throw new BadRequestException('Login करें या reply के लिए email डालें');
    const fb = await this.prisma.feedback.create({
      data: { ...body, contactEmail: body.contactEmail || null, userId: user?.id, isPublic: false },
    });
    if (user) await this.prisma.feedbackVote.create({ data: { feedbackId: fb.id, userId: user.id } }).then(() => this.prisma.feedback.update({ where: { id: fb.id }, data: { voteCount: 1 } }));
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notify(admins.map((a) => a.id), { kind: 'SYSTEM', title: `🗣️ नया ${body.type.toLowerCase()} feedback: ${body.title}`, link: `/admin/feedback?id=${fb.id}`, push: body.type === 'BUG' || body.type === 'COMPLAINT' });
    return { ok: true, id: fb.id };
  }

  /** Public roadmap / feature board. */
  @Public()
  @Get('board')
  async board(@CurrentUser() user: RequestUser | undefined, @Query() q: { status?: string; type?: string; sort?: string; q?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.FeedbackWhereInput = {
      isPublic: true,
      mergedIntoId: null,
      status: q.status ? (q.status as any) : { in: [...PUBLIC_STATUSES, 'OPEN'] },
      ...(q.type ? { type: q.type as any } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, counts] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: q.sort === 'new' ? [{ createdAt: 'desc' }] : [{ voteCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * 30,
        take: 30,
        select: { id: true, type: true, title: true, description: true, status: true, voteCount: true, adminReply: true, createdAt: true, updatedAt: true, _count: { select: { comments: true } } },
      }),
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.groupBy({ by: ['status'], where: { isPublic: true, mergedIntoId: null }, _count: { _all: true } }),
    ]);
    return { ...paged(await this.withVoted(items, user?.id), total, page, 30), statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  @Get('mine')
  mine(@CurrentUser() user: RequestUser) {
    return this.prisma.feedback.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { comments: true } } } });
  }

  @Public()
  @Get(':id')
  async detail(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    const fb = await this.prisma.feedback.findUnique({ where: { id }, include: { comments: { orderBy: { createdAt: 'asc' } } } });
    if (!fb) throw new NotFoundException();
    const own = user && fb.userId === user.id;
    if (!fb.isPublic && !own && user?.role !== 'SUPER_ADMIN') throw new NotFoundException();
    const [withVote] = await this.withVoted([fb], user?.id);
    const { contactEmail, userId, ...rest } = withVote as any;
    return user?.role === 'SUPER_ADMIN' ? withVote : { ...rest, own: !!own, contactEmail: own ? contactEmail : undefined, userId: undefined };
  }

  @Post(':id/vote')
  async vote(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const fb = await this.prisma.feedback.findUnique({ where: { id } });
    if (!fb || (!fb.isPublic && fb.userId !== user.id)) throw new NotFoundException();
    const existing = await this.prisma.feedbackVote.findUnique({ where: { feedbackId_userId: { feedbackId: id, userId: user.id } } });
    if (existing) await this.prisma.feedbackVote.delete({ where: { feedbackId_userId: { feedbackId: id, userId: user.id } } });
    else await this.prisma.feedbackVote.create({ data: { feedbackId: id, userId: user.id } });
    const voteCount = await this.prisma.feedbackVote.count({ where: { feedbackId: id } });
    await this.prisma.feedback.update({ where: { id }, data: { voteCount } });
    return { voted: !existing, voteCount };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/comments')
  async comment(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ body: z.string().trim().min(1).max(2000) }))) body: any) {
    const fb = await this.prisma.feedback.findUnique({ where: { id } });
    if (!fb) throw new NotFoundException();
    const isAdmin = user.role === 'SUPER_ADMIN';
    if (!fb.isPublic && fb.userId !== user.id && !isAdmin) throw new ForbiddenException();
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const c = await this.prisma.feedbackComment.create({ data: { feedbackId: id, userId: user.id, authorName: isAdmin ? 'BrokerIQ Team' : me.name, isAdmin, body: body.body } });
    if (isAdmin && fb.userId) await this.notifications.notify(fb.userId, { kind: 'SYSTEM', title: 'आपके feedback पर team का जवाब आया', body: fb.title, link: `/feedback/${id}` });
    return c;
  }

  // ------------------------------------------------------------------ admin
  @Roles('SUPER_ADMIN')
  @Get('admin/list')
  async adminList(@Query() q: { status?: string; type?: string; q?: string; page?: string; sort?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.FeedbackWhereInput = {
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.type ? { type: q.type as any } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, byStatus, byType, avgRating] = await Promise.all([
      this.prisma.feedback.findMany({ where, orderBy: q.sort === 'votes' ? [{ voteCount: 'desc' }] : [{ createdAt: 'desc' }], skip: (page - 1) * 30, take: 30, include: { _count: { select: { comments: true } } } }),
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.feedback.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.feedback.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
    ]);
    const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean))] as string[];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, role: true } });
    return {
      ...paged(items.map((i) => ({ ...i, user: users.find((u) => u.id === i.userId) ?? null })), total, page, 30),
      stats: {
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
        byType: Object.fromEntries(byType.map((s) => [s.type, s._count._all])),
        avgRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : null,
        ratings: avgRating._count.rating,
      },
    };
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id')
  async adminUpdate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(feedbackAdminSchema)) body: any) {
    const fb = await this.prisma.feedback.findUnique({ where: { id } });
    if (!fb) throw new NotFoundException();
    if (body.mergedIntoId) {
      const target = await this.prisma.feedback.findUnique({ where: { id: body.mergedIntoId } });
      if (!target || target.id === id) throw new BadRequestException('Invalid merge target');
      const votes = await this.prisma.feedbackVote.findMany({ where: { feedbackId: id } });
      for (const v of votes) await this.prisma.feedbackVote.upsert({ where: { feedbackId_userId: { feedbackId: target.id, userId: v.userId } }, create: { feedbackId: target.id, userId: v.userId }, update: {} });
      await this.prisma.feedback.update({ where: { id: target.id }, data: { voteCount: await this.prisma.feedbackVote.count({ where: { feedbackId: target.id } }) } });
      body.isPublic = false;
    }
    const updated = await this.prisma.feedback.update({ where: { id }, data: body });
    if (body.status && body.status !== fb.status) {
      const voters = await this.prisma.feedbackVote.findMany({ where: { feedbackId: id }, select: { userId: true } });
      const ids = [...new Set([fb.userId, ...voters.map((v) => v.userId)].filter(Boolean))] as string[];
      await this.notifications.notify(ids, { kind: 'SYSTEM', title: `${body.status === 'DONE' ? '🚀' : '📌'} "${fb.title}" → ${FEEDBACK_STATUS_LABELS[body.status]}`, body: body.adminReply ?? undefined, link: `/feedback/${id}` });
    }
    await this.audit.log(user, 'feedback.update', 'Feedback', id, body);
    return updated;
  }

  @Roles('SUPER_ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.feedback.delete({ where: { id } });
    return { ok: true };
  }
}
