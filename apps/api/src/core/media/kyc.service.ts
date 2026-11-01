import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { KycDocType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageService } from './local-storage.service';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import { kycView } from '../../common/kyc-view';
import { env } from '../../config/env';

const hash = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const keyPattern = /^kyc\/([A-Za-z0-9_-]{1,64})\/\d{6}\/[A-Za-z0-9]{20}$/;
type SubjectDoc = { userId: string | null; organizationId: string | null; user?: { organizationId: string | null; role: string } | null };
const poseNames = ['LIVELINESS_STRAIGHT', 'LIVELINESS_LEFT', 'LIVELINESS_RIGHT'];
export interface PersonalKycInput {
  aadhaarNumber: string;
  aadhaarPhotoUrl: string;
  panNumber: string;
  panPhotoUrl: string;
  livelinessStraightUrl: string;
  livelinessLeftUrl: string;
  livelinessRightUrl: string;
}

@Injectable()
export class KycService {
  constructor(
    private readonly db: PrismaService,
    private readonly store: LocalStorageService,
  ) {}

  canView(user: RequestUser, doc: SubjectDoc) {
    if (user.role === 'SUPER_ADMIN' || doc.userId === user.id) return true;
    if (user.role !== 'BROKER_ADMIN' || !user.orgId || doc.organizationId !== user.orgId) return false;
    return !doc.userId || (doc.user?.role === 'BROKER_AGENT' && doc.user.organizationId === user.orgId);
  }

  private async document(id: string, user: RequestUser) {
    const doc = await this.db.kycDocument.findUnique({ where: { id }, include: { user: { select: { organizationId: true, role: true } } } });
    if (!doc || !this.canView(user, doc)) throw new NotFoundException('KYC document unavailable for this account');
    return doc;
  }

  async preview(id: string, user: RequestUser) {
    const doc = await this.document(id, user);
    if (!this.store.enabled) throw new IntegrationNotConfiguredException('private_storage');
    if (!doc.privateKey || !doc.fileSha256) throw new ConflictException('Document का private preview तैयार किया जा रहा है। Super Admin से संपर्क करें।');
    const result = await this.store.read(doc.privateKey);
    if (hash(result.body) !== doc.fileSha256) throw new ConflictException('Document integrity check failed. Please contact Super Admin.');
    await this.db.auditLog.create({
      data: { actorId: user.id, actorRole: user.role, organizationId: user.orgId, action: 'kyc.preview', entity: 'KycDocument', entityId: id },
    });
    return result;
  }

  /** Raw upload previews are owner-only; bound documents follow current subject/firm permissions. */
  async authorizeRaw(key: string, user: RequestUser) {
    const docs = await this.db.kycDocument.findMany({
      where: { OR: [{ privateKey: key }, { fileUrl: { endsWith: '/api/media/f/' + key } }] },
      include: { user: { select: { organizationId: true, role: true } } },
    });
    if (docs.length) {
      const doc = docs.find((item) => this.canView(user, item));
      if (!doc) throw new ForbiddenException('KYC document belongs to another subject');
      return doc;
    }
    if (user.role !== 'SUPER_ADMIN' && keyPattern.exec(key)?.[1] !== user.id) throw new ForbiddenException('KYC upload belongs to another account');
    return null;
  }

  private async upload(url: string, user: RequestUser, subject: { userId: string | null; organizationId: string | null }, face = false) {
    let key: string | null = null;
    try {
      const parsed = new URL(url);
      const origin = new URL(env().PUBLIC_API_URL).origin;
      if (parsed.origin !== origin || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error();
      const existing = /^\/api\/media\/kyc\/([A-Za-z0-9_-]+)$/.exec(parsed.pathname);
      if (existing) {
        const doc = await this.document(existing[1], user);
        if (doc.userId !== subject.userId || doc.organizationId !== subject.organizationId || !doc.privateKey) throw new Error();
        key = doc.privateKey;
      } else {
        key = parsed.pathname.startsWith('/api/media/f/') ? parsed.pathname.slice('/api/media/f/'.length) : null;
        if (!key || keyPattern.exec(key)?.[1] !== user.id) throw new Error();
        const bound = await this.db.kycDocument.findFirst({ where: { privateKey: key } });
        if (bound && (bound.userId !== subject.userId || bound.organizationId !== subject.organizationId)) throw new Error();
      }
    } catch {
      throw new BadRequestException('KYC के लिए अपना private upload चुनें। बाहरी या दूसरे account का URL स्वीकार नहीं है।');
    }
    if (!key || !this.store.enabled) throw new IntegrationNotConfiguredException('private_storage');
    const content = await this.store.read(key);
    if (content.contentType === 'application/pdf' && !face) {
      if (content.body.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('Invalid PDF document');
    } else {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(content.contentType))
        throw new BadRequestException('KYC में valid image या PDF चाहिए; face captures image होने चाहिए।');
      const meta = await sharp(content.body, { limitInputPixels: 20_000_000 })
        .metadata()
        .catch(() => null);
      if (!meta?.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format ?? '')) throw new BadRequestException('Invalid KYC image');
    }
    return { privateKey: key, fileSha256: hash(content.body), fileUrl: `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/media/f/${key}` };
  }

  async personal(user: RequestUser, body: PersonalKycInput) {
    if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role)) throw new ForbiddenException();
    if (!/^\d{12}$/.test(body.aadhaarNumber) || !/^[A-Z]{5}\d{4}[A-Z]$/.test(body.panNumber)) throw new BadRequestException('Aadhaar / PAN format invalid है।');
    const organizationId = requireOrg(user),
      subject = { userId: user.id, organizationId };
    const specs: { docType: KycDocType; docNumber: string; url: string; face?: boolean }[] = [
      { docType: 'AADHAAR', docNumber: body.aadhaarNumber, url: body.aadhaarPhotoUrl },
      { docType: 'PAN', docNumber: body.panNumber, url: body.panPhotoUrl },
      ...poseNames.map((docNumber, index) => ({
        docType: 'OTHER' as const,
        docNumber,
        url: [body.livelinessStraightUrl, body.livelinessLeftUrl, body.livelinessRightUrl][index],
        face: true,
      })),
    ];
    const assets = await Promise.all(specs.map((item) => this.upload(item.url, user, subject, item.face)));
    if (new Set(assets.slice(2).map((a) => a.fileSha256)).size !== 3) throw new BadRequestException('तीनों poses के अलग captures चाहिए।');
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const current = await tx.kycDocument.findMany({ where: { userId: user.id, organizationId, supersededAt: null } });
      if (current.some((doc) => doc.status === 'VERIFIED')) throw new ConflictException('Verified KYC बदल नहीं सकती। Super Admin से संपर्क करें।');
      if (
        current.length === 5 &&
        current.every((doc) => doc.status === 'PENDING') &&
        specs.every((spec, index) =>
          current.some((doc) => doc.docType === spec.docType && doc.docNumber === spec.docNumber && doc.fileSha256 === assets[index].fileSha256),
        )
      )
        return { docs: current, replayed: true };
      await tx.kycDocument.updateMany({ where: { userId: user.id, supersededAt: null }, data: { supersededAt: new Date() } });
      const docs = await tx.kycDocument.createManyAndReturn({
        data: specs.map((spec, index) => ({ ...subject, docType: spec.docType, docNumber: spec.docNumber, ...assets[index], status: 'PENDING' })),
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          organizationId,
          action: 'kyc.personal.submit',
          entity: 'User',
          entityId: user.id,
          meta: { documentIds: docs.map((d) => d.id) },
        },
      });
      return { docs, replayed: false };
    });
    return { ok: true, status: 'PENDING', documentsCount: result.docs.length, replayed: result.replayed };
  }

  async personalView(user: RequestUser, targetId = user.id) {
    const target = await this.db.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true, organizationId: true },
    });
    if (
      !target ||
      (user.role !== 'SUPER_ADMIN' &&
        targetId !== user.id &&
        (user.role !== 'BROKER_ADMIN' || !user.orgId || target.organizationId !== user.orgId || target.role !== 'BROKER_AGENT'))
    )
      throw new NotFoundException('KYC subject unavailable');
    const docs = (
      await this.db.kycDocument.findMany({
        where: { userId: targetId, organizationId: target.organizationId, supersededAt: null },
        orderBy: { createdAt: 'desc' },
      })
    ).map(kycView);
    const find = (type: KycDocType, number?: string) => docs.find((doc) => doc.docType === type && (!number || doc.docNumber === number));
    const complete = !!find('AADHAAR') && !!find('PAN') && poseNames.every((pose) => !!find('OTHER', pose));
    const status = !docs.length
      ? 'UNVERIFIED'
      : docs.some((d) => d.status === 'REJECTED')
        ? 'REJECTED'
        : complete && docs.every((d) => d.status === 'VERIFIED')
          ? 'VERIFIED'
          : docs.some((d) => d.status === 'PENDING')
            ? 'PENDING'
            : 'UNVERIFIED';
    return {
      agent: target,
      status,
      aadhaarNumber: find('AADHAAR')?.docNumber ?? null,
      aadhaarPhotoUrl: find('AADHAAR')?.fileUrl ?? null,
      panNumber: find('PAN')?.docNumber ?? null,
      panPhotoUrl: find('PAN')?.fileUrl ?? null,
      livelinessStraightUrl: find('OTHER', poseNames[0])?.fileUrl ?? null,
      livelinessLeftUrl: find('OTHER', poseNames[1])?.fileUrl ?? null,
      livelinessRightUrl: find('OTHER', poseNames[2])?.fileUrl ?? null,
      reviewNote: docs.find((d) => d.reviewNote)?.reviewNote ?? null,
      reviewedAt: docs.find((d) => d.reviewedAt)?.reviewedAt ?? null,
      documents: docs,
    };
  }

  async history(user: RequestUser, targetId: string, cursor?: string) {
    // Reuse current subject permissions; former firm reviewers cannot read a moved member.
    await this.personalView(user, targetId);
    const rows = await this.db.kycDocument.findMany({
      where: {
        userId: targetId,
        supersededAt: { not: null },
        ...(user.role === 'BROKER_ADMIN' && targetId !== user.id ? { organizationId: user.orgId! } : {}),
      },
      orderBy: { id: 'desc' },
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return { items: rows.slice(0, 50).map(kycView), nextCursor: rows.length > 50 ? rows[49].id : null };
  }

  async reviewPersonal(user: RequestUser, targetId: string, body: { status: 'VERIFIED' | 'REJECTED'; reviewNote?: string; expectedDocumentIds?: string[] }) {
    if (user.id === targetId) throw new ForbiddenException('अपने KYC की review नहीं कर सकते।');
    if (body.status === 'REJECTED' && !body.reviewNote?.trim()) throw new BadRequestException('Rejection का कारण लिखें।');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${targetId} FOR UPDATE`;
      const target = await tx.user.findUnique({ where: { id: targetId } });
      if (
        !target ||
        (user.role !== 'SUPER_ADMIN' && (user.role !== 'BROKER_ADMIN' || !user.orgId || target.organizationId !== user.orgId || target.role !== 'BROKER_AGENT'))
      )
        throw new NotFoundException();
      const docs = await tx.kycDocument.findMany({ where: { userId: targetId, organizationId: target.organizationId, supersededAt: null } });
      if (!docs.length) throw new BadRequestException('कोई KYC submission नहीं है।');
      const expected = body.expectedDocumentIds;
      if (!expected || new Set(expected).size !== docs.length || expected.length !== docs.length || !docs.every((doc) => expected.includes(doc.id)))
        throw new ConflictException('KYC बदल गई है। Documents reload करके दोबारा review करें।');
      if (docs.every((doc) => doc.status === body.status)) return { ok: true, status: body.status, replayed: true };
      if (docs.some((doc) => doc.status !== 'PENDING')) throw new ConflictException('यह submission पहले review हो चुकी है। Reload करें।');
      if (
        body.status === 'VERIFIED' &&
        (docs.length !== 5 ||
          !docs.some((d) => d.docType === 'AADHAAR') ||
          !docs.some((d) => d.docType === 'PAN') ||
          !poseNames.every((pose) => docs.some((d) => d.docType === 'OTHER' && d.docNumber === pose)))
      )
        throw new BadRequestException('सभी पाँच KYC documents जरूरी हैं।');
      if (body.status === 'VERIFIED' && docs.some((doc) => !doc.privateKey || !doc.fileSha256))
        throw new ConflictException('Private media migration पूरी होने के बाद review करें।');
      await tx.kycDocument.updateMany({
        where: { id: { in: docs.map((doc) => doc.id) }, supersededAt: null },
        data: { status: body.status, reviewNote: body.status === 'REJECTED' ? body.reviewNote!.trim() : null, reviewedById: user.id, reviewedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          organizationId: target.organizationId,
          action: 'kyc.personal.review',
          entity: 'User',
          entityId: targetId,
          meta: { status: body.status, documentIds: docs.map((d) => d.id) },
        },
      });
      return { ok: true, status: body.status, replayed: false };
    });
  }

  async firmView(user: RequestUser) {
    if (!['BROKER_ADMIN', 'BROKER_AGENT', 'SUPER_ADMIN'].includes(user.role)) throw new ForbiddenException();
    const id = requireOrg(user);
    const organization = await this.db.organization.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, reraNumber: true, gstNumber: true, verification: true },
    });
    if (user.role === 'BROKER_AGENT')
      return {
        organization: { id: organization.id, name: organization.name, verification: organization.verification },
        documents: [],
        reraDocument: null,
        gstDocument: null,
        panDocument: null,
        canEdit: false,
      };
    const documents = (
      await this.db.kycDocument.findMany({ where: { organizationId: id, userId: null, supersededAt: null }, orderBy: { createdAt: 'desc' } })
    ).map(kycView);
    return {
      organization,
      documents,
      reraDocument: documents.find((doc) => doc.docType === 'RERA_CERTIFICATE') ?? null,
      gstDocument: documents.find((doc) => doc.docType === 'GST_CERTIFICATE') ?? null,
      panDocument: documents.find((doc) => doc.docType === 'PAN') ?? null,
      canEdit: organization.verification !== 'VERIFIED',
    };
  }

  async firm(
    user: RequestUser,
    body: {
      reraNumber?: string | null;
      reraCertificateUrl?: string | null;
      gstNumber?: string | null;
      gstCertificateUrl?: string | null;
      panNumber?: string | null;
      panPhotoUrl?: string | null;
    },
  ) {
    if (!['BROKER_ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new ForbiddenException();
    const organizationId = requireOrg(user),
      subject = { organizationId, userId: null };
    const types: { docType: KycDocType; url: string | null | undefined; number: string | null | undefined }[] = [
      { docType: 'RERA_CERTIFICATE', url: body.reraCertificateUrl, number: body.reraNumber },
      { docType: 'GST_CERTIFICATE', url: body.gstCertificateUrl, number: body.gstNumber },
      { docType: 'PAN', url: body.panPhotoUrl, number: body.panNumber?.trim().toUpperCase() },
    ];
    if (body.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(body.panNumber.trim().toUpperCase())) throw new BadRequestException('PAN format invalid है।');
    const assets = await Promise.all(types.map((spec) => (spec.url ? this.upload(spec.url, user, subject) : null)));
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      if (org.verification === 'VERIFIED') throw new ConflictException('Verified firm KYC बदल नहीं सकती। Super Admin से संपर्क करें।');
      const current = await tx.kycDocument.findMany({ where: { organizationId, userId: null, supersededAt: null } });
      let changed = false;
      for (let i = 0; i < types.length; i++) {
        const spec = types[i],
          asset = assets[i],
          existing = current.filter((doc) => doc.docType === spec.docType);
        const number =
          spec.number === undefined
            ? (existing[0]?.docNumber ?? (spec.docType === 'RERA_CERTIFICATE' ? org.reraNumber : spec.docType === 'GST_CERTIFICATE' ? org.gstNumber : null))
            : spec.number?.trim() || null;
        if (spec.url === undefined) {
          if (spec.number !== undefined && existing.some((doc) => doc.docNumber !== number)) {
            if (existing.some((doc) => doc.status === 'VERIFIED')) throw new ConflictException('Verified document number बदल नहीं सकता।');
            for (const doc of existing) {
              await tx.kycDocument.update({ where: { id: doc.id }, data: { supersededAt: new Date() } });
              await tx.kycDocument.create({
                data: {
                  ...subject,
                  docType: doc.docType,
                  docNumber: number,
                  fileUrl: doc.fileUrl,
                  privateKey: doc.privateKey,
                  fileSha256: doc.fileSha256,
                  status: 'PENDING',
                },
              });
            }
            changed = true;
          }
          continue;
        }
        if (
          asset &&
          existing.length === 1 &&
          existing[0].fileSha256 === asset.fileSha256 &&
          existing[0].docNumber === number &&
          ['PENDING', 'VERIFIED'].includes(existing[0].status)
        )
          continue;
        if (existing.some((doc) => doc.status === 'VERIFIED')) throw new ConflictException('Verified document बदल नहीं सकता।');
        changed = true;
        await tx.kycDocument.updateMany({ where: { id: { in: existing.map((doc) => doc.id) }, supersededAt: null }, data: { supersededAt: new Date() } });
        if (asset) await tx.kycDocument.create({ data: { ...subject, ...asset, docType: spec.docType, docNumber: number, status: 'PENDING' } });
      }
      if (!(await tx.kycDocument.count({ where: { ...subject, supersededAt: null } }))) throw new BadRequestException('कम-से-कम एक firm document upload करें।');
      const numbersChanged =
        (body.reraNumber !== undefined && (body.reraNumber?.trim() || null) !== org.reraNumber) ||
        (body.gstNumber !== undefined && (body.gstNumber?.trim() || null) !== org.gstNumber);
      if (!changed && !numbersChanged && org.verification === 'PENDING') return { ok: true, verification: 'PENDING', replayed: true };
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          verification: 'PENDING',
          ...(body.reraNumber !== undefined ? { reraNumber: body.reraNumber?.trim() || null } : {}),
          ...(body.gstNumber !== undefined ? { gstNumber: body.gstNumber?.trim() || null } : {}),
        },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, actorRole: user.role, organizationId, action: 'kyc.firm.submit', entity: 'Organization', entityId: organizationId },
      });
      return { ok: true, verification: 'PENDING', replayed: false };
    });
  }

  async submitOne(user: RequestUser, body: { docType: KycDocType; fileUrl: string; docNumber?: string | null }) {
    if (user.role === 'BROKER_AGENT') throw new BadRequestException('Agent KYC की पूरी पाँच-document pipeline उपयोग करें।');
    if (user.role === 'BROKER_ADMIN') {
      const property = (
        {
          PAN: ['panPhotoUrl', 'panNumber'],
          RERA_CERTIFICATE: ['reraCertificateUrl', 'reraNumber'],
          GST_CERTIFICATE: ['gstCertificateUrl', 'gstNumber'],
        } as const
      )[body.docType as 'PAN' | 'RERA_CERTIFICATE' | 'GST_CERTIFICATE'];
      if (!property) throw new BadRequestException('Firm KYC document type invalid है।');
      await this.firm(user, { [property[0]]: body.fileUrl, [property[1]]: body.docNumber });
      const doc = await this.db.kycDocument.findFirstOrThrow({
        where: { organizationId: requireOrg(user), userId: null, docType: body.docType, supersededAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return kycView(doc);
    }
    if (user.role !== 'USER') throw new ForbiddenException('यह KYC submission इस role के लिए नहीं है।');
    const asset = await this.upload(body.fileUrl, user, { userId: user.id, organizationId: null });
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const previous = await tx.kycDocument.findMany({ where: { userId: user.id, docType: body.docType, supersededAt: null } });
      if (previous.some((doc) => doc.status === 'VERIFIED')) throw new ConflictException('Verified KYC बदल नहीं सकती।');
      await tx.kycDocument.updateMany({ where: { id: { in: previous.map((doc) => doc.id) } }, data: { supersededAt: new Date() } });
      return kycView(await tx.kycDocument.create({ data: { ...asset, userId: user.id, docType: body.docType, docNumber: body.docNumber, status: 'PENDING' } }));
    });
  }

  async reviewDocument(user: RequestUser, id: string, body: { status: 'VERIFIED' | 'REJECTED'; note?: string; verifyOrganization?: boolean }) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    if (body.status === 'REJECTED' && !body.note?.trim()) throw new BadRequestException('Rejection का कारण जरूरी है।');
    const initial = await this.db.kycDocument.findUnique({ where: { id } });
    if (!initial) throw new NotFoundException();
    if (initial.userId === user.id) throw new ForbiddenException('अपना KYC approve नहीं कर सकते।');
    return this.db.$transaction(async (tx) => {
      if (initial.userId) await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId} FOR UPDATE`;
      else if (initial.organizationId) await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${initial.organizationId} FOR UPDATE`;
      const current = await tx.kycDocument.findUniqueOrThrow({ where: { id } });
      if (current.supersededAt || (current.status !== 'PENDING' && current.status !== body.status))
        throw new ConflictException('यह document बदल गई है या review हो चुकी है। Reload करें।');
      if (body.status === 'VERIFIED' && (!current.privateKey || !current.fileSha256))
        throw new ConflictException('Private media migration पूरी होने के बाद review करें।');
      if (current.status === body.status) return { doc: current, firmVerified: false, replayed: true };
      const doc = await tx.kycDocument.update({
        where: { id },
        data: { status: body.status, reviewNote: body.status === 'REJECTED' ? body.note!.trim() : null, reviewedById: user.id, reviewedAt: new Date() },
      });
      if (doc.userId && body.status === 'VERIFIED')
        await tx.user.updateMany({ where: { id: doc.userId, role: 'USER', tenantVerifiedAt: null }, data: { tenantVerifiedAt: new Date() } });
      let firmVerified = false;
      // Personal Agent KYC also has organizationId; it must never verify the firm.
      if (!doc.userId && doc.organizationId && body.verifyOrganization) {
        const pending = await tx.kycDocument.count({
          where: { organizationId: doc.organizationId, userId: null, supersededAt: null, status: { not: 'VERIFIED' } },
        });
        if (body.status === 'REJECTED' || pending === 0) {
          await tx.organization.update({ where: { id: doc.organizationId }, data: { verification: body.status } });
          firmVerified = body.status === 'VERIFIED';
          if (firmVerified) await tx.listing.updateMany({ where: { organizationId: doc.organizationId, deletedAt: null }, data: { isVerified: true } });
        }
      }
      return { doc, firmVerified, replayed: false };
    });
  }
}
