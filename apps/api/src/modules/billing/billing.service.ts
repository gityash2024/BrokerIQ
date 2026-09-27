import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHmac, timingSafeEqual } from 'crypto';
import PDFDocument from 'pdfkit';
import { Prisma, type Payment } from '@prisma/client';
import { formatINR } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { MailService } from '../../core/mail/mail.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuditService } from '../../core/audit/audit.service';
import { UsageService } from '../../core/usage/usage.service';
import { IntegrationFailedException } from '../../common/exceptions';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly usage: UsageService,
  ) {}

  publicPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async overview(orgId: string) {
    const [sub, payments, limits] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } }),
      this.prisma.payment.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.usage.limits(orgId),
    ]);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [agents, activeListings, leadsPerMonth, aiCredits, automations, connectors] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.lead.count({ where: { organizationId: orgId, createdAt: { gte: monthStart } } }),
      this.usage.count(orgId, 'ai'),
      this.prisma.automationRule.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.connectorState.count({ where: { organizationId: orgId, status: { not: 'DISABLED' }, type: { in: ['EMAIL_INBOX', 'META_LEAD_ADS'] } } }),
    ]);
    const app = await this.settings.getAppConfig();
    return {
      subscription: sub,
      payments,
      limits,
      usage: { agents, activeListings, leadsPerMonth, aiCredits, automations, connectors },
      gstPercent: app.monetization.gstPercent,
      razorpayReady: await this.settings.isConfigured('razorpay'),
    };
  }

  private async rzp() {
    return this.settings.require('razorpay', null, 'Online payment अभी उपलब्ध नहीं है — Super Admin → Settings → Integrations → Razorpay में keys जोड़ें।');
  }

  private async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
    const v = await this.rzp();
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${v.keyId}:${v.keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new IntegrationFailedException('razorpay', data?.error?.description ?? `HTTP ${res.status}`);
    return { order: data, keyId: String(v.keyId) };
  }

  private async applyCoupon(code: string | undefined, amount: number) {
    if (!code) return { amount, coupon: null };
    const c = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!c || !c.isActive || (c.validUntil && c.validUntil < new Date()) || (c.maxRedemptions && c.redeemed >= c.maxRedemptions)) throw new BadRequestException('Coupon valid नहीं है');
    const off = c.percentOff ? (amount * c.percentOff) / 100 : (c.amountOff ?? 0);
    return { amount: Math.max(0, Math.round(amount - off)), coupon: c.code };
  }

  async checkout(user: RequestUser, orgId: string, input: { planCode: string; cycle: 'MONTHLY' | 'YEARLY'; coupon?: string }) {
    const plan = await this.prisma.plan.findFirst({ where: { code: input.planCode, isActive: true } });
    if (!plan) throw new NotFoundException('Plan नहीं मिला');
    const base = input.cycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    if (base <= 0) throw new BadRequestException('Free plan के लिए payment नहीं चाहिए');
    const app = await this.settings.getAppConfig();
    const { amount, coupon } = await this.applyCoupon(input.coupon, base);
    const total = Math.round(amount * (1 + app.monetization.gstPercent / 100));
    const payment = await this.prisma.payment.create({ data: { organizationId: orgId, userId: user.id, purpose: 'SUBSCRIPTION', planId: plan.id, billingCycle: input.cycle, amount: total * 100, couponCode: coupon, meta: { base, discounted: amount, gstPercent: app.monetization.gstPercent } } });
    const { order, keyId } = await this.createOrder(total * 100, payment.id, { paymentId: payment.id, orgId, plan: plan.code });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { razorpayOrderId: order.id } });
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return { keyId, orderId: order.id, amount: total * 100, currency: 'INR', name: app.siteName, description: `${plan.name} plan (${input.cycle.toLowerCase()})`, prefill: { name: u.name, email: u.email, contact: u.phone ?? '' } };
  }

  async boostCheckout(user: RequestUser, listingId: string, weeks: number) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null, status: 'ACTIVE', OR: [{ postedById: user.id }, ...(user.orgId ? [{ organizationId: user.orgId }] : [])] } });
    if (!listing) throw new NotFoundException('Live listing नहीं मिली');
    const app = await this.settings.getAppConfig();
    const total = Math.round(app.monetization.boostPricePerWeek * weeks * (1 + app.monetization.gstPercent / 100));
    const payment = await this.prisma.payment.create({ data: { organizationId: user.orgId, userId: user.id, purpose: 'BOOST', listingId, amount: total * 100, meta: { weeks } } });
    const { order, keyId } = await this.createOrder(total * 100, payment.id, { paymentId: payment.id, listingId });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { razorpayOrderId: order.id } });
    return { keyId, orderId: order.id, amount: total * 100, currency: 'INR', name: app.siteName, description: `Featured boost · ${weeks} week(s)` };
  }

  async verify(input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const v = await this.rzp();
    const expected = createHmac('sha256', String(v.keySecret)).update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`).digest('hex');
    if (expected.length !== input.razorpay_signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(input.razorpay_signature))) throw new BadRequestException('Payment verification failed');
    return this.markPaid(input.razorpay_order_id, input.razorpay_payment_id);
  }

  async webhook(rawBody: Buffer | undefined, signature: string | undefined, body: any) {
    const v = await this.rzp();
    const expected = createHmac('sha256', String(v.webhookSecret)).update(rawBody ?? Buffer.from('')).digest('hex');
    if (!signature || expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new BadRequestException('bad signature');
    await this.prisma.webhookEvent.create({ data: { provider: 'razorpay', payload: body as Prisma.InputJsonValue, externalId: body?.payload?.payment?.entity?.id } });
    const entity = body?.payload?.payment?.entity;
    if ((body.event === 'payment.captured' || body.event === 'order.paid') && entity?.order_id) await this.markPaid(entity.order_id, entity.id);
    if (body.event === 'payment.failed' && entity?.order_id) await this.prisma.payment.updateMany({ where: { razorpayOrderId: entity.order_id, status: 'CREATED' }, data: { status: 'FAILED' } });
    return { ok: true };
  }

  /** Idempotent: activates subscription / boost once. */
  private async markPaid(orderId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
    if (!payment) throw new NotFoundException('Order not found');
    if (payment.status === 'PAID') return { ok: true, payment };
    const app = await this.settings.getAppConfig();
    const seq = await this.prisma.payment.count({ where: { status: 'PAID' } });
    const invoiceNumber = `${app.monetization.invoicePrefix}-${new Date().getFullYear()}-${String(seq + 1).padStart(5, '0')}`;
    const paid = await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', razorpayPaymentId: paymentId, paidAt: new Date(), invoiceNumber } });
    if (payment.couponCode) await this.prisma.coupon.update({ where: { code: payment.couponCode }, data: { redeemed: { increment: 1 } } }).catch(() => undefined);

    if (payment.purpose === 'SUBSCRIPTION' && payment.organizationId && payment.planId) {
      const current = await this.prisma.subscription.findUnique({ where: { organizationId: payment.organizationId } });
      const start = current?.planId === payment.planId && current.currentPeriodEnd && current.currentPeriodEnd > new Date() ? current.currentPeriodEnd : new Date();
      const end = new Date(start);
      if (payment.billingCycle === 'YEARLY') end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);
      await this.prisma.subscription.upsert({
        where: { organizationId: payment.organizationId },
        create: { organizationId: payment.organizationId, planId: payment.planId, status: 'ACTIVE', billingCycle: payment.billingCycle ?? 'MONTHLY', currentPeriodStart: new Date(), currentPeriodEnd: end },
        update: { planId: payment.planId, status: 'ACTIVE', billingCycle: payment.billingCycle ?? 'MONTHLY', currentPeriodStart: new Date(), currentPeriodEnd: end, cancelAtPeriodEnd: false, trialEndsAt: null },
      });
      await this.notifications.notifyOrg(payment.organizationId, { kind: 'SYSTEM', title: '✅ Subscription active', body: `Valid till ${end.toLocaleDateString('en-IN')}`, link: '/broker/billing' }, { adminsOnly: true });
    }
    if (payment.purpose === 'BOOST' && payment.listingId) {
      const weeks = Number((payment.meta as any)?.weeks ?? 1);
      const l = await this.prisma.listing.findUnique({ where: { id: payment.listingId } });
      const from = l?.featuredUntil && l.featuredUntil > new Date() ? l.featuredUntil : new Date();
      await this.prisma.listing.update({ where: { id: payment.listingId }, data: { isFeatured: true, featuredUntil: new Date(from.getTime() + weeks * 7 * 86400_000) } });
    }
    const user = payment.userId ? await this.prisma.user.findUnique({ where: { id: payment.userId } }) : null;
    const plan = payment.planId ? await this.prisma.plan.findUnique({ where: { id: payment.planId } }) : null;
    if (user) this.mail.trySendTemplate('payment.receipt', user.email, { amount: formatINR(payment.amount / 100, false), invoiceNumber, plan: plan?.name ?? 'Boost' }).catch(() => undefined);
    await this.audit.log({ id: payment.userId ?? undefined, orgId: payment.organizationId }, 'payment.paid', 'Payment', payment.id, { amount: payment.amount });
    return { ok: true, payment: paid };
  }

  async cancel(orgId: string, cancel: boolean) {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!sub) throw new NotFoundException();
    return this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel } });
  }

  /** Branded GST invoice PDF. */
  async invoicePdf(payment: Payment): Promise<Buffer> {
    if (payment.status !== 'PAID') throw new BadRequestException('Invoice सिर्फ paid payments का बनता है');
    const app = await this.settings.getAppConfig();
    const org = payment.organizationId ? await this.prisma.organization.findUnique({ where: { id: payment.organizationId } }) : null;
    const plan = payment.planId ? await this.prisma.plan.findUnique({ where: { id: payment.planId } }) : null;
    const meta = (payment.meta ?? {}) as any;
    const total = payment.amount / 100;
    const gstPct = Number(meta.gstPercent ?? app.monetization.gstPercent);
    const taxable = Math.round((total / (1 + gstPct / 100)) * 100) / 100;
    const gst = Math.round((total - taxable) * 100) / 100;
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fillColor(app.primaryColor).fontSize(22).text(app.monetization.companyName || app.siteName, { continued: false });
      doc.fillColor('#475569').fontSize(9).text(app.monetization.companyAddress || '').text(app.monetization.companyGstin ? `GSTIN: ${app.monetization.companyGstin}` : '');
      doc.moveDown().fillColor('#0f172a').fontSize(16).text('TAX INVOICE', { align: 'right' });
      doc.fontSize(10).text(`Invoice #: ${payment.invoiceNumber}`, { align: 'right' }).text(`Date: ${(payment.paidAt ?? payment.createdAt).toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.moveDown().fontSize(11).text('Billed to:', { underline: true }).fontSize(10).text(org?.name ?? '').text(org?.address ?? '').text(org?.gstNumber ? `GSTIN: ${org.gstNumber}` : '');
      doc.moveDown(2);
      const line = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).text(label, 50, doc.y, { continued: true, width: 350 }).text(value, { align: 'right' });
      };
      line(payment.purpose === 'SUBSCRIPTION' ? `${plan?.name ?? 'Plan'} subscription (${(payment.billingCycle ?? 'MONTHLY').toLowerCase()})` : `Featured listing boost (${meta.weeks ?? 1} week)`, `Rs. ${formatINR(taxable, false)}`);
      if (payment.couponCode) line(`Coupon applied: ${payment.couponCode}`, '');
      line(`GST @ ${gstPct}%`, `Rs. ${formatINR(gst, false)}`);
      doc.moveDown(0.5);
      line('Total paid', `Rs. ${formatINR(total, false)}`, true);
      doc.moveDown(2).font('Helvetica').fontSize(9).fillColor('#64748b').text(`Razorpay payment ID: ${payment.razorpayPaymentId ?? '-'}`).text('This is a computer generated invoice.');
      doc.end();
    });
  }

  // ------------------------------------------------------------------ lifecycle
  @Cron('0 15 * * * *')
  async expireSubscriptions() {
    if (!env().JOBS_ENABLED) return;
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { OR: [{ status: 'ACTIVE', currentPeriodEnd: { lt: now } }, { status: 'TRIALING', trialEndsAt: { lt: now } }] },
      include: { plan: true },
    });
    for (const s of expired) {
      if (s.plan.priceMonthly === 0) continue;
      await this.prisma.subscription.update({ where: { id: s.id }, data: { status: 'EXPIRED' } });
      await this.notifications.notifyOrg(s.organizationId, { kind: 'SYSTEM', title: 'आपका plan expire हो गया है', body: 'Free plan की limits लागू हैं — Billing से renew करें।', link: '/broker/billing' }, { adminsOnly: true });
    }
  }
}
