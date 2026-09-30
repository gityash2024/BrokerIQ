import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { normalizeIndianPhone, pushTokenSchema, savedSearchSchema, updateProfileSchema } from '@brokeriq/shared';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  @Get('saved-searches')
  savedSearches(@CurrentUser() user: RequestUser) {
    return this.prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  }

  @Post('saved-searches')
  async createSavedSearch(@CurrentUser() user: RequestUser, @Body(new ZodPipe(savedSearchSchema)) body: any) {
    const count = await this.prisma.savedSearch.count({ where: { userId: user.id } });
    if (count >= 20) throw new NotFoundException('ज़्यादा से ज़्यादा 20 saved searches');
    return this.prisma.savedSearch.create({ data: { userId: user.id, name: body.name, filters: body.filters as Prisma.InputJsonValue, alertsEnabled: body.alertsEnabled, lastNotifiedAt: new Date() } });
  }

  @Patch('saved-searches/:id')
  async updateSavedSearch(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(savedSearchSchema.partial())) body: any) {
    const s = await this.prisma.savedSearch.findFirst({ where: { id, userId: user.id } });
    if (!s) throw new NotFoundException();
    return this.prisma.savedSearch.update({ where: { id }, data: { ...body, filters: body.filters as Prisma.InputJsonValue | undefined } });
  }

  @Delete('saved-searches/:id')
  async deleteSavedSearch(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.prisma.savedSearch.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  }

  @Delete()
  /**
   * Deletes the account (Play Store / DPDP): personal data, saved items, requirements, location/contacts,
   * push tokens and KYC files are removed; the user's own (owner) listings are archived; the user row is
   * kept anonymised so enquiries, deals and invoices of brokers stay consistent.
   */
  async deleteAccount(@CurrentUser() user: RequestUser) {
    const id = user.id;
    await this.prisma.$transaction([
      this.prisma.userLocation.deleteMany({ where: { userId: id } }),
      this.prisma.userContact.deleteMany({ where: { userId: id } }),
      this.prisma.pushToken.deleteMany({ where: { userId: id } }),
      this.prisma.savedListing.deleteMany({ where: { userId: id } }),
      this.prisma.recentView.deleteMany({ where: { userId: id } }),
      this.prisma.savedSearch.deleteMany({ where: { userId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      this.prisma.tenantRequirement.deleteMany({ where: { userId: id } }),
      this.prisma.flatmateConnect.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
      this.prisma.flatmateProfile.deleteMany({ where: { userId: id } }),
      this.prisma.kycDocument.deleteMany({ where: { userId: id } }),
      this.prisma.listing.updateMany({ where: { postedById: id, organizationId: null, deletedAt: null }, data: { status: 'ARCHIVED' } }),
      this.prisma.user.update({
        where: { id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          name: 'Deleted user',
          email: `deleted+${id}@brokeriq.invalid`,
          phone: null,
          googleId: null,
          passwordHash: null,
          avatarUrl: null,
          occupation: null,
          employer: null,
          workEmail: null,
          workEmailVerifiedAt: null,
          tenantVerifiedAt: null,
        },
      }),
    ]);
    await this.auth.revokeAll(id);
    return { ok: true };
  }
}
