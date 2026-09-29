import { existsSync } from 'fs';
import { join } from 'path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { FlatmateProfile, Prisma, RentAgreement } from '@prisma/client';
import { formatINR, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import type { RequestUser } from '../../common/decorators';

export type FlatmateInput = Omit<Prisma.FlatmateProfileUncheckedCreateInput, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** 0–100 compatibility between two flatmate seekers. */
export function flatmateScore(a: FlatmateProfile, b: FlatmateProfile) {
  if (a.prefGender !== 'ANY' && a.prefGender !== b.gender) return 0;
  if (b.prefGender !== 'ANY' && b.prefGender !== a.gender) return 0;
  let s = 40;
  const overlap = a.localityIds.filter((x) => b.localityIds.includes(x)).length;
  if (overlap) s += 20;
  else if (!a.localityIds.length || !b.localityIds.length) s += 8;
  if (a.officeHub && a.officeHub === b.officeHub) s += 12;
  if (a.budgetMax && b.budgetMax) {
    const ratio = Math.min(a.budgetMax, b.budgetMax) / Math.max(a.budgetMax, b.budgetMax);
    s += Math.round(ratio * 12);
  }
  if (a.food === 'ANY' || b.food === 'ANY' || a.food === b.food) s += 6;
  if (a.smoking === b.smoking) s += 4;
  if (a.drinking === b.drinking) s += 3;
  if (a.pets === b.pets) s += 3;
  return Math.min(100, s);
}

function fontPath(file: string) {
  const dirs = [join(__dirname, '../../../assets/fonts'), join(__dirname, '../../../../assets/fonts'), join(process.cwd(), 'assets/fonts'), join(process.cwd(), 'apps/api/assets/fonts')];
  return join(dirs.find((d) => existsSync(join(d, file))) ?? dirs[0], file);
}

const ordinalMonths = (n: number) => `${n} (${['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? n}) month${n === 1 ? '' : 's'}`;

/**
 * Community features: flatmate / room-share matching, draft 11-month rent agreement PDF,
 * and the move-in services directory (partners added by Super Admin).
 */
@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------------ flatmates
  myProfile(userId: string) {
    return this.prisma.flatmateProfile.findUnique({ where: { userId } });
  }

  upsertProfile(userId: string, input: FlatmateInput) {
    return this.prisma.flatmateProfile.upsert({ where: { userId }, create: { ...input, userId }, update: input });
  }

  /** Other active seekers ranked by compatibility; no phone numbers here. */
  async matches(userId: string) {
    const me = await this.prisma.flatmateProfile.findUnique({ where: { userId } });
    if (!me) throw new BadRequestException('पहले अपनी flatmate profile बनाएँ');
    const others = await this.prisma.flatmateProfile.findMany({ where: { isActive: true, userId: { not: userId } }, take: 500, orderBy: { updatedAt: 'desc' } });
    const users = await this.prisma.user.findMany({ where: { id: { in: others.map((o) => o.userId) } }, select: { id: true, name: true, avatarUrl: true, tenantVerifiedAt: true } });
    const conns = await this.prisma.flatmateConnect.findMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } });
    return others
      .map((o) => {
        const u = users.find((x) => x.id === o.userId);
        const c = conns.find((x) => (x.fromUserId === userId && x.toUserId === o.userId) || (x.toUserId === userId && x.fromUserId === o.userId));
        return {
          ...o,
          score: flatmateScore(me, o),
          name: (u?.name ?? 'User').split(' ')[0],
          avatarUrl: u?.avatarUrl ?? null,
          verified: !!u?.tenantVerifiedAt,
          connection: c ? { id: c.id, status: c.status, mine: c.fromUserId === userId } : null,
        };
      })
      .filter((o) => o.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60);
  }

  async connect(userId: string, toUserId: string, message?: string | null) {
    if (toUserId === userId) throw new BadRequestException();
    const [me, other] = await Promise.all([this.prisma.flatmateProfile.findUnique({ where: { userId } }), this.prisma.flatmateProfile.findUnique({ where: { userId: toUserId } })]);
    if (!me || !other?.isActive) throw new BadRequestException('Profile उपलब्ध नहीं');
    const reverse = await this.prisma.flatmateConnect.findUnique({ where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: userId } } });
    if (reverse) return this.respond(userId, reverse.id, 'ACCEPTED');
    const c = await this.prisma.flatmateConnect.upsert({ where: { fromUserId_toUserId: { fromUserId: userId, toUserId } }, create: { fromUserId: userId, toUserId, message: message ?? null }, update: { message: message ?? undefined } });
    await this.notifications.notify(toUserId, { kind: 'FLATMATE_REQUEST', title: '🤝 किसी ने आपको flatmate के लिए request भेजी', body: message ?? undefined, link: '/account/flatmates' });
    return c;
  }

  async respond(userId: string, id: string, status: 'ACCEPTED' | 'DECLINED') {
    const c = await this.prisma.flatmateConnect.findUnique({ where: { id } });
    if (!c || c.toUserId !== userId) throw new ForbiddenException();
    const updated = await this.prisma.flatmateConnect.update({ where: { id }, data: { status } });
    if (status === 'ACCEPTED') await this.notifications.notify(c.fromUserId, { kind: 'FLATMATE_ACCEPTED', title: '✅ Flatmate request accept हुई — अब number देख सकते हैं', link: '/account/flatmates' });
    return updated;
  }

  /** Accepted connections with the other person's contact. */
  async connections(userId: string) {
    const rows = await this.prisma.flatmateConnect.findMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] }, orderBy: { updatedAt: 'desc' } });
    const ids = rows.map((r) => (r.fromUserId === userId ? r.toUserId : r.fromUserId));
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatarUrl: true, phone: true } });
    return rows.map((r) => {
      const otherId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
      const u = users.find((x) => x.id === otherId);
      return { id: r.id, status: r.status, incoming: r.toUserId === userId, message: r.message, other: { id: otherId, name: u?.name ?? 'User', avatarUrl: u?.avatarUrl ?? null, phone: r.status === 'ACCEPTED' ? u?.phone ?? null : null } };
    });
  }

  // ------------------------------------------------------------------ rent agreement
  listAgreements(userId: string) {
    return this.prisma.rentAgreement.findMany({ where: { createdById: userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  createAgreement(user: RequestUser, input: Omit<Prisma.RentAgreementUncheckedCreateInput, 'id' | 'createdById'>) {
    return this.prisma.rentAgreement.create({ data: { ...input, createdById: user.id, organizationId: user.orgId ?? null } });
  }

  async agreementPdf(userId: string, id: string): Promise<Buffer> {
    const a = await this.prisma.rentAgreement.findFirst({ where: { id, createdById: userId } });
    if (!a) throw new NotFoundException();
    return this.renderAgreement(a);
  }

  renderAgreement(a: RentAgreement): Promise<Buffer> {
    const start = a.startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const end = new Date(a.startDate);
    end.setMonth(end.getMonth() + a.months);
    end.setDate(end.getDate() - 1);
    const clauses = [
      `The Licensor hereby grants the Licensee leave and licence to occupy the premises at ${a.propertyAddress} ("the Premises")${a.furnishing ? `, ${a.furnishing.toLowerCase().replace('_', ' ')}` : ''}, for residential use only, for a period of ${ordinalMonths(a.months)} from ${start} to ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      `The Licensee shall pay a monthly rent of ${formatINR(a.rent)} on or before the 5th day of each English calendar month.${a.maintenance ? ` Maintenance charges of ${formatINR(a.maintenance)} per month shall be paid by the Licensee.` : ''}`,
      `The Licensee has paid an interest-free refundable security deposit of ${formatINR(a.deposit)}, to be refunded at the end of the term after deducting any unpaid dues and costs of damage beyond normal wear and tear.`,
      a.lockInMonths > 0 ? `There is a lock-in period of ${ordinalMonths(a.lockInMonths)}, during which neither party may terminate this agreement except for breach.` : null,
      `Either party may terminate this agreement by giving ${ordinalMonths(a.noticeMonths)} written notice to the other party.`,
      a.escalationPct > 0 ? `On renewal, the rent shall be increased by ${a.escalationPct}%.` : null,
      'Electricity, water and other utility charges shall be paid by the Licensee as per actual consumption.',
      'The Licensee shall not sublet, assign or part with possession of the Premises, and shall not carry out structural changes without the written consent of the Licensor.',
      'The Licensee shall keep the Premises in good condition and allow the Licensor to inspect them at reasonable times with prior notice.',
      'The Licensee shall comply with the rules of the society / building and shall not use the Premises for any illegal purpose.',
      'The Licensee has submitted identity proof and shall cooperate in tenant police verification as required by local law.',
      ...a.extraClauses.filter(Boolean),
    ].filter(Boolean) as string[];
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.registerFont('R', fontPath('Inter_500Medium.ttf'));
      doc.registerFont('B', fontPath('Inter_700Bold.ttf'));
      doc.font('B').fontSize(16).text('LEAVE AND LICENCE (RENT) AGREEMENT', { align: 'center' });
      doc.moveDown(0.3).font('R').fontSize(9).fillColor('#64748b').text('DRAFT — to be printed on e-stamp paper of the applicable value and signed by both parties with two witnesses.', { align: 'center' });
      doc.moveDown().fillColor('#0f172a').fontSize(10.5);
      doc.text(`This agreement is made on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at Gurugram, Haryana, between:`);
      doc.moveDown(0.5).font('B').text(`${a.landlordName}`, { continued: true }).font('R').text(`${a.landlordAddress ? `, residing at ${a.landlordAddress}` : ''}${a.landlordPhone ? ` (Ph: ${a.landlordPhone})` : ''}, hereinafter called the "Licensor"; and`);
      doc.moveDown(0.5).font('B').text(`${a.tenantName}`, { continued: true }).font('R').text(`${a.tenantAddress ? `, permanent address ${a.tenantAddress}` : ''}${a.tenantPhone ? ` (Ph: ${a.tenantPhone})` : ''}, hereinafter called the "Licensee".`);
      doc.moveDown().font('B').text('Terms');
      doc.font('R');
      clauses.forEach((c, i) => doc.moveDown(0.4).text(`${i + 1}. ${c}`, { align: 'justify' }));
      doc.moveDown(2);
      const y = doc.y;
      doc.text('Licensor', 56, y).text('Licensee', 330, y);
      doc.moveDown(3).text('Signature: ____________________', 56).text('Signature: ____________________', 330, doc.y - 12);
      doc.moveDown(2).text('Witness 1: ____________________', 56).text('Witness 2: ____________________', 330, doc.y - 12);
      doc.moveDown(2).fontSize(8).fillColor('#94a3b8').text('Generated with BrokerIQ. This is a template, not legal advice — consult a lawyer for your situation.', 56, doc.y, { align: 'center' });
      doc.end();
    });
  }

  // ------------------------------------------------------------------ move-in services
  partners(category?: string, localityId?: string) {
    return this.prisma.servicePartner.findMany({
      where: { isActive: true, ...(category ? { category } : {}), ...(localityId ? { OR: [{ localityIds: { isEmpty: true } }, { localityIds: { has: localityId } }] } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, category: true, name: true, logoUrl: true, description: true, offer: true, website: true },
    });
  }

  async requestService(user: RequestUser, body: { partnerId: string; listingId?: string | null; name: string; phone: string; preferredDate?: Date | null; notes?: string | null }) {
    const p = await this.prisma.servicePartner.findFirst({ where: { id: body.partnerId, isActive: true } });
    if (!p) throw new NotFoundException('Partner नहीं मिला');
    const phone = normalizeIndianPhone(body.phone) ?? body.phone;
    const r = await this.prisma.serviceRequest.create({ data: { partnerId: p.id, userId: user.id, listingId: body.listingId ?? null, name: body.name, phone, preferredDate: body.preferredDate ?? null, notes: body.notes ?? null } });
    if (p.email) {
      await this.mail
        .send({ to: p.email, subject: `BrokerIQ: नया customer — ${body.name}`, html: `<p>BrokerIQ से नई request (${p.category}):</p><p><b>${body.name}</b><br/>📞 ${phone}${body.preferredDate ? `<br/>Date: ${body.preferredDate.toLocaleDateString('en-IN')}` : ''}${body.notes ? `<br/>${body.notes.replace(/</g, '&lt;')}` : ''}</p>` })
        .catch(() => undefined);
    }
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notify(admins.map((a) => a.id), { kind: 'SERVICE_REQUEST', title: `Move-in service request: ${p.name}`, body: `${body.name} · ${phone}`, link: '/admin/services', push: false });
    return r;
  }
}
