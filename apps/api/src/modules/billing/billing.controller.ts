import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { BillingService } from './billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('billing/plans')
  plans() {
    return this.billing.publicPlans();
  }

  @Roles('BROKER_ADMIN')
  @Get('broker/billing')
  overview(@CurrentUser() user: RequestUser) {
    return this.billing.overview(requireOrg(user));
  }

  @Roles('BROKER_ADMIN')
  @Post('broker/billing/checkout')
  checkout(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ planCode: z.string(), cycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'), coupon: z.string().optional() }))) body: any) {
    return this.billing.checkout(user, requireOrg(user), body);
  }

  @Post('billing/boost')
  boost(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ listingId: z.string(), weeks: z.number().int().min(1).max(12).default(1) }))) body: any) {
    return this.billing.boostCheckout(user, body.listingId, body.weeks);
  }

  @HttpCode(200)
  @Post('billing/verify')
  verify(@Body(new ZodPipe(z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }))) body: any) {
    return this.billing.verify(body);
  }

  @Roles('BROKER_ADMIN')
  @Post('broker/billing/cancel')
  cancel(@CurrentUser() user: RequestUser, @Body() body: { cancel?: boolean }) {
    return this.billing.cancel(requireOrg(user), body?.cancel !== false);
  }

  @Get('billing/payments/:id/invoice')
  async invoice(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() res: Response) {
    const p = await this.prisma.payment.findFirst({ where: { id, ...(user.role === 'SUPER_ADMIN' ? {} : { OR: [{ userId: user.id }, ...(user.orgId ? [{ organizationId: user.orgId }] : [])] }) } });
    if (!p) throw new NotFoundException();
    const pdf = await this.billing.invoicePdf(p);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${p.invoiceNumber}.pdf"`);
    res.send(pdf);
  }

  @Public()
  @HttpCode(200)
  @Post('billing/razorpay/webhook')
  webhook(@Req() req: any, @Body() body: any) {
    return this.billing.webhook(req.rawBody, req.headers['x-razorpay-signature'], body);
  }
}
