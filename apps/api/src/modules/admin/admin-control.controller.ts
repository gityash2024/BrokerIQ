import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { listingUpdateSchema } from '@brokeriq/shared';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ListingsService } from '../listings/listings.service';
import { AdminControlService } from './admin-control.service';

const reasonSchema = z.object({ reason: z.string().trim().min(3, 'कारण लिखें').max(500) });
const restrictionsSchema = z.object({ restrictions: z.array(z.string().max(30)).max(10) });
const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  action: z.enum(['block', 'unblock', 'approve', 'reject', 'delete', 'restore', 'verify', 'unverify', 'feature', 'unfeature']),
  reason: z.string().max(500).optional(),
});

/**
 * Staff controls. Who can do what:
 *  - MODERATOR: listings (block/unblock/status/edit/bulk), user blocks & restrictions, reviews, flatmates, blocklist.
 *  - SUPPORT: look up users/firms, force logout, send password reset.
 *  - SUPER_ADMIN: everything, plus deleting users, firm blocks/restrictions/members and listing transfers.
 */
@ApiTags('admin')
@Controller('admin')
export class AdminControlController {
  constructor(
    private readonly svc: AdminControlService,
    private readonly listings: ListingsService,
  ) {}

  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('pending')
  pending() {
    return this.svc.pendingCounts();
  }

  // ------------------------------------------------------------------ listings
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('listings/:id/block')
  block(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) b: { reason: string }) {
    return this.svc.blockListing(u, id, b.reason);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('listings/:id/unblock')
  unblock(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.unblockListing(u, id);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('listings/:id/status')
  status(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ status: z.enum(['ACTIVE', 'RENTED', 'EXPIRED', 'ARCHIVED']) }))) b: { status: 'ACTIVE' | 'RENTED' | 'EXPIRED' | 'ARCHIVED' },
  ) {
    return this.svc.setListingStatus(u, id, b.status);
  }

  /** Edit any field of any listing (runs the normal update with admin rights). */
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Patch('listings/:id')
  edit(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(listingUpdateSchema)) body: any) {
    return this.listings.update(id, body, { ...u, role: 'SUPER_ADMIN' });
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Delete('listings/:id')
  remove(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.deleteListing(u, id);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('listings/:id/restore')
  restore(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.restoreListing(u, id);
  }

  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  @Post('listings/:id/transfer')
  transfer(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ organizationId: z.string().nullable().optional(), postedById: z.string().optional() })))
    b: { organizationId?: string | null; postedById?: string },
  ) {
    return this.svc.transferListing(u, id, b);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('listings/bulk')
  bulk(@CurrentUser() u: RequestUser, @Body(new ZodPipe(bulkSchema)) b: z.infer<typeof bulkSchema>) {
    return this.svc.bulkListings(u, b.ids, b.action, b.reason);
  }

  // ------------------------------------------------------------------ users
  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.svc.userOverview(id);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('users/:id/block')
  blockUser(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) b: { reason: string }) {
    return this.svc.blockUser(u, id, b.reason);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @HttpCode(200)
  @Post('users/:id/unblock')
  unblockUser(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.unblockUser(u, id);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @HttpCode(200)
  @Post('users/:id/logout')
  logout(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.forceLogout(u, id);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT')
  @HttpCode(200)
  @Post('users/:id/password-reset')
  reset(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.sendPasswordReset(u, id);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Patch('users/:id/restrictions')
  userRestrictions(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(restrictionsSchema)) b: { restrictions: string[] }) {
    return this.svc.setUserRestrictions(u, id, b.restrictions);
  }

  @Roles('SUPER_ADMIN')
  @Delete('users/:id')
  deleteUser(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.deleteUser(u, id);
  }

  // ------------------------------------------------------------------ broker firms
  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  @Post('organizations/:id/block')
  blockOrg(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) b: { reason: string }) {
    return this.svc.blockOrg(u, id, b.reason);
  }

  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  @Post('organizations/:id/unblock')
  unblockOrg(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.unblockOrg(u, id);
  }

  @Roles('SUPER_ADMIN')
  @Patch('organizations/:id/restrictions')
  orgRestrictions(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(restrictionsSchema)) b: { restrictions: string[] }) {
    return this.svc.setOrgRestrictions(u, id, b.restrictions);
  }

  @Roles('SUPER_ADMIN')
  @Delete('organizations/:id/members/:userId')
  removeMember(@CurrentUser() u: RequestUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeMember(u, id, userId);
  }

  // ------------------------------------------------------------------ blocklist
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Get('blocklist')
  blocklist() {
    return this.svc.listBlocklist();
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Post('blocklist')
  addBlock(
    @CurrentUser() u: RequestUser,
    @Body(
      new ZodPipe(
        z.object({ kind: z.enum(['EMAIL', 'PHONE', 'DOMAIN', 'IP']), value: z.string().trim().min(3).max(200), reason: z.string().max(300).optional() }),
      ),
    )
    b: any,
  ) {
    return this.svc.addBlock(u, b.kind, b.value, b.reason);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Delete('blocklist/:id')
  removeBlock(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.removeBlock(u, id);
  }

  // ------------------------------------------------------------------ content
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Get('reviews')
  reviews(@Query('status') status?: 'PUBLISHED' | 'HIDDEN') {
    return this.svc.listReviews(status);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Patch('reviews/:id')
  reviewStatus(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']) }))) b: { status: 'PUBLISHED' | 'HIDDEN' },
  ) {
    return this.svc.setReviewStatus(u, id, b.status);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Delete('reviews/:id')
  deleteReview(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.deleteReview(u, id);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Get('flatmates')
  flatmates(@Query('active') active?: string) {
    return this.svc.listFlatmates(active === undefined ? undefined : active === 'true');
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Patch('flatmates/:id')
  flatmate(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ isActive: z.boolean() }))) b: { isActive: boolean }) {
    return this.svc.setFlatmateActive(u, id, b.isActive);
  }
}
