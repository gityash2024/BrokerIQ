import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  offeredRequirement,
  capturedEntitySchema,
  extractCapture,
  chatExportMessages,
  inventoryInputSchema,
  brokerRequirementSchema,
  type CapturedEntity,
  type CapturedMessage,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { AuditService } from '../../core/audit/audit.service';
import { AiService, parseJsonLoose } from '../../core/ai/ai.service';
import { OcrService } from './ocr.service';
import type { RequestUser } from '../../common/decorators';
import { z } from 'zod';
import sharp from 'sharp';
import { ModulesService } from '../../core/features/modules.service';
import { openCaptureSource, textMessages, type ArchiveSummary } from './capture-stream';
import { archiveEvidence, prepareArchiveReview, type ReviewAttachment } from './archive-review';

export const captureInputSchema = z
  .object({
    sourceType: z.enum(['TEXT', 'IMAGE', 'CHAT_EXPORT', 'WHATSAPP']),
    rawText: z.string().max(2_000_000).optional(),
    fileDataUrl: z.string().max(18_000_000).optional(),
    fileName: z.string().max(200).optional(),
    senderName: z.string().max(100).optional(),
    senderPhone: z.string().max(25).optional(),
    groupName: z.string().max(150).optional(),
    target: z.enum(['AUTO', 'INVENTORY', 'REQUIREMENT']).optional(),
  })
  .refine((s) => !!s.rawText?.trim() || !!s.fileDataUrl, 'Text or a file is required');
export const reviewSchema = z.object({
  entities: z.array(capturedEntitySchema).max(100),
  ignore: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});
function reviewProvenance(value: Prisma.JsonValue) {
  const ocr = value as { attachments?: ReviewAttachment[] } | null;
  if (!Array.isArray(ocr?.attachments)) return value;
  return {
    ...ocr,
    attachments: ocr.attachments.map(({ mediaRef, ...attachment }) => ({ ...attachment, available: !!mediaRef })),
  };
}

function previewParent(metadata: Prisma.JsonValue) {
  const parent = (metadata as { previewOfImportId?: unknown } | null)?.previewOfImportId;
  return typeof parent === 'string' ? parent : null;
}

function canPreview(batch: { status: string; sourceType: string; mediaRef: string | null; metadata: Prisma.JsonValue; fileName: string | null }) {
  const type = (batch.metadata as { contentType?: string } | null)?.contentType;
  return (
    !previewParent(batch.metadata) &&
    ['NEEDS_REVIEW', 'COMPLETE'].includes(batch.status) &&
    batch.sourceType === 'CHAT_EXPORT' &&
    !!batch.mediaRef &&
    (type === 'application/zip' || (!type && /\.zip$/i.test(batch.fileName ?? '')))
  );
}

const arraySchema = z.array(capturedEntitySchema).max(100);
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly ocr: OcrService,
    private readonly ai: AiService,
    private readonly modules: ModulesService,
  ) {
    this.jobs.register('import.extract', (p) => this.extract(p.batchId));
  }
  private org(user: RequestUser) {
    if (!user.orgId) throw new ForbiddenException('A broker firm is required');
    return user.orgId;
  }
  private scope(user: RequestUser) {
    return user.role === 'SUPER_ADMIN'
      ? {}
      : {
          organizationId: this.org(user),
          ...(user.role === 'BROKER_AGENT' ? { createdById: user.id } : {}),
        };
  }
  async list(user: RequestUser, page = 1) {
    const where = this.scope(user);
    const [items, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        select: {
          id: true,
          fileName: true,
          sourceType: true,
          groupName: true,
          metadata: true,
          status: true,
          lastError: true,
          createdAt: true,
          _count: { select: { entries: { where: { OR: [{ reviewNote: null }, { reviewNote: { not: 'SUPERSEDED_BY_VISUAL_REVIEW' } }] } } } },
        },
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    return {
      items: items.map(({ metadata, ...item }) => ({ ...item, previewOfImportId: previewParent(metadata) })),
      total,
      page,
      pageSize: 30,
      totalPages: Math.ceil(total / 30),
    };
  }
  async get(id: string, user: RequestUser, page = 1, sourcePage?: number, reviewState?: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id, ...this.scope(user) } });
    if (!batch) throw new NotFoundException('Import not found');
    const previewOfImportId = previewParent(batch.metadata);
    const visible = {
      batchId: id,
      ...(sourcePage ? { pageNo: sourcePage } : {}),
      ...(reviewState && !previewOfImportId ? { reviewState } : {}),
      OR: [{ reviewNote: null }, { reviewNote: { not: 'SUPERSEDED_BY_VISUAL_REVIEW' } }],
    };
    const [entries, total, pending] = await Promise.all([
      this.prisma.sourceEntry.findMany({
        where: visible,
        orderBy: [{ pageNo: 'asc' }, { rowNo: 'asc' }, { entryKey: 'asc' }],
        skip: (page - 1) * 50,
        take: 50,
        include: { inventories: { select: { id: true } }, requirements: { select: { id: true } } },
      }),
      this.prisma.sourceEntry.count({ where: visible }),
      this.prisma.sourceEntry.count({ where: { batchId: id, reviewState: 'NEEDS_REVIEW' } }),
    ]);
    return {
      ...batch,
      previewOfImportId,
      canPreview: canPreview(batch),
      rawText: batch.rawText?.slice(0, 20000),
      entries: entries.map((entry) => ({ ...entry, ocr: reviewProvenance(entry.ocr) })),
      total,
      pending,
      page,
      pageSize: 50,
      totalPages: Math.ceil(total / 50),
    };
  }
  async capture(input: z.infer<typeof captureInputSchema>, user: RequestUser) {
    const orgId = this.org(user);
    let bytes: Buffer | undefined;
    let contentType: string | undefined;
    if (input.fileDataUrl) {
      const m = /^data:(image\/(?:png|jpeg|webp)|text\/plain|application\/zip);base64,([a-zA-Z0-9+/=]+)$/.exec(input.fileDataUrl);
      if (!m) throw new BadRequestException('Supported: text, JPG, PNG, WebP or WhatsApp ZIP export');
      contentType = m[1];
      bytes = Buffer.from(m[2], 'base64');
      if (bytes.length > 12 * 1024 * 1024) throw new BadRequestException('File exceeds 12MB capture limit');
    }
    const sourceHash = sha(Buffer.concat([Buffer.from(`${input.groupName ?? ''}\0${input.rawText ?? ''}\0`), bytes ?? Buffer.alloc(0)]));
    let batch = await this.prisma.importBatch.findUnique({
      where: { organizationId_sourceType_sourceHash: { organizationId: orgId, sourceType: input.sourceType, sourceHash } },
    });
    if (!batch) {
      const mediaRef = bytes ? await this.storage.putSource(bytes, contentType!, orgId) : null;
      try {
        batch = await this.prisma.importBatch.create({
          data: {
            organizationId: orgId,
            createdById: user.id,
            sourceType: input.sourceType,
            sourceHash,
            mediaRef,
            rawText: input.rawText,
            fileName: input.fileName,
            senderName: input.senderName,
            senderPhone: input.senderPhone,
            groupName: input.groupName,
            metadata: { contentType: contentType ?? 'text/plain', requestedTarget: input.target ?? 'AUTO' },
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        batch = await this.prisma.importBatch.findUniqueOrThrow({
          where: { organizationId_sourceType_sourceHash: { organizationId: orgId, sourceType: input.sourceType, sourceHash } },
        });
      }
      await this.audit.log(user, 'import.capture', 'ImportBatch', batch.id, { sourceType: input.sourceType });
    }
    if (user.role === 'BROKER_AGENT' && batch.createdById !== user.id)
      throw new ForbiddenException('This source is already captured by another firm member. Ask your firm administrator to review it.');
    if (batch.status === 'PENDING') await this.jobs.enqueue('import.extract', { batchId: batch.id }, { key: `import:${batch.id}` });
    return { id: batch.id, status: batch.status };
  }
  async createPreview(id: string, user: RequestUser) {
    const parent = await this.prisma.importBatch.findFirst({ where: { id, ...this.scope(user) } });
    if (!parent) throw new NotFoundException('Import not found');
    if (!canPreview(parent) || !parent.mediaRef) throw new BadRequestException('Only a completed WhatsApp ZIP extraction can be previewed.');
    const source = await openCaptureSource(this.storage, parent.mediaRef);
    if (source.contentType !== 'application/zip') throw new BadRequestException('Original WhatsApp ZIP is unavailable.');

    const sourceHash = sha(`zip-photo-preview-v1\0${parent.id}\0${parent.sourceHash}`);
    const identity = { organizationId: parent.organizationId, sourceType: parent.sourceType, sourceHash };
    const preview = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.importBatch.createMany({
        data: {
          ...identity,
          createdById: parent.createdById,
          mediaRef: parent.mediaRef,
          fileName: parent.fileName,
          senderName: parent.senderName,
          senderPhone: parent.senderPhone,
          groupName: parent.groupName,
          metadata: { contentType: 'application/zip', previewOfImportId: parent.id },
        },
        skipDuplicates: true,
      });
      const batch = await tx.importBatch.findUniqueOrThrow({ where: { organizationId_sourceType_sourceHash: identity } });
      if (batch.status === 'PENDING') {
        await tx.job.createMany({
          data: { type: 'import.extract', key: `import:${batch.id}`, payload: { batchId: batch.id }, runAt: new Date() },
          skipDuplicates: true,
        });
      }
      return { id: batch.id, status: batch.status, created: inserted.count === 1 };
    });
    if (preview.created) await this.audit.log(user, 'import.preview', 'ImportBatch', preview.id, { parentId: id });
    return { id: preview.id, status: preview.status };
  }
  async retry(id: string, user: RequestUser) {
    const batch = await this.get(id, user);
    if (batch.status !== 'FAILED') throw new BadRequestException('Only failed imports can be retried');
    await this.prisma.$transaction([
      this.prisma.importBatch.update({ where: { id }, data: { status: 'PENDING', lastError: null } }),
      this.prisma.job.updateMany({
        where: { key: `import:${id}`, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, runAt: new Date(), lockedAt: null },
      }),
    ]);
    await this.jobs.enqueue('import.extract', { batchId: id }, { key: `import:${id}` });
    return { ok: true };
  }
  async attachment(id: string, entryId: string, index: number, user: RequestUser) {
    const entry = await this.prisma.sourceEntry.findFirst({
      where: { id: entryId, batchId: id, batch: this.scope(user) },
      select: { ocr: true },
    });
    const attachments = (entry?.ocr as { attachments?: ReviewAttachment[] } | null)?.attachments;
    const item = attachments?.find((attachment) => attachment.index === index);
    if (!item?.mediaRef?.startsWith(`importattachment/${id}/`) || !item.sha256) throw new NotFoundException('Attachment not available');
    const file = await this.storage.read(item.mediaRef);
    if (sha(file.body) !== item.sha256) throw new ConflictException('Attachment integrity check failed');
    return file;
  }
  async source(id: string, user: RequestUser, pageNo?: number, entryId?: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id, ...this.scope(user) } });
    if (!batch) throw new NotFoundException('Import not found');
    const pages = (batch.metadata as { pages?: { pageNo: number; mediaRef: string }[] } | null)?.pages;
    const key = pageNo ? pages?.find((p) => p.pageNo === pageNo)?.mediaRef : batch.mediaRef;
    if (!key) throw new NotFoundException('Source file not available');
    const source = await openCaptureSource(this.storage, key);
    if (!source.contentType.startsWith('image/')) return { contentType: source.contentType, body: Readable.from(source.bytes) };
    const buffers: Buffer[] = [];
    for await (const part of source.bytes) buffers.push(part);
    const file = { contentType: source.contentType, body: Buffer.concat(buffers) };
    if (entryId) {
      const entry = await this.prisma.sourceEntry.findFirst({ where: { id: entryId, batchId: id, pageNo } });
      if (!entry) throw new NotFoundException('Entry not found');
      const box = entry.bbox as { x: number; y: number; width: number; height: number } | null;
      if (box) {
        const metadata = await sharp(file.body).metadata();
        const left = Math.max(0, Math.floor(box.x * metadata.width!));
        const top = Math.max(0, Math.floor(box.y * metadata.height!));
        const width = Math.min(metadata.width! - left, Math.ceil(box.width * metadata.width!));
        const height = Math.min(metadata.height! - top, Math.ceil(box.height * metadata.height!));
        if (width > 0 && height > 0) return { contentType: 'image/png', body: await sharp(file.body).extract({ left, top, width, height }).png().toBuffer() };
      }
    }
    return file;
  }
  private async extractPhoto(body: Buffer, contentType: string, text: string, organizationId: string, userId?: string): Promise<CapturedEntity[] | null> {
    if (await this.ai.isAvailable('vision', 'capture')) {
      try {
        const response = await this.ai.vision(
          `data:${contentType};base64,${body.toString('base64')}`,
          'Extract only explicit inventory and requirements as JSON {entities:[{kind:"INVENTORY"|"REQUIREMENT"|"UNRELATED", inventory?:{}, requirement?:{}, warnings:[]}]}. Split independent units and listings. Do not invent phone, price, locality, BHK, owner identity or availability. Preserve RK separately from BHK. Broker notation BHK+1 means details.additionalRooms:1 with unspecified use, never a bathroom or assumed servant room. Explicit B after BHK means bathrooms. TF means Top Floor, not a numeric floor. A truncated screenshot requires a warning. All records require review. Use monthlyRent/totalSalePrice/ratePerArea with explicit units; never convert phone digits to money. OCR context:\n' +
            text.slice(0, 20000),
          { feature: 'capture', orgId: organizationId, userId: userId, json: true, maxTokens: 6000 },
        );
        const parsed = parseJsonLoose<{ entities: unknown }>(response);
        return arraySchema.parse(parsed.entities);
      } catch {
        return null;
      }
    }
    return null;
  }
  async extract(batchId: string) {
    const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    if (['NEEDS_REVIEW', 'COMPLETE'].includes(batch.status)) return;
    if (!(await this.prisma.organization.findFirst({ where: { id: batch.organizationId, status: 'ACTIVE' } })))
      throw new ForbiddenException('Firm is inactive');
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: 'PROCESSING', lastError: null } });
    try {
      let text = batch.rawText ?? '';
      let entities: CapturedEntity[] | null = null;
      let streamed: AsyncIterable<CapturedMessage & { sourceFile?: string }> | undefined;
      let archiveSummary: ArchiveSummary = { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 };
      let archiveFiles: ReviewAttachment[] = [];
      if (batch.mediaRef) {
        const source = await openCaptureSource(this.storage, batch.mediaRef);
        if (source.contentType.startsWith('image/')) {
          const buffers: Buffer[] = [];
          for await (const part of source.bytes) buffers.push(part);
          const file = { contentType: source.contentType, body: Buffer.concat(buffers) };
          const recognized = await this.ocr.recognize(file.body);
          text = recognized.text;
          entities = await this.extractPhoto(file.body, file.contentType, text, batch.organizationId, batch.createdById ?? undefined);
        } else if (source.contentType === 'application/zip') {
          const archive = await prepareArchiveReview(this.storage, this.ocr, { ...batch, mediaRef: batch.mediaRef }, (body, type, ocrText) =>
            this.extractPhoto(body, type, ocrText, batch.organizationId, batch.createdById ?? undefined),
          );
          archiveSummary = archive.archive;
          archiveFiles = archive.files;
          streamed = archive.messages;
        } else streamed = textMessages(source.bytes);
      }
      const preview = !!previewParent(batch.metadata);
      const messages: AsyncIterable<CapturedMessage & { sourceFile?: string }> | Iterable<CapturedMessage & { sourceFile?: string }> =
        streamed ?? (batch.sourceType === 'CHAT_EXPORT' ? chatExportMessages(text) : [{ text }]);
      let i = 0;
      for await (const message of messages) {
        const evidence = archiveEvidence(message, archiveFiles);
        const extracted: CapturedEntity[] = message.system
          ? [{ kind: 'UNRELATED', warnings: ['WhatsApp system event; retained only as source evidence'] }]
          : (entities ?? extractCapture(message.text));
        // Keep each photo separate so an OCR fragment cannot alter the caption's proposed facts.
        const photoHashes = new Set<string>();
        for (const photo of evidence.attachments) {
          if ((!photo.text && !photo.entities) || !photo.sha256 || photoHashes.has(photo.sha256)) continue;
          photoHashes.add(photo.sha256);
          for (const entity of photo.entities ?? extractCapture(photo.text ?? '')) {
            if (entity.kind === 'UNRELATED' || extracted.length >= 100) continue;
            extracted.push({
              ...entity,
              warnings: [
                ...entity.warnings,
                photo.entities
                  ? 'From photo AI. Verify all fields against the original photo.'
                  : 'From photo OCR. Verify all fields against the original photo.',
              ],
            });
          }
        }
        const originalIdentity = `${message.sender ?? ''}\0${message.timestamp ?? ''}\0${message.text}`;
        const entryKey = `${i}:${sha(originalIdentity)}`;
        const messageIdentity =
          !preview && batch.sourceType === 'CHAT_EXPORT' && batch.groupName && message.sender && message.timestamp
            ? sha(`${batch.groupName}\0${originalIdentity}${evidence.identity ? '\0' + evidence.identity : ''}`)
            : null;
        const create = {
          batchId,
          entryKey,
          rowNo: i + 1,
          rawText: message.text,
          extracted: extracted as Prisma.InputJsonValue,
          ocr: {
            sender: message.sender ?? null,
            timestamp: message.timestamp ?? null,
            sourceFile: message.sourceFile ?? null,
            system: message.system === true,
            attachments: evidence.attachments.map((item) => ({
              index: item.index,
              name: item.name,
              contentType: item.contentType,
              mediaRef: item.mediaRef ?? null,
              sha256: item.sha256 ?? null,
              text: item.text ?? null,
              confidence: item.confidence ?? null,
              warning: item.warning ?? null,
            })),
            attachmentWarnings: evidence.warnings,
          },
          organizationId: batch.organizationId,
          messageIdentity,
          ...(preview ? { reviewState: 'PREVIEW' } : {}),
        };
        try {
          await this.prisma.sourceEntry.upsert({ where: { batchId_entryKey: { batchId, entryKey } }, create, update: {} });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || !messageIdentity) throw error;
          const original = await this.prisma.sourceEntry.findUniqueOrThrow({
            where: { organizationId_messageIdentity: { organizationId: batch.organizationId, messageIdentity } },
          });
          await this.prisma.sourceEntry.upsert({
            where: { batchId_entryKey: { batchId, entryKey } },
            create: {
              ...create,
              messageIdentity: null,
              duplicateOfId: original.id,
              reviewState: 'DUPLICATE',
              reviewNote: 'Exact group, sender, timestamp and message identity already captured',
            },
            update: {},
          });
        }
        i++;
      }
      await this.prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: (await this.prisma.sourceEntry.count({ where: { batchId, reviewState: 'NEEDS_REVIEW' } })) ? 'NEEDS_REVIEW' : 'COMPLETE',
          metadata: {
            ...((batch.metadata as Record<string, Prisma.InputJsonValue>) ?? {}),
            processedMessages: i,
            archive: archiveSummary as unknown as Prisma.InputJsonValue,
            ...(archiveSummary.attachmentFiles
              ? {
                  attachmentNote:
                    'Matching photos and their extraction appear beside the message. Review all extracted details. Videos and unmatched files remain source evidence.',
                }
              : {}),
          },
        },
      });
    } catch (error) {
      await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: 'FAILED', lastError: (error as Error).message.slice(0, 500) } });
      throw error;
    }
  }
  async review(entryId: string, input: z.infer<typeof reviewSchema>, user: RequestUser, approve = false) {
    if (approve && !input.ignore) {
      if (!input.entities.some((e) => e.kind !== 'UNRELATED')) throw new BadRequestException('Approve a property/requirement or choose Ignore');
      await this.modules.assertPath('/broker-requirements', user.role);
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entryId}))`;
      const entry = await tx.sourceEntry.findFirst({ where: { id: entryId, batch: this.scope(user) }, include: { batch: true } });
      if (!entry) throw new NotFoundException('Source entry not found');
      if (previewParent(entry.batch.metadata)) throw new ForbiddenException('Extraction previews are read-only.');
      if (['APPROVED', 'IGNORED', 'DUPLICATE'].includes(entry.reviewState)) return { state: entry.reviewState, duplicate: true };
      if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== entry.updatedAt.getTime())
        throw new ConflictException('Entry changed. Reload review.');
      if (approve && !input.ignore) {
        for (let index = 0; index < input.entities.length; index++) {
          const entity = input.entities[index];
          const sourceUnitKey = String(index);
          if (entity.kind === 'UNRELATED') continue;
          if (entity.kind === 'INVENTORY' && !entity.inventory) throw new BadRequestException('Offered property fields required');
          if (entity.kind === 'REQUIREMENT' && !entity.requirement) throw new BadRequestException('Requirement fields required');
          const parsed = entity.kind === 'INVENTORY' ? offeredRequirement(entity.inventory!) : brokerRequirementSchema.parse(entity.requirement);
          const { expectedRevision: _revision, organizationId: _organization, clientMutationId: _mutation, offerDetails, ...data } = parsed;
          if (
            data.leadId &&
            !(await tx.lead.findFirst({
              where: {
                id: data.leadId,
                organizationId: entry.batch.organizationId,
                deletedAt: null,
                ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
              },
            }))
          )
            throw new ForbiddenException('Lead is not accessible');
          await tx.brokerRequirement.upsert({
            where: { sourceEntryId_sourceUnitKey: { sourceEntryId: entry.id, sourceUnitKey } },
            create: {
              ...data,
              ...(offerDetails ? { offerDetails: offerDetails as Prisma.InputJsonValue } : {}),
              organizationId: entry.batch.organizationId,
              createdById: entry.batch.createdById,
              assignedToId: user.role === 'BROKER_AGENT' ? user.id : null,
              sourceEntryId: entry.id,
              sourceUnitKey,
              provenance: {
                rawText: entry.rawText,
                sourceType: entry.batch.sourceType,
                fileName: entry.batch.fileName,
                groupName: entry.batch.groupName,
                senderName: entry.batch.senderName,
                senderPhone: entry.batch.senderPhone,
                message: reviewProvenance(entry.ocr),
                reviewedAt: new Date().toISOString(),
                reviewedById: user.id,
              } as Prisma.InputJsonValue,
            },
            update: {},
          });
        }
      }
      const state = approve ? (input.ignore ? 'IGNORED' : 'APPROVED') : 'NEEDS_REVIEW';
      const saved = await tx.sourceEntry.update({
        where: { id: entryId },
        data: { extracted: input.entities as Prisma.InputJsonValue, reviewState: state, ...(approve ? { reviewedById: user.id, reviewedAt: new Date() } : {}) },
      });
      const pending = await tx.sourceEntry.count({ where: { batchId: entry.batchId, reviewState: 'NEEDS_REVIEW' } });
      if (!pending) await tx.importBatch.update({ where: { id: entry.batchId }, data: { status: 'COMPLETE' } });
      return { state, duplicate: false, updatedAt: saved.updatedAt };
    });
    await this.audit.log(user, approve ? 'import.approve' : 'import.review_save', 'SourceEntry', entryId, result);
    return result;
  }
}
