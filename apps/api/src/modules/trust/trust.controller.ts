import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { phoneSchema } from '@brokeriq/shared';
import { TrustService } from './trust.service';
import { VisitBookingService } from './visit-booking.service';
import { CurrentUser, Public, Roles, type RequestUser, Feature } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const slotsSchema = z.object({ days: z.array(z.number().int().min(0).max(6)).min(1).max(7), start: hhmm, end: hhmm, slotMinutes: z.number().int(), maxPerSlot: z.number().int().min(1).max(10) });
const bookSchema = z.object({ at: z.string().datetime(), name: z.string().trim().min(2).max(80).optional().nullable(), phone: phoneSchema.optional().nullable(), note: z.string().max(300).optional().nullable() });
const rating = z.number().int().min(1).max(5);
const reviewSchema = z.object({ societyName: z.string().trim().max(80).optional().nullable(), water: rating, power: rating, safety: rating, parking: rating, connectivity: rating, maintenance: rating, pros: z.string().max(800).optional().nullable(), cons: z.string().max(800).optional().nullable(), isResident: z.boolean().default(true), livedYears: z.number().int().min(0).max(60).optional().nullable() });
const tokenSchema = z.object({ amount: z.number().min(100).max(10_000_000), mode: z.enum(['UPI', 'CASH', 'BANK', 'OTHER']).default('UPI'), ref: z.string().max(80).optional().nullable(), notes: z.string().max(300).optional().nullable() });
const photoSchema = z.object({ photos: z.array(z.object({ url: z.string().url(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).min(1).max(12) });

@ApiTags('trust')
@Controller()
export class TrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly booking: VisitBookingService,
  ) {}

  // ------------------------------------------------------------------ visit slot booking
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Feature('slot_booking')
  @Get('broker/visit-slots')
  getSlots(@CurrentUser() user: RequestUser) {
    return this.booking.getSettings(user);
  }

  @Roles('BROKER_ADMIN')
  @Feature('slot_booking')
  @Patch('broker/visit-slots')
  saveSlots(@CurrentUser() user: RequestUser, @Body(new ZodPipe(slotsSchema)) body: any) {
    return this.booking.saveSettings(user, body);
  }

  @Public()
  @Feature('slot_booking')
  @Get('listings/:id/slots')
  slots(@Param('id') id: string, @Query('days') days?: string) {
    return this.booking.slots(id, Number(days) || 7);
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Feature('slot_booking')
  @Post('listings/:id/book-visit')
  book(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(bookSchema)) body: any) {
    return this.booking.book(user, id, body);
  }

  @Feature('slot_booking')
  @Get('me/visits')
  myVisits(@CurrentUser() user: RequestUser) {
    return this.booking.myVisits(user.id);
  }

  @Feature('slot_booking')
  @Patch('me/visits/:id/cancel')
  cancelVisit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.booking.cancelMine(user.id, id);
  }

  // ------------------------------------------------------------------ visit verification (BrokerIQ team)
  @Roles('SUPER_ADMIN')
  @Get('admin/visit-verification')
  queue(@Query('near') near?: string) {
    return this.trust.verificationQueue(near);
  }

  @Roles('SUPER_ADMIN')
  @Post('admin/listings/:id/visit-verify')
  verify(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(photoSchema)) body: any) {
    return this.trust.verifyVisit(user, id, body.photos);
  }

  @Roles('SUPER_ADMIN')
  @Delete('admin/listings/:id/visit-verify')
  unverify(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.trust.removeVisitVerification(user, id);
  }

  // ------------------------------------------------------------------ verified tenant
  @Get('me/tenant-profile')
  tenantProfile(@CurrentUser() user: RequestUser) {
    return this.trust.tenantProfile(user.id);
  }

  @Patch('me/tenant-profile')
  updateTenantProfile(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ occupation: z.string().max(60).optional().nullable(), employer: z.string().max(80).optional().nullable() }))) body: any) {
    return this.trust.updateTenantProfile(user.id, body);
  }

  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post('me/work-email')
  workEmail(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ email: z.string().email() }))) body: { email: string }) {
    return this.trust.requestWorkEmail(user.id, body.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post('me/work-email/verify')
  verifyWorkEmail(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ code: z.string().regex(/^\d{6}$/) }))) body: { code: string }) {
    return this.trust.verifyWorkEmail(user.id, body.code);
  }

  // ------------------------------------------------------------------ locality / society reviews
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Feature('locality_reviews')
  @Post('localities/:slug/reviews')
  review(@CurrentUser() user: RequestUser, @Param('slug') slug: string, @Body(new ZodPipe(reviewSchema)) body: any) {
    return this.trust.submitReview(user, slug, body);
  }

  @Public()
  @Feature('locality_reviews')
  @Get('public/localities/:slug/reviews')
  reviews(@Param('slug') slug: string, @Query('society') society?: string) {
    return this.trust.publicReviews(slug, society);
  }

  @Roles('SUPER_ADMIN')
  @Get('admin/locality-reviews')
  adminReviews(@Query('status') status?: string) {
    return this.trust.adminReviews(status);
  }

  @Roles('SUPER_ADMIN')
  @Patch('admin/locality-reviews/:id')
  moderate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['APPROVED', 'REJECTED']) }))) body: any) {
    return this.trust.moderateReview(user, id, body.status);
  }

  // ------------------------------------------------------------------ token record
  @Feature('visit_tokens')
  @Get('listings/:id/token-info')
  tokenInfo(@Param('id') id: string) {
    return this.trust.tokenInfo(id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Feature('visit_tokens')
  @Post('listings/:id/token')
  claimToken(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(tokenSchema)) body: any) {
    return this.trust.claimToken(user, id, body);
  }

  @Feature('visit_tokens')
  @Get('me/tokens')
  myTokens(@CurrentUser() user: RequestUser) {
    return this.trust.myTokens(user.id);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Feature('visit_tokens')
  @Get('broker/tokens')
  brokerTokens(@CurrentUser() user: RequestUser) {
    return this.trust.brokerTokens(user);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Feature('visit_tokens')
  @Patch('broker/tokens/:id')
  markToken(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['RECEIVED', 'REFUNDED', 'CANCELLED']), notes: z.string().max(300).optional().nullable() }))) body: any) {
    return this.trust.markToken(user, id, body.status, body.notes);
  }
}
