import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { formatINR, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { FeaturesService } from '../../core/features/features.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { istDay, randomToken } from '../../common/utils';
import { pdfMoney, pdfText, renderPdf } from '../../common/pdf';
import { env } from '../../config/env';

const api = () => env().PUBLIC_API_URL.replace(/\/$/, '');
const web = () => env().PUBLIC_WEB_URL.replace(/\/$/, '');
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Reminder is sent this many days before the due date, and again on the due date if still unpaid. */
const PRE_DAYS = 3;

export function upiRentLink(upiId: string, payee: string, amount: number, month: string) {
  const p = new URLSearchParams({ pa: upiId, pn: payee.slice(0, 50), am: amount.toFixed(2), cu: 'INR', tn: `Rent ${month}` });
  return `upi://pay?${p.toString()}`;
}

/** Monthly rent: due-date reminders (with the owner's UPI link), "paid" records and rent receipts. */
@Injectable()
export class RentService {
  private readonly logger = new Logger(RentService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly features: FeaturesService,
    private readonly wa: WhatsAppService,
  ) {}

  private async tenancy(orgId: string, id: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id, organizationId: orgId } });
    if (!t) throw new NotFoundException('Lease नहीं मिला');
    return t;
  }

  /** Finds the tenant's BrokerIQ account by phone or email so the lease shows up in "मेरा किराया". */
  private async matchTenant(phone?: string | null, email?: string | null) {
    const ors: Prisma.UserWhereInput[] = [];
    if (email) ors.push({ email: email.toLowerCase() });
    const p = phone ? normalizeIndianPhone(phone) : null;
    if (p) ors.push({ phone: p }, { phone: p.slice(-10) });
    if (!ors.length) return null;
    const u = await this.prisma.user.findFirst({ where: { OR: ors, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    return u?.id ?? null;
  }

  async settings(orgId: string, id: string, input: { rentDueDay?: number | null; tenantEmail?: string | null; tenantPhone?: string | null }) {
    const t = await this.tenancy(orgId, id);
    const tenantEmail = input.tenantEmail === undefined ? t.tenantEmail : input.tenantEmail?.toLowerCase() || null;
    const tenantPhone =
      input.tenantPhone === undefined ? t.tenantPhone : input.tenantPhone ? (normalizeIndianPhone(input.tenantPhone) ?? input.tenantPhone) : null;
    return this.prisma.tenancy.update({
      where: { id },
      data: {
        rentDueDay: input.rentDueDay === undefined ? t.rentDueDay : input.rentDueDay,
        tenantEmail,
        tenantPhone,
        tenantUserId: (await this.matchTenant(tenantPhone, tenantEmail)) ?? t.tenantUserId,
      },
    });
  }

  async ledger(orgId: string, id: string) {
    const t = await this.prisma.tenancy.findFirst({
      where: { id, organizationId: orgId },
      include: {
        rentPayments: { orderBy: { month: 'desc' } },
        owner: { select: { name: true, upiId: true, pan: true } },
        listing: { select: { title: true } },
      },
    });
    if (!t) throw new NotFoundException('Lease नहीं मिला');
    return { ...t, rentPayments: t.rentPayments.map((p) => ({ ...p, receiptUrl: this.receiptUrl(p.token) })), currentMonth: istDay().slice(0, 7) };
  }

  receiptUrl(token: string) {
    return `${api()}/api/public/rent-receipts/${token}/pdf`;
  }

  async markPaid(
    orgId: string,
    userId: string,
    id: string,
    input: { month: string; amount: number; paidOn?: string; mode?: string; reference?: string | null },
  ) {
    const t = await this.tenancy(orgId, id);
    const exists = await this.prisma.rentPayment.findUnique({ where: { tenancyId_month: { tenancyId: id, month: input.month } } });
    if (exists) throw new BadRequestException(`${monthName(input.month)} का किराया पहले से paid mark है`);
    const count = await this.prisma.rentPayment.count({ where: { organizationId: orgId } });
    const p = await this.prisma.rentPayment.create({
      data: {
        tenancyId: id,
        organizationId: orgId,
        month: input.month,
        amount: input.amount,
        paidOn: input.paidOn ? new Date(`${input.paidOn}T12:00:00+05:30`) : new Date(),
        mode: input.mode ?? 'UPI',
        reference: input.reference ?? null,
        receiptNo: `RR-${input.month.replace('-', '')}-${String(count + 1).padStart(4, '0')}`,
        token: randomToken(18),
        createdById: userId,
      },
    });
    const url = this.receiptUrl(p.token);
    const msg = `${monthName(p.month)} का किराया ${formatINR(p.amount)} मिल गया — धन्यवाद! Receipt: ${url}`;
    if (t.tenantUserId)
      await this.notifications
        .notify(t.tenantUserId, { kind: 'RENT_RECEIPT', title: '🧾 Rent receipt', body: msg, link: '/account/rent' })
        .catch(() => undefined);
    if (t.tenantEmail)
      await this.mail
        .send({ to: t.tenantEmail, subject: `Rent receipt — ${monthName(p.month)}`, html: `<p>नमस्ते ${escape(t.tenantName)},</p><p>${escape(msg)}</p>` })
        .catch((e) => this.logger.warn(`receipt mail: ${(e as Error).message}`));
    return { ...p, receiptUrl: url };
  }

  async removePayment(orgId: string, paymentId: string) {
    const p = await this.prisma.rentPayment.findFirst({ where: { id: paymentId, organizationId: orgId } });
    if (!p) throw new NotFoundException();
    await this.prisma.rentPayment.delete({ where: { id: p.id } });
    return { ok: true };
  }

  async receiptPdf(token: string) {
    const p = await this.prisma.rentPayment.findUnique({
      where: { token },
      include: {
        tenancy: {
          include: {
            owner: { select: { name: true, pan: true } },
            listing: { select: { title: true, address: true, societyName: true, locality: { select: { name: true } } } },
            organization: { select: { name: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException();
    const t = p.tenancy;
    const address = [t.listing?.societyName, t.listing?.address, t.listing?.locality.name, 'Gurugram'].filter(Boolean).join(', ') || t.listing?.title || '-';
    return renderPdf((doc) => {
      doc.font('B').fontSize(18).fillColor('#0f172a').text('RENT RECEIPT', { align: 'center' });
      doc.moveDown(0.3).font('R').fontSize(9).fillColor('#64748b').text(`Receipt no. ${p.receiptNo}`, { align: 'center' });
      doc.moveDown(1.5).fillColor('#0f172a').fontSize(11);
      doc.text(
        `Received with thanks from ${pdfText(t.tenantName) || 'the tenant'} a sum of ${pdfMoney(p.amount)} towards the rent for the month of ${monthName(p.month)} ` +
          `for the premises at ${pdfText(address)}.`,
        { align: 'justify', lineGap: 3 },
      );
      doc.moveDown();
      const row = (k: string, v: string) => doc.font('B').text(`${k}: `, { continued: true }).font('R').text(v);
      row('Payment date', p.paidOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }));
      row('Mode', `${p.mode ?? 'UPI'}${p.reference ? ` (ref ${pdfText(p.reference)})` : ''}`);
      row('Landlord', pdfText(t.owner?.name) || '-');
      if (t.owner?.pan) row('Landlord PAN', t.owner.pan);
      doc.moveDown(2);
      doc.font('R').text('Landlord signature: ______________________');
      if (p.amount > 5000 && p.mode === 'CASH')
        doc.moveDown(0.5).fontSize(9).fillColor('#64748b').text('Cash payment above Rs 5,000: affix a revenue stamp before signing.');
      doc
        .moveDown(2)
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(
          `Recorded by ${pdfText(t.organization.name)} on BrokerIQ. Tenants can use this receipt for HRA; landlord PAN is required when annual rent exceeds Rs 1,00,000.`,
        );
    });
  }

  // ------------------------------------------------------------------ tenant: "मेरा किराया"
  async mine(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, email: true } });
    const phone = me.phone ? normalizeIndianPhone(me.phone) : null;
    const tenancies = await this.prisma.tenancy.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ tenantUserId: userId }, ...(phone ? [{ tenantPhone: phone }] : []), { tenantEmail: me.email.toLowerCase() }],
      },
      include: {
        rentPayments: { orderBy: { month: 'desc' }, take: 24 },
        owner: { select: { name: true, upiId: true } },
        listing: { select: { title: true, slug: true, coverUrl: true } },
        organization: { select: { name: true, phone: true, whatsapp: true, upiId: true, upiName: true } },
      },
    });
    // Link the lease to this account for next time (cheap, idempotent).
    const unlinked = tenancies.filter((t) => t.tenantUserId !== userId).map((t) => t.id);
    if (unlinked.length) await this.prisma.tenancy.updateMany({ where: { id: { in: unlinked }, tenantUserId: null }, data: { tenantUserId: userId } });
    const month = istDay().slice(0, 7);
    return tenancies.map((t) => {
      const paid = t.rentPayments.some((p) => p.month === month);
      const upiId = t.owner?.upiId ?? null;
      return {
        id: t.id,
        rent: t.rent,
        rentDueDay: t.rentDueDay,
        startDate: t.startDate,
        endDate: t.endDate,
        listing: t.listing,
        broker: { name: t.organization.name, phone: t.organization.whatsapp ?? t.organization.phone },
        owner: t.owner ? { name: t.owner.name } : null,
        currentMonth: month,
        paidThisMonth: paid,
        upiLink: !paid && upiId ? upiRentLink(upiId, t.owner?.name ?? 'Owner', t.rent, month) : null,
        upiId,
        payments: t.rentPayments.map((p) => ({ id: p.id, month: p.month, amount: p.amount, paidOn: p.paidOn, receiptUrl: this.receiptUrl(p.token) })),
      };
    });
  }

  // ------------------------------------------------------------------ reminders (09:00 IST)
  @Cron('0 30 3 * * *')
  async cron() {
    if (!env().JOBS_ENABLED || !(await this.features.isEnabled('rent_tracker'))) return;
    await this.sendReminders();
  }

  async sendReminders(now = new Date()) {
    const today = istDay(now);
    const [y, m, d] = today.split('-').map(Number);
    const month = today.slice(0, 7);
    const due = await this.prisma.tenancy.findMany({
      where: { status: 'ACTIVE', rentDueDay: { not: null }, startDate: { lte: now }, endDate: { gte: now } },
      include: {
        rentPayments: { where: { month }, select: { id: true } },
        owner: { select: { name: true, upiId: true } },
        organization: { select: { name: true } },
      },
      take: 5000,
    });
    let sent = 0;
    for (const t of due) {
      if (t.rentPayments.length) continue;
      const days = t.rentDueDay! - d;
      const stage = days === PRE_DAYS ? 'pre' : days === 0 ? 'due' : null;
      if (!stage) continue;
      const key = `${month}:${stage}`;
      if (t.rentReminders.includes(key)) continue;
      const dueDate = new Date(Date.UTC(y, m - 1, t.rentDueDay!)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const upi = t.owner?.upiId ? upiRentLink(t.owner.upiId, t.owner.name, t.rent, month) : null;
      const text = `${stage === 'pre' ? `${dueDate} को` : 'आज'} ${monthName(month)} का किराया ${formatINR(t.rent)} देना है।${t.owner?.upiId ? ` UPI: ${t.owner.upiId}` : ''}`;
      const channels: string[] = [];
      if (t.tenantUserId) {
        await this.notifications
          .notify(t.tenantUserId, { kind: 'RENT_DUE', title: '🏠 किराया reminder', body: text, link: '/account/rent' })
          .catch(() => undefined);
        channels.push('push');
      }
      if (t.tenantEmail) {
        await this.mail
          .send({
            to: t.tenantEmail,
            subject: `किराया reminder — ${monthName(month)}`,
            html:
              `<p>नमस्ते ${escape(t.tenantName)},</p><p>${escape(text)}</p>` +
              (upi ? `<p><a href="${upi}">UPI से pay करें</a> (phone पर खोलें)</p>` : '') +
              `<p><a href="${web()}/account/rent">मेरा किराया देखें</a></p><p style="color:#64748b;font-size:12px">— ${escape(t.organization.name)}</p>`,
          })
          .then(() => channels.push('email'))
          .catch((e) => this.logger.warn(`rent mail ${t.id}: ${(e as Error).message}`));
      }
      if (!channels.includes('email') && t.tenantPhone) {
        // Firm's own number only; outside WhatsApp's 24h window Meta rejects plain text, which is fine (logged).
        await this.wa
          .send(t.organizationId, t.tenantPhone, { type: 'text', text: `नमस्ते ${t.tenantName}, ${text}` }, { contactName: t.tenantName, ownNumberOnly: true })
          .then(() => channels.push('whatsapp'))
          .catch(() => undefined);
      }
      await this.prisma.tenancy.update({ where: { id: t.id }, data: { rentReminders: { push: key } } });
      if (channels.length) sent++;
    }
    return sent;
  }
}
