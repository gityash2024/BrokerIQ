import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pdfMoney, pdfTable, pdfText, renderPdf } from '../../common/pdf';

export type ReportKind = 'deals' | 'invoices' | 'gst' | 'agents';

const IST = 5.5 * 3600_000;
const monthOf = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 7);
const dateOf = (d: Date | null | undefined) => (d ? new Date(d.getTime() + IST).toISOString().slice(0, 10) : '');
const round = (n: number) => Math.round(n * 100) / 100;

/** Excel/Tally friendly CSV: quoted cells, BOM so Excel opens UTF-8 names correctly, formula injection neutralised. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s) && typeof v === 'string') s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Broker business reports: deals, commission, invoices and GST for a date range (IST). */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, IST); default = this financial year so far. */
  range(from?: string, to?: string) {
    const now = new Date(Date.now() + IST);
    const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : `${fyStartYear}-04-01`;
    const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : now.toISOString().slice(0, 10);
    const start = new Date(new Date(`${f}T00:00:00Z`).getTime() - IST);
    const end = new Date(new Date(`${t}T23:59:59.999Z`).getTime() - IST);
    if (!(start <= end)) throw new BadRequestException('Date range गलत है');
    if (end.getTime() - start.getTime() > 3 * 366 * 86_400_000) throw new BadRequestException('ज़्यादा से ज़्यादा 3 साल की report');
    return { start, end, from: f, to: t };
  }

  private async load(orgId: string, start: Date, end: Date) {
    const [deals, invoices, leads, visits, org] = await Promise.all([
      this.prisma.deal.findMany({
        where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: start, lte: end } },
        include: { agent: { select: { id: true, name: true } }, lead: { select: { name: true } }, listing: { select: { title: true, refNo: true } } },
        orderBy: { closedAt: 'asc' },
      }),
      this.prisma.clientInvoice.findMany({
        where: { organizationId: orgId, status: { in: ['SENT', 'PAID'] }, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.lead.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: start, lte: end } } }),
      this.prisma.siteVisit.count({ where: { organizationId: orgId, status: 'COMPLETED', scheduledAt: { gte: start, lte: end } } }),
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true, gstNumber: true, reraNumber: true } }),
    ]);
    return { deals, invoices, leads, visits, org };
  }

  async summary(orgId: string, from?: string, to?: string) {
    const r = this.range(from, to);
    const { deals, invoices, leads, visits } = await this.load(orgId, r.start, r.end);
    const months = new Map<string, { month: string; deals: number; dealValue: number; commission: number; received: number; invoiced: number; gst: number }>();
    const bucket = (m: string) => {
      if (!months.has(m)) months.set(m, { month: m, deals: 0, dealValue: 0, commission: 0, received: 0, invoiced: 0, gst: 0 });
      return months.get(m)!;
    };
    for (const d of deals) {
      const b = bucket(monthOf(d.closedAt!));
      b.deals++;
      b.dealValue += d.dealValue;
      b.commission += d.commissionAmount ?? 0;
      b.received += d.commissionReceived;
    }
    for (const i of invoices) {
      const b = bucket(monthOf(i.createdAt));
      b.invoiced += i.total;
      b.gst += i.total - i.subtotal;
    }
    const agents = new Map<string, { agent: string; deals: number; commission: number }>();
    for (const d of deals) {
      const key = d.agent?.id ?? '-';
      const a = agents.get(key) ?? { agent: d.agent?.name ?? 'Unassigned', deals: 0, commission: 0 };
      a.deals++;
      a.commission += d.commissionAmount ?? 0;
      agents.set(key, a);
    }
    const sum = (f: (x: ReturnType<typeof bucket>) => number) => round([...months.values()].reduce((s, m) => s + f(m), 0));
    return {
      from: r.from,
      to: r.to,
      totals: {
        leads,
        visits,
        deals: deals.length,
        dealValue: sum((m) => m.dealValue),
        commission: sum((m) => m.commission),
        received: sum((m) => m.received),
        pending: round(sum((m) => m.commission) - sum((m) => m.received)),
        invoiced: sum((m) => m.invoiced),
        invoicesPaid: round(invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0)),
        gst: sum((m) => m.gst),
      },
      months: [...months.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({
          ...m,
          dealValue: round(m.dealValue),
          commission: round(m.commission),
          received: round(m.received),
          invoiced: round(m.invoiced),
          gst: round(m.gst),
        })),
      agents: [...agents.values()].sort((a, b) => b.commission - a.commission).map((a) => ({ ...a, commission: round(a.commission) })),
    };
  }

  async csv(orgId: string, kind: ReportKind, from?: string, to?: string): Promise<{ name: string; body: string }> {
    const r = this.range(from, to);
    const suffix = `${r.from}_to_${r.to}`;
    if (kind === 'agents' || kind === 'gst') {
      const s = await this.summary(orgId, r.from, r.to);
      if (kind === 'agents')
        return {
          name: `agents_${suffix}.csv`,
          body: toCsv(
            ['Agent', 'Deals', 'Commission'],
            s.agents.map((a) => [a.agent, a.deals, a.commission]),
          ),
        };
      return {
        name: `gst-summary_${suffix}.csv`,
        body: toCsv(
          ['Month', 'Invoiced (incl. GST)', 'Taxable value', 'GST', 'Deals', 'Commission', 'Received'],
          s.months.map((m) => [m.month, m.invoiced, round(m.invoiced - m.gst), m.gst, m.deals, m.commission, m.received]),
        ),
      };
    }
    const { deals, invoices } = await this.load(orgId, r.start, r.end);
    if (kind === 'deals')
      return {
        name: `deals_${suffix}.csv`,
        body: toCsv(
          ['Closed on', 'Deal', 'Client', 'Property', 'Agent', 'Deal value', 'Commission %', 'Commission', 'Received', 'Pending'],
          deals.map((d) => [
            dateOf(d.closedAt),
            d.title,
            d.lead?.name,
            d.listing ? `#${d.listing.refNo} ${d.listing.title}` : '',
            d.agent?.name,
            d.dealValue,
            d.commissionPct,
            d.commissionAmount,
            d.commissionReceived,
            round((d.commissionAmount ?? 0) - d.commissionReceived),
          ]),
        ),
      };
    if (kind === 'invoices')
      return {
        name: `invoices_${suffix}.csv`,
        body: toCsv(
          ['Date', 'Invoice no', 'Client', 'Phone', 'Taxable value', 'GST %', 'GST', 'Total', 'Status', 'Paid on', 'Mode', 'Reference'],
          invoices.map((i) => [
            dateOf(i.createdAt),
            i.number,
            i.clientName,
            i.clientPhone,
            i.subtotal,
            i.gstPct,
            round(i.total - i.subtotal),
            i.total,
            i.status,
            dateOf(i.paidAt),
            i.paidMode,
            i.paidRef,
          ]),
        ),
      };
    throw new BadRequestException('Report type गलत है');
  }

  async pdf(orgId: string, from?: string, to?: string) {
    const s = await this.summary(orgId, from, to);
    const r = this.range(from, to);
    const { deals, org } = await this.load(orgId, r.start, r.end);
    const t = s.totals;
    return renderPdf((doc) => {
      doc
        .font('B')
        .fontSize(18)
        .fillColor('#4F46E5')
        .text(pdfText(org.name) || 'Business report');
      doc
        .font('R')
        .fontSize(9)
        .fillColor('#475569')
        .text([org.gstNumber ? `GSTIN ${org.gstNumber}` : null, org.reraNumber ? `RERA ${org.reraNumber}` : null].filter(Boolean).join('  |  ') || ' ');
      doc.moveDown(0.5).font('B').fontSize(13).fillColor('#0f172a').text(`Business report: ${s.from} to ${s.to}`);
      doc.moveDown(0.6);
      pdfTable(
        doc,
        ['New leads', 'Visits done', 'Deals closed', 'Deal value', 'Commission', 'Received', 'Pending', 'Invoiced', 'GST'],
        [
          [
            t.leads,
            t.visits,
            t.deals,
            pdfMoney(t.dealValue),
            pdfMoney(t.commission),
            pdfMoney(t.received),
            pdfMoney(t.pending),
            pdfMoney(t.invoiced),
            pdfMoney(t.gst),
          ].map(String),
        ],
      );
      doc.moveDown(0.4).font('B').fontSize(11).text('Month by month');
      doc.moveDown(0.3);
      pdfTable(
        doc,
        ['Month', 'Deals', 'Deal value', 'Commission', 'Received', 'Invoiced', 'GST'],
        s.months.map((m) => [
          m.month,
          String(m.deals),
          pdfMoney(m.dealValue),
          pdfMoney(m.commission),
          pdfMoney(m.received),
          pdfMoney(m.invoiced),
          pdfMoney(m.gst),
        ]),
      );
      if (s.agents.length) {
        doc.moveDown(0.4).font('B').fontSize(11).text('By agent');
        doc.moveDown(0.3);
        pdfTable(
          doc,
          ['Agent', 'Deals', 'Commission'],
          s.agents.map((a) => [pdfText(a.agent), String(a.deals), pdfMoney(a.commission)]),
          [3, 1, 2],
        );
      }
      if (deals.length) {
        doc.moveDown(0.4).font('B').fontSize(11).text('Closed deals');
        doc.moveDown(0.3);
        pdfTable(
          doc,
          ['Date', 'Deal', 'Client', 'Agent', 'Value', 'Commission', 'Received'],
          deals.map((d) => [
            dateOf(d.closedAt),
            pdfText(d.title),
            pdfText(d.lead?.name),
            pdfText(d.agent?.name),
            pdfMoney(d.dealValue),
            pdfMoney(d.commissionAmount),
            pdfMoney(d.commissionReceived),
          ]),
          [1.2, 2.5, 1.6, 1.4, 1.2, 1.2, 1.2],
        );
      }
      doc
        .moveDown(1)
        .font('R')
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text('Figures are from BrokerIQ records entered by the firm. For accounting use, verify with your CA.');
    });
  }
}
