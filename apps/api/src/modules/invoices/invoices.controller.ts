import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { phoneSchema } from '@brokeriq/shared';
import { InvoicesService } from './invoices.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';

const invoiceSchema = z.object({
  dealId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  clientName: z.string().trim().max(80).default(''),
  clientPhone: phoneSchema.optional().nullable(),
  clientEmail: z.string().email().optional().nullable().or(z.literal('')),
  items: z
    .array(z.object({ description: z.string().trim().min(2).max(160), amount: z.number().min(0) }))
    .min(1)
    .max(20),
  gstPct: z.number().min(0).max(28).default(0),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
const paymentSettingsSchema = z.object({
  upiId: z.string().max(100).optional().nullable(),
  upiName: z.string().max(60).optional().nullable(),
  invoicePrefix: z.string().max(12).optional().nullable(),
  weeklyReport: z.boolean().optional(),
});

@ApiTags('invoices')
@Controller()
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/payment-settings')
  settings(@CurrentUser() user: RequestUser) {
    return this.svc.paymentSettings(requireOrg(user));
  }

  @Roles('BROKER_ADMIN')
  @Patch('broker/payment-settings')
  updateSettings(@CurrentUser() user: RequestUser, @Body(new ZodPipe(paymentSettingsSchema)) body: z.infer<typeof paymentSettingsSchema>) {
    return this.svc.updatePaymentSettings(requireOrg(user), body);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/invoices')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.svc.list(user, status);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/invoices/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Post('broker/invoices')
  create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(invoiceSchema)) body: z.infer<typeof invoiceSchema>) {
    return this.svc.create(user, body);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Patch('broker/invoices/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(
      new ZodPipe(
        z.object({
          status: z.enum(['SENT', 'PAID', 'CANCELLED']).optional(),
          paidMode: z.string().max(30).optional().nullable(),
          paidRef: z.string().max(80).optional().nullable(),
          paidAt: z.coerce.date().optional().nullable(),
          dueDate: z.coerce.date().optional().nullable(),
          notes: z.string().max(1000).optional().nullable(),
        }),
      ),
    )
    body: any,
  ) {
    return this.svc.update(user, id, body);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('broker/invoices/:id/send')
  send(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.send(user, id);
  }

  // ------------------------------------------------------------------ public client page
  @Public()
  @Get('public/invoices/:token')
  view(@Param('token') token: string) {
    return this.svc.publicView(token);
  }

  @Public()
  @Get('public/invoices/:token/qr')
  async qr(@Param('token') token: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(await this.svc.qrPng(token));
  }

  @Public()
  @Get('public/invoices/:token/pdf')
  async pdf(@Param('token') token: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice.pdf"`);
    res.send(await this.svc.pdf(token));
  }
}
