import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { RentAgreement } from '@prisma/client';
import { formatINR } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { CommunityService } from '../community/community.service';
import { randomToken, sha256 } from '../../common/utils';
import { pdfText } from '../../common/pdf';
import { env } from '../../config/env';
import { issueOtp, maskContact, verifyOtp } from './otp';

type Party = 'LANDLORD' | 'TENANT';
const web = () => env().PUBLIC_WEB_URL.replace(/\/$/, '');
const api = () => env().PUBLIC_API_URL.replace(/\/$/, '');
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** SHA-256 over the agreement's terms (what both parties confirm); any change to a term changes it. */
export function agreementHash(a: RentAgreement) {
  const terms = {
    landlordName: a.landlordName,
    landlordAddress: a.landlordAddress,
    tenantName: a.tenantName,
    tenantAddress: a.tenantAddress,
    propertyAddress: a.propertyAddress,
    rent: a.rent,
    deposit: a.deposit,
    maintenance: a.maintenance,
    startDate: a.startDate.toISOString(),
    months: a.months,
    lockInMonths: a.lockInMonths,
    noticeMonths: a.noticeMonths,
    escalationPct: a.escalationPct,
    furnishing: a.furnishing,
    extraClauses: a.extraClauses,
  };
  return sha256(JSON.stringify(terms));
}

/**
 * Electronic confirmation of a rent agreement: each party gets a link, reads the draft and confirms with an OTP
 * sent to their email. The PDF then carries a certificate page (who, when, IP, SHA-256 of the terms).
 * It records consent; it is not a substitute for stamp duty or registration.
 */
@Injectable()
export class EsignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly community: CommunityService,
  ) {}

  async start(userId: string, agreementId: string, emails: { landlordEmail: string; tenantEmail: string }) {
    const a = await this.prisma.rentAgreement.findFirst({ where: { id: agreementId, createdById: userId }, include: { signatures: true } });
    if (!a) throw new NotFoundException('Agreement नहीं मिला');
    if (a.signStatus === 'SIGNED') throw new BadRequestException('यह agreement पहले ही sign हो चुका है');
    const documentHash = agreementHash(a);
    await this.prisma.rentAgreement.update({
      where: { id: a.id },
      data: { signStatus: 'SIGNING', documentHash, landlordEmail: emails.landlordEmail.toLowerCase(), tenantEmail: emails.tenantEmail.toLowerCase() },
    });
    const parties: { party: Party; name: string; email: string; phone: string | null }[] = [
      { party: 'LANDLORD', name: a.landlordName, email: emails.landlordEmail.toLowerCase(), phone: a.landlordPhone },
      { party: 'TENANT', name: a.tenantName, email: emails.tenantEmail.toLowerCase(), phone: a.tenantPhone },
    ];
    for (const p of parties) {
      const existing = a.signatures.find((s) => s.party === p.party);
      if (existing?.signedAt && existing.email === p.email) continue;
      const sig = await this.prisma.agreementSignature.upsert({
        where: { agreementId_party: { agreementId: a.id, party: p.party } },
        create: { agreementId: a.id, party: p.party, name: p.name, email: p.email, phone: p.phone, token: randomToken(18) },
        update: { email: p.email, name: p.name, signedAt: null, otpHash: null, otpExpiresAt: null, attempts: 0, token: randomToken(18) },
      });
      await this.mail.send({
        to: p.email,
        subject: `Rent agreement confirm करें — ${a.propertyAddress.slice(0, 60)}`,
        html:
          `<p>नमस्ते ${escape(p.name)},</p><p>${escape(a.propertyAddress)} का rent agreement (किराया ${formatINR(a.rent)}/month) आपकी confirmation के लिए तैयार है।</p>` +
          `<p><a href="${web()}/sign/${sig.token}">Agreement पढ़ें और OTP से confirm करें</a></p>` +
          `<p style="color:#64748b;font-size:12px">यह electronic confirmation है — stamp duty / registration की जगह नहीं लेता।</p>`,
      });
    }
    return this.status(a.id);
  }

  async status(agreementId: string) {
    const a = await this.prisma.rentAgreement.findUniqueOrThrow({ where: { id: agreementId }, include: { signatures: true } });
    return {
      signStatus: a.signStatus,
      documentHash: a.documentHash,
      signedAt: a.signedAt,
      signatures: a.signatures.map((s) => ({ party: s.party, name: s.name, email: s.email ? maskContact(s.email) : null, signedAt: s.signedAt })),
      pdfUrl: a.signatures[0] ? `${api()}/api/public/sign/${a.signatures[0].token}/pdf` : null,
    };
  }

  private async byToken(token: string) {
    const s = await this.prisma.agreementSignature.findUnique({ where: { token }, include: { agreement: { include: { signatures: true } } } });
    if (!s) throw new NotFoundException('Link गलत या पुराना है');
    return s;
  }

  async view(token: string) {
    const s = await this.byToken(token);
    const a = s.agreement;
    return {
      party: s.party,
      name: s.name,
      signedAt: s.signedAt,
      signStatus: a.signStatus,
      documentHash: a.documentHash,
      termsChanged: !!a.documentHash && a.documentHash !== agreementHash(a),
      agreement: {
        landlordName: a.landlordName,
        tenantName: a.tenantName,
        propertyAddress: a.propertyAddress,
        rent: a.rent,
        deposit: a.deposit,
        maintenance: a.maintenance,
        startDate: a.startDate,
        months: a.months,
        lockInMonths: a.lockInMonths,
        noticeMonths: a.noticeMonths,
      },
      parties: a.signatures.map((x) => ({ party: x.party, name: x.name, signedAt: x.signedAt })),
      pdfUrl: `${api()}/api/public/sign/${token}/pdf`,
      sentTo: s.email ? maskContact(s.email) : null,
    };
  }

  async requestOtp(token: string) {
    const s = await this.byToken(token);
    if (s.signedAt) throw new BadRequestException('आप पहले ही confirm कर चुके हैं');
    if (!s.email) throw new BadRequestException('Email नहीं है — जिसने agreement भेजा उससे संपर्क करें');
    const { otp, state } = issueOtp(`sign:${s.id}`);
    await this.prisma.agreementSignature.update({ where: { id: s.id }, data: { otpHash: state.hash, otpExpiresAt: new Date(state.exp), attempts: 0 } });
    await this.mail.send({
      to: s.email,
      subject: `OTP ${otp} — rent agreement confirmation`,
      html: `<p>Rent agreement confirm करने का OTP: <b>${otp}</b> (10 मिनट तक)। किसी को न बताएँ।</p>`,
    });
    return { sentTo: maskContact(s.email) };
  }

  async confirm(token: string, otp: string, meta: { ip?: string; ua?: string }) {
    const s = await this.byToken(token);
    if (s.signedAt) return this.view(token);
    const a = s.agreement;
    if (a.documentHash && a.documentHash !== agreementHash(a)) throw new BadRequestException('Agreement बदल गया है — भेजने वाले से नया link मँगवाएँ');
    const ok = verifyOtp(s.otpHash ? { hash: s.otpHash, exp: s.otpExpiresAt?.getTime() ?? 0, tries: s.attempts } : null, `sign:${s.id}`, otp);
    if (!ok) {
      await this.prisma.agreementSignature.update({ where: { id: s.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('OTP गलत है');
    }
    await this.prisma.agreementSignature.update({
      where: { id: s.id },
      data: { signedAt: new Date(), otpHash: null, otpExpiresAt: null, ip: meta.ip ?? null, userAgent: meta.ua?.slice(0, 300) ?? null },
    });
    const all = await this.prisma.agreementSignature.findMany({ where: { agreementId: a.id } });
    if (all.length === 2 && all.every((x) => x.signedAt)) {
      await this.prisma.rentAgreement.update({ where: { id: a.id }, data: { signStatus: 'SIGNED', signedAt: new Date() } });
      for (const x of all.filter((y) => y.email))
        await this.mail
          .send({
            to: x.email!,
            subject: 'Rent agreement — दोनों ने confirm किया',
            html: `<p>Landlord और tenant दोनों ने agreement confirm कर दिया है।</p><p><a href="${api()}/api/public/sign/${x.token}/pdf">Final PDF (certificate के साथ)</a></p>`,
          })
          .catch(() => undefined);
    }
    return this.view(token);
  }

  async pdf(token: string) {
    const s = await this.byToken(token);
    const a = s.agreement;
    const signed = a.signatures.filter((x) => x.signedAt);
    return this.community.renderAgreement(a, (doc) => {
      if (!signed.length) return;
      doc.addPage();
      doc.font('B').fontSize(15).fillColor('#0f172a').text('Electronic confirmation certificate', { align: 'center' });
      doc.moveDown(0.8).font('R').fontSize(10);
      doc.text(`Agreement terms SHA-256: ${a.documentHash ?? agreementHash(a)}`);
      doc.moveDown(0.6);
      for (const x of a.signatures) {
        doc.font('B').text(`${x.party === 'LANDLORD' ? 'Licensor' : 'Licensee'}: ${pdfText(x.name)}`);
        doc
          .font('R')
          .text(
            x.signedAt
              ? `Confirmed on ${x.signedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST with a one-time password sent to ${x.email ? maskContact(x.email) : '-'}; IP ${x.ip ?? '-'}; device ${pdfText(x.userAgent?.slice(0, 90)) || '-'}`
              : 'Pending',
          );
        doc.moveDown(0.5);
      }
      doc
        .moveDown(1)
        .fontSize(8.5)
        .fillColor('#64748b')
        .text(
          'This page records that each party reviewed the terms above and confirmed them electronically with an OTP. It is evidence of consent; it does not replace stamp duty, notarisation or registration where the law requires them.',
          { align: 'justify' },
        );
    });
  }
}
