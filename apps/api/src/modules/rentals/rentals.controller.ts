import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { inspectionSchema, otpSchema, ownerPaymentSchema, rentPaymentSchema, signStartSchema, tenancyRentSchema, type InspectionInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Feature, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';
import { RentService } from './rent.service';
import { InspectionService } from './inspection.service';
import { EsignService } from './esign.service';
import { FairRentService } from './fair-rent.service';
import { ShortlistService } from './shortlist.service';

const partySchema = z.object({ party: z.enum(['LANDLORD', 'TENANT']) });
const confirmSchema = otpSchema.extend({ party: z.enum(['LANDLORD', 'TENANT']) });
const meta = (req: Request) => ({
  ip: (String(req.headers['x-forwarded-for'] ?? '').split(',')[0] || req.ip)?.trim(),
  ua: String(req.headers['user-agent'] ?? ''),
});
const pdfOut = (res: Response, name: string, buf: Buffer) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.send(buf);
};

/** Tenant & owner tools: rent reminders/receipts, move-in/out checklist, agreement OTP-sign, fair rent, compare, shared shortlist. */
@ApiTags('rentals')
@Controller()
export class RentalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rent: RentService,
    private readonly inspections: InspectionService,
    private readonly esign: EsignService,
    private readonly fair: FairRentService,
    private readonly shortlist: ShortlistService,
  ) {}

  // ------------------------------------------------------------------ owner payment details
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Patch('broker/owners/:id/payment')
  async ownerPayment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ownerPaymentSchema)) body: z.infer<typeof ownerPaymentSchema>,
  ) {
    const o = await this.prisma.owner.findFirst({ where: { id, organizationId: requireOrg(user) } });
    if (!o) throw new NotFoundException('Owner नहीं मिला');
    return this.prisma.owner.update({
      where: { id },
      data: {
        ...(body.upiId !== undefined ? { upiId: body.upiId || null } : {}),
        ...(body.pan !== undefined ? { pan: body.pan || null } : {}),
        ...(body.email !== undefined ? { email: body.email?.toLowerCase() || null } : {}),
      },
    });
  }

  // ------------------------------------------------------------------ rent
  @Feature('rent_tracker')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/tenancies/:id/rent')
  ledger(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.rent.ledger(requireOrg(user), id);
  }

  @Feature('rent_tracker')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Patch('broker/tenancies/:id/rent')
  rentSettings(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(tenancyRentSchema)) body: z.infer<typeof tenancyRentSchema>) {
    return this.rent.settings(requireOrg(user), id, body);
  }

  @Feature('rent_tracker')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('broker/tenancies/:id/rent-payments')
  markPaid(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(rentPaymentSchema)) body: z.infer<typeof rentPaymentSchema>) {
    return this.rent.markPaid(requireOrg(user), user.id, id, body);
  }

  @Feature('rent_tracker')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Delete('broker/rent-payments/:id')
  removePayment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.rent.removePayment(requireOrg(user), id);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/rent-receipts/:token/pdf')
  async receipt(@Param('token') token: string, @Res() res: Response) {
    pdfOut(res, 'rent-receipt.pdf', await this.rent.receiptPdf(token));
  }

  @Feature('rent_tracker')
  @Get('me/rent')
  myRent(@CurrentUser() user: RequestUser) {
    return this.rent.mine(user.id);
  }

  // ------------------------------------------------------------------ move-in / move-out checklist
  @Feature('inspections')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/tenancies/:id/inspections')
  inspectionsList(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.inspections.list(requireOrg(user), id);
  }

  @Feature('inspections')
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Put('broker/tenancies/:id/inspections')
  inspectionSave(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(inspectionSchema)) body: InspectionInput) {
    return this.inspections.save(requireOrg(user), user.id, id, body);
  }

  @Public()
  @Feature('inspections')
  @Get('public/inspections/:token')
  inspectionView(@Param('token') token: string) {
    return this.inspections.view(token);
  }

  @Public()
  @Feature('inspections')
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('public/inspections/:token/otp')
  inspectionOtp(@Param('token') token: string, @Body(new ZodPipe(partySchema)) body: z.infer<typeof partySchema>) {
    return this.inspections.requestOtp(token, body.party);
  }

  @Public()
  @Feature('inspections')
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @Post('public/inspections/:token/confirm')
  inspectionConfirm(@Param('token') token: string, @Body(new ZodPipe(confirmSchema)) body: z.infer<typeof confirmSchema>, @Req() req: Request) {
    return this.inspections.confirm(token, body.party, body.otp, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/inspections/:token/pdf')
  async inspectionPdf(@Param('token') token: string, @Res() res: Response) {
    pdfOut(res, 'inspection.pdf', await this.inspections.pdf(token));
  }

  // ------------------------------------------------------------------ agreement OTP-sign
  @Feature('agreement_esign')
  @Post('agreements/:id/sign')
  signStart(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(signStartSchema)) body: z.infer<typeof signStartSchema>) {
    return this.esign.start(user.id, id, body);
  }

  @Public()
  @Feature('agreement_esign')
  @Get('public/sign/:token')
  signView(@Param('token') token: string) {
    return this.esign.view(token);
  }

  @Public()
  @Feature('agreement_esign')
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('public/sign/:token/otp')
  signOtp(@Param('token') token: string) {
    return this.esign.requestOtp(token);
  }

  @Public()
  @Feature('agreement_esign')
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @Post('public/sign/:token/confirm')
  signConfirm(@Param('token') token: string, @Body(new ZodPipe(otpSchema)) body: z.infer<typeof otpSchema>, @Req() req: Request) {
    return this.esign.confirm(token, body.otp, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/sign/:token/pdf')
  async signPdf(@Param('token') token: string, @Res() res: Response) {
    pdfOut(res, 'rent-agreement.pdf', await this.esign.pdf(token));
  }

  // ------------------------------------------------------------------ fair rent
  @Public()
  @Feature('fair_rent')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('public/fair-rent')
  fairRent(
    @Query('localityId') localityId: string,
    @Query('bedrooms') bedrooms: string,
    @Query('furnishing') furnishing?: string,
    @Query('price') price?: string,
  ) {
    const b = Number(bedrooms);
    if (!localityId || !Number.isInteger(b) || b < 1 || b > 10) throw new NotFoundException('Locality और BHK चुनें');
    return this.fair.estimate({ localityId, bedrooms: b, furnishing: furnishing || null, price: Number(price) || null });
  }

  // ------------------------------------------------------------------ compare & shared shortlist
  @Public()
  @Feature('compare_shortlist')
  @Get('public/compare')
  compare(@Query('ids') ids = '') {
    return this.shortlist.compare(ids.split(',').filter(Boolean));
  }

  @Feature('compare_shortlist')
  @Post('me/shortlist/share')
  shareShortlist(@CurrentUser() user: RequestUser) {
    return this.shortlist.share(user.id);
  }

  @Feature('compare_shortlist')
  @Delete('me/shortlist/share')
  unshareShortlist(@CurrentUser() user: RequestUser) {
    return this.shortlist.revoke(user.id);
  }

  @Public()
  @Feature('compare_shortlist')
  @Get('public/shortlist/:token')
  sharedShortlist(@Param('token') token: string) {
    return this.shortlist.view(token);
  }
}
