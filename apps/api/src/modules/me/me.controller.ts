import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { normalizeIndianPhone, pushTokenSchema, updateProfileSchema } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { MediaService, type UploadKind } from '../../core/media/media.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly media: MediaService,
  ) {}

  @Patch()
  async update(@CurrentUser() user: RequestUser, @Body(new ZodPipe(updateProfileSchema)) body: any) {
    if (body.phone) body.phone = normalizeIndianPhone(body.phone) ?? body.phone;
    await this.prisma.user.update({ where: { id: user.id }, data: body });
    return this.auth.me(user.id);
  }

  @Post('push-tokens')
  async addPush(@CurrentUser() user: RequestUser, @Body(new ZodPipe(pushTokenSchema)) body: any) {
    await this.prisma.pushToken.upsert({ where: { token: body.token }, create: { ...body, userId: user.id }, update: { userId: user.id, platform: body.platform } });
    return { ok: true };
  }

  @Delete('push-tokens/:token')
  async removePush(@CurrentUser() user: RequestUser, @Param('token') token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId: user.id } });
    return { ok: true };
  }

  @Get('notifications')
  async notifications(@CurrentUser() user: RequestUser, @Query('unread') unread?: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId: user.id, ...(unread === 'true' ? { readAt: null } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  @Post('notifications/read')
  async markRead(@CurrentUser() user: RequestUser, @Body() body: { ids?: string[] }) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null, ...(body?.ids?.length ? { id: { in: body.ids } } : {}) }, data: { readAt: new Date() } });
    return { ok: true };
  }

  /** Signed direct upload (Cloudinary / S3). */
  @Post('uploads/sign')
  sign(@CurrentUser() user: RequestUser, @Body() body: { kind?: UploadKind; contentType?: string }) {
    const kind = (['listing', 'avatar', 'logo', 'kyc', 'project', 'cms', 'scan', 'chat'] as const).includes(body?.kind as any) ? body.kind! : 'listing';
    return this.media.sign(kind, body?.contentType ?? 'image/jpeg', user.orgId ?? user.id);
  }

  @Delete()
  async deleteAccount(@CurrentUser() user: RequestUser) {
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'DELETED', deletedAt: new Date(), email: `deleted+${user.id}@brokeriq.invalid`, phone: null, googleId: null, passwordHash: null } });
    await this.auth.revokeAll(user.id);
    return { ok: true };
  }
}
