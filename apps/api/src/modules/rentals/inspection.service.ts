import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import type { Prisma, TenancyInspection } from '@prisma/client';
import type { InspectionInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { randomToken } from '../../common/utils';
import { pdfImage, pdfMoney, pdfTable, pdfText, renderPdf } from '../../common/pdf';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { EventsService } from '../../core/events/events.service';
import { env } from '../../config/env';
import { issueOtp, maskContact, otpRequestCode, samePhone, sendOtpOnWhatsApp, verifyOtp, type OtpState } from './otp';

type Party = 'LANDLORD' | 'TENANT';
type Room = { name: string; items: { name: string; condition: string; note?: string | null }[] };
const web = () => env().PUBLIC_WEB_URL.replace(/\/$/, '');
const api = () => env().PUBLIC_API_URL.replace(/\/$/, '');
const KIND_LABEL = { MOVE_IN: 'Move-in', MOVE_OUT: 'Move-out' } as const;

const INSPECTION_INCLUDE = {
  tenancy: {
    include: {
      owner: { select: { name: true, email: true, phone: true } },
      listing: { select: { title: true, societyName: true, address: true, locality: { select: { name: true } } } },
      organization: { select: { name: true } },
      inspections: { where: { kind: 'MOVE_IN' } },
    },
  },
} satisfies Prisma.TenancyInspectionInclude;
type LoadedInspection = Prisma.TenancyInspectionGetPayload<{ include: typeof INSPECTION_INCLUDE }>;

/** Move-in / move-out condition record with deposit settlement; landlord and tenant confirm by OTP. */
@Injectable()
export class InspectionService implements OnModuleInit {
  private readonly logger = new Logger(InspectionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly wa: WhatsAppService,
    private readonly store: LocalStorageService,
    private readonly events: EventsService,
  ) {}

  onModuleInit() {
    this.events.on('whatsapp.otp_request', (p) => this.relayOtp(p));
  }

  private links(i: Pick<TenancyInspection, 'token'>) {
    return {
      url: `${web()}/i/${i.token}`,
      pdfUrl: `${api()}/api/public/inspections/${i.token}/pdf`,
    };
  }

  async list(orgId: string, tenancyId: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id: tenancyId, organizationId: orgId }, include: { inspections: true } });
    if (!t) throw new NotFoundException('Lease नहीं मिला');
    return t.inspections.map((i) => ({ ...i, otp: undefined, ...this.links(i) }));
  }

  /** Create or update; any edit clears earlier confirmations (both must confirm the final version). */
  async save(orgId: string, userId: string, tenancyId: string, input: InspectionInput) {
    const t = await this.prisma.tenancy.findFirst({ where: { id: tenancyId, organizationId: orgId } });
    if (!t) throw new NotFoundException('Lease नहीं मिला');
    const deductions = input.deductions ?? [];
    const refundAmount =
      input.kind === 'MOVE_OUT' && input.depositAmount != null ? Math.max(0, input.depositAmount - deductions.reduce((s, d) => s + d.amount, 0)) : null;
    const data = {
      rooms: input.rooms as Prisma.InputJsonValue,
      meters: (input.meters ?? undefined) as Prisma.InputJsonValue | undefined,
      keys: input.keys ?? null,
      photos: input.photos,
      notes: input.notes ?? null,
      depositAmount: input.depositAmount ?? null,
      deductions: deductions as Prisma.InputJsonValue,
      refundAmount,
      landlordConfirmedAt: null,
      tenantConfirmedAt: null,
      otp: undefined as Prisma.InputJsonValue | undefined,
    };
    const i = await this.prisma.tenancyInspection.upsert({
      where: { tenancyId_kind: { tenancyId, kind: input.kind } },
      create: { ...data, tenancyId, organizationId: orgId, kind: input.kind, token: randomToken(18), createdById: userId },
      update: { ...data, otp: {} },
    });
    return { ...i, otp: undefined, ...this.links(i) };
  }

  private async load(token: string) {
    const i = await this.prisma.tenancyInspection.findUnique({
      where: { token },
      include: INSPECTION_INCLUDE,
    });
    if (!i) throw new NotFoundException('Link गलत है');
    return i;
  }

  private contact(i: LoadedInspection, party: Party) {
    const t = i.tenancy;
    return party === 'LANDLORD'
      ? { name: t.owner?.name ?? 'Landlord', email: t.owner?.email ?? null, phone: t.owner?.phone ?? null }
      : { name: t.tenantName, email: t.tenantEmail, phone: t.tenantPhone };
  }

  async view(token: string) {
    const i = await this.load(token);
    const t = i.tenancy;
    const moveIn = i.kind === 'MOVE_OUT' ? t.inspections[0] : null;
    const mask = (p: Party) => {
      const c = this.contact(i, p);
      return { name: c.name, reachableAt: c.email ? maskContact(c.email) : c.phone ? maskContact(c.phone) : null };
    };
    return {
      kind: i.kind,
      property: [t.listing?.societyName, t.listing?.address, t.listing?.locality.name].filter(Boolean).join(', ') || t.listing?.title || '',
      firm: t.organization.name,
      landlord: mask('LANDLORD'),
      tenant: mask('TENANT'),
      rooms: i.rooms,
      meters: i.meters,
      keys: i.keys,
      photos: i.photos,
      notes: i.notes,
      depositAmount: i.depositAmount,
      deductions: i.deductions,
      refundAmount: i.refundAmount,
      landlordConfirmedAt: i.landlordConfirmedAt,
      tenantConfirmedAt: i.tenantConfirmedAt,
      updatedAt: i.updatedAt,
      moveIn: moveIn ? { rooms: moveIn.rooms, meters: moveIn.meters, keys: moveIn.keys, createdAt: moveIn.createdAt } : null,
      pdfUrl: this.links(i).pdfUrl,
    };
  }

  async requestOtp(token: string, party: Party) {
    const i = await this.load(token);
    if ((party === 'LANDLORD' ? i.landlordConfirmedAt : i.tenantConfirmedAt) != null) throw new BadRequestException('पहले ही confirm हो चुका है');
    const c = this.contact(i, party);
    if (!c.email && !c.phone) throw new BadRequestException('इस व्यक्ति का email/phone broker के पास नहीं है — broker से जोड़ने को कहें');
    const { otp, text } = await this.issue(i, party);
    if (c.email) await this.mail.send({ to: c.email, subject: `OTP ${otp} — ${KIND_LABEL[i.kind]} checklist`, html: `<p>${text}</p>` });
    else await sendOtpOnWhatsApp(this.wa, i.organizationId, { name: c.name, phone: c.phone! }, { text, otp, code: otpRequestCode('insp', i.id, party) });
    return { sentTo: maskContact(c.email ?? c.phone!) };
  }

  /** New OTP for one party (stored hashed); returns it with the message text. */
  private async issue(i: LoadedInspection, party: Party) {
    const { otp, state } = issueOtp(`insp:${i.id}:${party}`);
    const fresh = await this.prisma.tenancyInspection.findUniqueOrThrow({ where: { id: i.id }, select: { otp: true } });
    const otps = { ...((fresh.otp as unknown as Record<string, OtpState>) ?? {}), [party]: state };
    await this.prisma.tenancyInspection.update({ where: { id: i.id }, data: { otp: otps as unknown as Prisma.InputJsonValue } });
    const text = `${KIND_LABEL[i.kind]} checklist confirm करने का OTP: ${otp} (10 मिनट तक). किसी को न बताएँ। — ${i.tenancy.organization.name}`;
    return { otp, text };
  }

  /** "BrokerIQ OTP <code>" from a party's own phone: reply with a fresh OTP inside the now-open 24h window. */
  async relayOtp(p: { orgId: string; phone: string; code: string }) {
    const pending = await this.prisma.tenancyInspection.findMany({
      where: { organizationId: p.orgId, OR: [{ landlordConfirmedAt: null }, { tenantConfirmedAt: null }] },
      include: INSPECTION_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });
    for (const i of pending)
      for (const party of ['LANDLORD', 'TENANT'] as const) {
        if ((party === 'LANDLORD' ? i.landlordConfirmedAt : i.tenantConfirmedAt) != null) continue;
        const c = this.contact(i, party);
        if (c.email || !samePhone(c.phone, p.phone) || otpRequestCode('insp', i.id, party) !== p.code) continue;
        const { otp, text } = await this.issue(i, party);
        await sendOtpOnWhatsApp(this.wa, p.orgId, { name: c.name, phone: c.phone! }, { text, otp, code: p.code }).catch((e) =>
          this.logger.warn(`OTP relay ${i.id}: ${(e as Error).message}`),
        );
        return;
      }
  }

  async confirm(token: string, party: Party, otp: string, meta: { ip?: string; ua?: string }) {
    const i = await this.load(token);
    const otps = (i.otp as unknown as Record<string, OtpState> | null) ?? {};
    const ok = verifyOtp(otps[party], `insp:${i.id}:${party}`, otp);
    if (!ok) {
      otps[party] = { ...otps[party], tries: otps[party].tries + 1 };
      await this.prisma.tenancyInspection.update({ where: { id: i.id }, data: { otp: otps as unknown as Prisma.InputJsonValue } });
      throw new BadRequestException('OTP गलत है');
    }
    delete otps[party];
    const confirmMeta = {
      ...((i.confirmMeta as Record<string, unknown>) ?? {}),
      [party]: { ip: meta.ip ?? null, ua: meta.ua?.slice(0, 200) ?? null, at: new Date() },
    };
    await this.prisma.tenancyInspection.update({
      where: { id: i.id },
      data: {
        otp: otps as unknown as Prisma.InputJsonValue,
        confirmMeta: confirmMeta as Prisma.InputJsonValue,
        ...(party === 'LANDLORD' ? { landlordConfirmedAt: new Date() } : { tenantConfirmedAt: new Date() }),
      },
    });
    return this.view(token);
  }

  async pdf(token: string) {
    const v = await this.view(token);
    const rooms = v.rooms as Room[];
    const before = (v.moveIn?.rooms as Room[] | undefined) ?? null;
    const cond = (rs: Room[] | null, room: string, item: string) => rs?.find((r) => r.name === room)?.items.find((x) => x.name === item)?.condition ?? '-';
    // Photos are the evidence in deposit disputes: print up to 24 of them, 3 per row.
    const photos = (await Promise.all(v.photos.slice(0, 24).map((u) => pdfImage(this.store, u, 480, 360)))).filter((b): b is Buffer => !!b);
    return renderPdf((doc) => {
      doc.font('B').fontSize(16).fillColor('#0f172a').text(`${KIND_LABEL[v.kind]} inspection`, { align: 'center' });
      doc.moveDown(0.3).font('R').fontSize(9).fillColor('#64748b').text(pdfText(v.property), { align: 'center' });
      doc.moveDown(0.8).fillColor('#0f172a').fontSize(10);
      doc.text(`Landlord: ${pdfText(v.landlord.name)}    Tenant: ${pdfText(v.tenant.name)}    Recorded by: ${pdfText(v.firm)}`);
      doc.moveDown(0.6);
      for (const r of rooms) {
        doc.font('B').fontSize(11).text(pdfText(r.name));
        doc.moveDown(0.2);
        pdfTable(
          doc,
          before ? ['Item', 'At move-in', 'Now', 'Note'] : ['Item', 'Condition', 'Note'],
          r.items.map((x) =>
            before ? [pdfText(x.name), cond(before, r.name, x.name), x.condition, pdfText(x.note)] : [pdfText(x.name), x.condition, pdfText(x.note)],
          ),
          before ? [2, 1, 1, 3] : [2, 1, 3],
        );
      }
      const m = (v.meters ?? {}) as Record<string, string>;
      const mi = (v.moveIn?.meters ?? {}) as Record<string, string>;
      if (Object.keys(m).length) {
        doc.font('B').fontSize(11).text('Meter readings');
        pdfTable(
          doc,
          before ? ['Meter', 'At move-in', 'Now'] : ['Meter', 'Reading'],
          Object.entries(m).map(([k, val]) => (before ? [k, mi[k] ?? '-', val] : [k, val])),
        );
      }
      if (v.keys != null)
        doc
          .font('R')
          .fontSize(10)
          .text(`Keys handed over: ${v.keys}${v.moveIn?.keys != null ? ` (at move-in: ${v.moveIn.keys})` : ''}`);
      if (v.notes) doc.moveDown(0.3).text(`Notes: ${pdfText(v.notes)}`);
      if (v.kind === 'MOVE_OUT' && v.depositAmount != null) {
        doc.moveDown(0.6).font('B').fontSize(11).text('Deposit settlement');
        const ded = (v.deductions ?? []) as { reason: string; amount: number }[];
        pdfTable(
          doc,
          ['', 'Amount'],
          [
            ['Security deposit', pdfMoney(v.depositAmount)],
            ...ded.map((d) => [`Less: ${pdfText(d.reason)}`, pdfMoney(d.amount)]),
            ['Refund to tenant', pdfMoney(v.refundAmount)],
          ],
          [3, 1],
        );
      }
      if (photos.length) {
        doc.moveDown(0.6).font('B').fontSize(11).fillColor('#0f172a').text(`Photos (${v.photos.length})`);
        const left = doc.page.margins.left;
        const gap = 8;
        const w = (doc.page.width - left - doc.page.margins.right - gap * 2) / 3;
        const h = w * 0.75;
        photos.forEach((b, i) => {
          if (i % 3 === 0) {
            if (i > 0) doc.y += h + gap;
            if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
          }
          doc.image(b, left + (i % 3) * (w + gap), doc.y, { width: w, height: h });
        });
        doc.y += h + gap;
        doc.x = left;
        if (v.photos.length > photos.length) doc.font('R').fontSize(9).fillColor('#475569').text('More photos on the online link.');
      }
      doc.moveDown(0.8).font('B').fontSize(10).fillColor('#0f172a').text('Confirmations (OTP verified)');
      const conf = (label: string, at: Date | null) =>
        doc.font('R').text(`${label}: ${at ? new Date(at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'pending'}`);
      conf(`Landlord (${pdfText(v.landlord.name)})`, v.landlordConfirmedAt);
      conf(`Tenant (${pdfText(v.tenant.name)})`, v.tenantConfirmedAt);
      doc
        .moveDown(1)
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text('Generated with BrokerIQ. Each confirmation was made with a one-time password sent to that party.');
    });
  }
}
