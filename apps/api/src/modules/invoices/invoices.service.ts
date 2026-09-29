import { existsSync } from 'fs';
import { join } from 'path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { ClientInvoice, Organization, Prisma } from '@prisma/client';
import { formatINR, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuditService } from '../../core/audit/audit.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { randomToken, requireOrg } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';

export interface InvoiceItem {
  description: string;
  amount: number;
}
export interface InvoiceInput {
  dealId?: string | null;
  leadId?: string | null;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  items: InvoiceItem[];
  gstPct?: number;
  dueDate?: Date | null;
  notes?: string | null;
}

const MAX_REMINDERS = 3;
const REMINDER_GAP_DAYS = 3;
const UPI_ID = /^[\w.\-]{2,256}@[a-zA-Z][\w]{2,64}$/;

function fontPath(file: string) {
  const dirs = [join(__dirname, '../../../assets/fonts'), join(__dirname, '../../../../assets/fonts'), join(process.cwd(), 'assets/fonts'), join(process.cwd(), 'apps/api/assets/fonts')];
  return join(dirs.find((d) => existsSync(join(d, file))) ?? dirs[0], file);
}

/** upi://pay link any UPI app opens with the amount prefilled (no gateway, money goes to the firm). */
export function upiLink(org: Pick<Organization, 'upiId' | 'upiName' | 'name'>, inv: Pick<ClientInvoice, 'total' | 'number'>) {
  if (!org.upiId) return null;
  const p = new URLSearchParams({ pa: org.upiId, pn: (org.upiName || org.name).slice(0, 50), am: inv.total.toFixed(2), cu: 'INR', tn: `Invoice ${inv.number}` });
  return `upi://pay?${p.toString()}`;
}

/**
 * Brokerage invoices a firm raises on its clients. Payment happens directly to the firm's UPI
 * (link / QR on the invoice); the broker marks it paid — BrokerIQ never holds the money.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly wa: WhatsAppService,
  ) {}

  publicLink(inv: Pick<ClientInvoice, 'publicToken'>) {
    return `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/pay/${inv.publicToken}`;
  }

  // ------------------------------------------------------------------ payment settings
  async paymentSettings(orgId: string) {
    const o = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { upiId: true, upiName: true, invoicePrefix: true, weeklyReport: true, gstNumber: true } });
    return o;
  }

  async updatePaymentSettings(orgId: string, body: { upiId?: string | null; upiName?: string | null; invoicePrefix?: string | null; weeklyReport?: boolean }) {
    if (body.upiId && !UPI_ID.test(body.upiId.trim())) throw new BadRequestException('UPI ID सही नहीं है (जैसे name@okicici)');
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { upiId: body.upiId?.trim() || (body.upiId === '' ? null : undefined), upiName: body.upiName ?? undefined, invoicePrefix: body.invoicePrefix?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || undefined, weeklyReport: body.weeklyReport },
      select: { upiId: true, upiName: true, invoicePrefix: true, weeklyReport: true },
    });
  }

  // ------------------------------------------------------------------ CRUD
  list(user: RequestUser, status?: string) {
    return this.prisma.clientInvoice.findMany({ where: { organizationId: requireOrg(user), ...(status ? { status: status as any } : {}) }, orderBy: { createdAt: 'desc' }, take: 300 });
  }

  async get(user: RequestUser, id: string) {
    const inv = await this.prisma.clientInvoice.findFirst({ where: { id, organizationId: requireOrg(user) } });
    if (!inv) throw new NotFoundException();
    return { ...inv, link: this.publicLink(inv) };
  }

  async create(user: RequestUser, input: InvoiceInput) {
    const orgId = requireOrg(user);
    if (!input.items.length) throw new BadRequestException('कम से कम एक item डालें');
    let clientName = input.clientName;
    let clientPhone = input.clientPhone ?? null;
    if (input.dealId) {
      const d = await this.prisma.deal.findFirst({ where: { id: input.dealId, organizationId: orgId }, include: { lead: { select: { id: true, name: true, phone: true, email: true } } } });
      if (!d) throw new BadRequestException('Deal नहीं मिली');
      input.leadId = input.leadId ?? d.leadId;
      clientName = clientName || d.lead.name;
      clientPhone = clientPhone ?? d.lead.phone;
      input.clientEmail = input.clientEmail ?? d.lead.email;
    }
    const subtotal = Math.round(input.items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const gstPct = input.gstPct ?? 0;
    const total = Math.round(subtotal * (1 + gstPct / 100) * 100) / 100;
    const inv = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({ where: { id: orgId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true, invoicePrefix: true } });
      const number = `${org.invoicePrefix || 'INV'}-${String(org.invoiceSeq).padStart(4, '0')}`;
      return tx.clientInvoice.create({
        data: {
          organizationId: orgId,
          dealId: input.dealId ?? null,
          leadId: input.leadId ?? null,
          number,
          clientName,
          clientPhone: clientPhone ? normalizeIndianPhone(clientPhone) ?? clientPhone : null,
          clientEmail: input.clientEmail || null,
          items: input.items as unknown as Prisma.InputJsonValue,
          subtotal,
          gstPct,
          total,
          dueDate: input.dueDate ?? null,
          notes: input.notes ?? null,
          publicToken: randomToken(18),
          createdById: user.id,
        },
      });
    });
    await this.audit.log(user, 'invoice.create', 'ClientInvoice', inv.id, { total });
    return { ...inv, link: this.publicLink(inv) };
  }

  async update(user: RequestUser, id: string, patch: { status?: 'SENT' | 'PAID' | 'CANCELLED'; paidMode?: string | null; paidRef?: string | null; paidAt?: Date | null; dueDate?: Date | null; notes?: string | null }) {
    const inv = await this.get(user, id);
    const data: Prisma.ClientInvoiceUpdateInput = { ...patch };
    if (patch.status === 'PAID' && inv.status !== 'PAID') {
      data.paidAt = patch.paidAt ?? new Date();
      if (inv.dealId) {
        const d = await this.prisma.deal.findUnique({ where: { id: inv.dealId } });
        if (d) {
          const next = d.commissionReceived + inv.subtotal;
          await this.prisma.deal.update({ where: { id: d.id }, data: { commissionReceived: d.commissionAmount ? Math.min(d.commissionAmount, next) : next } });
        }
      }
    }
    const updated = await this.prisma.clientInvoice.update({ where: { id }, data });
    await this.audit.log(user, `invoice.${patch.status?.toLowerCase() ?? 'update'}`, 'ClientInvoice', id);
    return updated;
  }

  /** Sends the invoice link to the client by WhatsApp (firm's number) and email where available. */
  async send(user: RequestUser, id: string) {
    const inv = await this.get(user, id);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: inv.organizationId } });
    const result = { whatsapp: false, email: false };
    const text = `नमस्ते ${inv.clientName}, ${org.name} की ओर से invoice ${inv.number}: ${formatINR(inv.total)}${inv.dueDate ? ` (due ${inv.dueDate.toLocaleDateString('en-IN')})` : ''}.\nदेखें और UPI से pay करें: ${inv.link}`;
    if (inv.clientPhone) {
      result.whatsapp = await this.wa
        .send(inv.organizationId, inv.clientPhone, { type: 'text', text }, { leadId: inv.leadId ?? undefined, userId: user.id, contactName: inv.clientName })
        .then(() => true)
        .catch((e) => (this.logger.warn(`invoice WA ${inv.id}: ${(e as Error).message}`), false));
    }
    if (inv.clientEmail) {
      result.email = await this.mail.trySendTemplate('invoice.send', inv.clientEmail, { clientName: inv.clientName, orgName: org.name, number: inv.number, total: inv.total.toLocaleString('en-IN'), dueText: inv.dueDate ? ` — due ${inv.dueDate.toLocaleDateString('en-IN')}` : '', link: inv.link });
    }
    await this.prisma.clientInvoice.update({ where: { id }, data: { status: inv.status === 'DRAFT' ? 'SENT' : undefined, lastReminderAt: new Date() } });
    return { ...result, link: inv.link, text };
  }

  // ------------------------------------------------------------------ public (client) view
  async publicView(token: string) {
    const inv = await this.prisma.clientInvoice.findUnique({ where: { publicToken: token }, include: { organization: { select: { name: true, logoUrl: true, phone: true, email: true, address: true, gstNumber: true, upiId: true, upiName: true, slug: true } } } });
    if (!inv || inv.status === 'DRAFT') throw new NotFoundException('Invoice नहीं मिला');
    const { organization: org, publicToken: _t, createdById: _c, ...rest } = inv;
    return { ...rest, org: { ...org, upiId: org.upiId }, upi: inv.status === 'SENT' ? upiLink({ ...org, name: org.name }, inv) : null };
  }

  async qrPng(token: string) {
    const v = await this.publicView(token);
    if (!v.upi) throw new NotFoundException();
    return QRCode.toBuffer(v.upi, { width: 480, margin: 1 });
  }

  async pdf(token: string): Promise<Buffer> {
    const inv = await this.prisma.clientInvoice.findUnique({ where: { publicToken: token }, include: { organization: true } });
    if (!inv || inv.status === 'DRAFT') throw new NotFoundException();
    const org = inv.organization;
    const upi = inv.status === 'SENT' ? upiLink(org, inv) : null;
    const qr = upi ? await QRCode.toBuffer(upi, { width: 360, margin: 1 }) : null;
    const items = inv.items as unknown as InvoiceItem[];
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.registerFont('R', fontPath('Inter_500Medium.ttf'));
      doc.registerFont('B', fontPath('Inter_700Bold.ttf'));
      doc.font('B').fillColor('#4F46E5').fontSize(20).text(org.name);
      doc.font('R').fillColor('#475569').fontSize(9);
      [org.address, org.phone, org.email, org.gstNumber ? `GSTIN: ${org.gstNumber}` : null, org.reraNumber ? `RERA: ${org.reraNumber}` : null].filter(Boolean).forEach((l) => doc.text(String(l)));
      doc.moveDown().font('B').fillColor('#0f172a').fontSize(16).text(inv.gstPct > 0 ? 'TAX INVOICE' : 'INVOICE', { align: 'right' });
      doc.font('R').fontSize(10).text(`Invoice #: ${inv.number}`, { align: 'right' }).text(`Date: ${inv.createdAt.toLocaleDateString('en-IN')}`, { align: 'right' });
      if (inv.dueDate) doc.text(`Due: ${inv.dueDate.toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.moveDown().font('B').fontSize(11).text('Billed to').font('R').fontSize(10).text(inv.clientName);
      if (inv.clientPhone) doc.text(inv.clientPhone);
      if (inv.clientEmail) doc.text(inv.clientEmail);
      doc.moveDown(1.5);
      const line = (label: string, value: string, bold = false) => doc.font(bold ? 'B' : 'R').fontSize(11).text(label, 50, doc.y, { continued: true, width: 360 }).text(value, { align: 'right' });
      items.forEach((i) => line(i.description, formatINR(i.amount)));
      doc.moveDown(0.5);
      if (inv.gstPct > 0) {
        line('Subtotal', formatINR(inv.subtotal));
        line(`GST @ ${inv.gstPct}%`, formatINR(inv.total - inv.subtotal));
      }
      line('Total', formatINR(inv.total), true);
      doc.moveDown();
      if (inv.status === 'PAID') doc.font('B').fillColor('#059669').fontSize(14).text(`PAID${inv.paidAt ? ` on ${inv.paidAt.toLocaleDateString('en-IN')}` : ''}`);
      if (qr && org.upiId) {
        doc.moveDown().font('B').fillColor('#0f172a').fontSize(11).text('Pay by UPI (any app):');
        doc.image(qr, { width: 140 });
        doc.font('R').fontSize(10).text(`UPI ID: ${org.upiId}`);
      }
      if (inv.notes) doc.moveDown().font('R').fillColor('#475569').fontSize(9).text(inv.notes);
      doc.moveDown(2).font('R').fillColor('#94a3b8').fontSize(8).text('Payment goes directly to the broker. Generated with BrokerIQ.');
      doc.end();
    });
  }

  // ------------------------------------------------------------------ overdue reminders
  @Cron('0 30 5 * * *') // 11:00 IST
  async reminders() {
    if (!env().JOBS_ENABLED) return;
    await this.runReminders();
  }

  async runReminders(now = new Date()) {
    const due = await this.prisma.clientInvoice.findMany({
      where: { status: 'SENT', dueDate: { lt: now }, remindersSent: { lt: MAX_REMINDERS }, OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(now.getTime() - REMINDER_GAP_DAYS * 86400_000) } }] },
      include: { organization: { select: { name: true } } },
      take: 500,
    });
    for (const inv of due) {
      const link = this.publicLink(inv);
      if (inv.clientPhone) {
        await this.wa.send(inv.organizationId, inv.clientPhone, { type: 'text', text: `Reminder: ${inv.organization.name} invoice ${inv.number} (${formatINR(inv.total)}) pending है। UPI से pay करें: ${link}` }, { leadId: inv.leadId ?? undefined, contactName: inv.clientName }).catch(() => undefined);
      }
      if (inv.clientEmail) await this.mail.trySendTemplate('invoice.send', inv.clientEmail, { clientName: inv.clientName, orgName: inv.organization.name, number: inv.number, total: inv.total.toLocaleString('en-IN'), dueText: ' — payment pending', link });
      await this.notifications.notifyOrg(inv.organizationId, { kind: 'INVOICE_OVERDUE', title: `⏰ Invoice ${inv.number} overdue`, body: `${inv.clientName} · ${formatINR(inv.total)} — reminder भेजा`, link: '/broker/invoices' }, { adminsOnly: true });
      await this.prisma.clientInvoice.update({ where: { id: inv.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: now } });
    }
    return due.length;
  }
}
