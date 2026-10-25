import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  inventoryDerived,
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
import { openCaptureSource, textMessages, zipMessages, type ArchiveSummary } from './capture-stream';

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
    return user.role === 'SUPER_ADMIN' ? {} : { organizationId: this.org(user) };
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
          status: true,
          lastError: true,
          createdAt: true,
          _count: { select: { entries: { where: { OR: [{ reviewNote: null }, { reviewNote: { not: 'SUPERSEDED_BY_VISUAL_REVIEW' } }] } } } },
        },
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    return { items, total, page, pageSize: 30, totalPages: Math.ceil(total / 30) };
  }
  async get(id: string, user: RequestUser, page = 1, sourcePage?: number, reviewState?: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id, ...this.scope(user) } });
    if (!batch) throw new NotFoundException('Import not found');
    const visible = {
      batchId: id,
      ...(sourcePage ? { pageNo: sourcePage } : {}),
      ...(reviewState ? { reviewState } : {}),
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
    return { ...batch, rawText: batch.rawText?.slice(0, 20000), entries, total, pending, page, pageSize: 50, totalPages: Math.ceil(total / 50) };
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
    if (batch.status === 'PENDING') await this.jobs.enqueue('import.extract', { batchId: batch.id }, { key: `import:${batch.id}` });
    return { id: batch.id, status: batch.status };
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
      const archiveSummary: ArchiveSummary = { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 };
      if (batch.mediaRef) {
        const source = await openCaptureSource(this.storage, batch.mediaRef);
        if (source.contentType.startsWith('image/')) {
          const buffers: Buffer[] = [];
          for await (const part of source.bytes) buffers.push(part);
          const file = { contentType: source.contentType, body: Buffer.concat(buffers) };
          const recognized = await this.ocr.recognize(file.body);
          text = recognized.text;
          // AI is an optional free-only assistant. Validation and explicit review remain mandatory.
          if (await this.ai.isAvailable()) {
            try {
              const response = await this.ai.vision(
                `data:${file.contentType};base64,${file.body.toString('base64')}`,
                'Extract only explicit inventory and requirements as JSON {entities:[{kind:"INVENTORY"|"REQUIREMENT"|"UNRELATED", inventory?:{}, requirement?:{}, warnings:[]}]}. Split independent units and listings. Do not invent phone, price, locality, BHK, owner identity or availability. Preserve RK separately from BHK. Broker notation BHK+1 means details.additionalRooms:1 with unspecified use, never a bathroom or assumed servant room. Explicit B after BHK means bathrooms. TF means Top Floor, not a numeric floor. A truncated screenshot requires a warning. All records require review. Use monthlyRent/totalSalePrice/ratePerArea with explicit units; never convert phone digits to money. OCR context:\n' +
                  text.slice(0, 20000),
                { feature: 'capture', orgId: batch.organizationId, userId: batch.createdById ?? undefined, json: true, maxTokens: 6000 },
              );
              const parsed = parseJsonLoose<{ entities: unknown }>(response);
              entities = arraySchema.parse(parsed.entities);
            } catch {
              entities = null;
            }
          }
        } else if (source.contentType === 'application/zip') streamed = zipMessages(source.bytes, archiveSummary);
        else streamed = textMessages(source.bytes);
      }
      const messages: AsyncIterable<CapturedMessage & { sourceFile?: string }> | Iterable<CapturedMessage & { sourceFile?: string }> =
        streamed ?? (batch.sourceType === 'CHAT_EXPORT' ? chatExportMessages(text) : [{ text }]);
      let i = 0;
      for await (const message of messages) {
        const extracted = entities ?? extractCapture(message.text);
        const entryKey = `${i}:${sha(`${message.sender ?? ''}\0${message.timestamp ?? ''}\0${message.text}`)}`;
        const messageIdentity =
          batch.sourceType === 'CHAT_EXPORT' && batch.groupName && message.sender && message.timestamp
            ? sha(`${batch.groupName}\0${message.sender}\0${message.timestamp}\0${message.text}`)
            : null;
        const create = {
          batchId,
          entryKey,
          rowNo: i + 1,
          rawText: message.text,
          extracted: extracted as Prisma.InputJsonValue,
          ocr: { sender: message.sender ?? null, timestamp: message.timestamp ?? null, sourceFile: message.sourceFile ?? null },
          organizationId: batch.organizationId,
          messageIdentity,
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
        if (i % 250 === 0) await this.prisma.job.updateMany({ where: { key: `import:${batchId}`, status: 'RUNNING' }, data: { lockedAt: new Date() } });
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
                    'ZIP attachments are retained in the private original download. Chat TXT messages are extracted; embedded media is not automatically OCR processed. Import images separately for OCR.',
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
      for (const entity of input.entities) {
        if (entity.kind !== 'UNRELATED') await this.modules.assertPath(entity.kind === 'INVENTORY' ? '/inventory' : '/broker-requirements', user.role);
      }
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entryId}))`;
      const entry = await tx.sourceEntry.findFirst({ where: { id: entryId, batch: this.scope(user) }, include: { batch: true } });
      if (!entry) throw new NotFoundException('Source entry not found');
      if (['APPROVED', 'IGNORED', 'DUPLICATE'].includes(entry.reviewState)) return { state: entry.reviewState, duplicate: true };
      if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== entry.updatedAt.getTime())
        throw new ConflictException('Entry changed. Reload review.');
      if (approve && !input.ignore) {
        for (let index = 0; index < input.entities.length; index++) {
          const entity = input.entities[index];
          const sourceUnitKey = String(index);
          if (entity.kind === 'INVENTORY') {
            if (!entity.inventory) throw new BadRequestException('Inventory fields required');
            const parsed = inventoryInputSchema.parse(entity.inventory);
            const { contacts, expectedRevision: _rev, organizationId: _org, ...data } = parsed;
            if (!data.sector && !data.address) throw new BadRequestException('Confirm locality/address before approving');
            const monthly = data.monthlyRent ?? data.rent ?? null;
            await tx.inventoryItem.upsert({
              where: { sourceEntryId_sourceUnitKey: { sourceEntryId: entry.id, sourceUnitKey } },
              create: {
                ...data,
                ...inventoryDerived(data),
                details: (data.details ?? {}) as Prisma.InputJsonValue,
                rent: monthly,
                monthlyRent: monthly,
                organizationId: entry.batch.organizationId,
                createdById: user.id,
                sourceEntryId: entry.id,
                sourceUnitKey,
                sourceType: entry.batch.sourceType,
                pageNo: entry.pageNo,
                availability: data.availability ?? 'UNKNOWN',
                verificationStatus: 'VERIFIED',
                status: data.status === 'DRAFT' ? 'ACTIVE' : (data.status ?? 'ACTIVE'),
                contacts: { create: contacts ?? [] },
              },
              update: {},
            });
          } else if (entity.kind === 'REQUIREMENT') {
            if (!entity.requirement) throw new BadRequestException('Requirement fields required');
            const data = brokerRequirementSchema.parse(entity.requirement);
            if (data.leadId && !(await tx.lead.findFirst({ where: { id: data.leadId, organizationId: entry.batch.organizationId, deletedAt: null } })))
              throw new ForbiddenException('Lead belongs to another firm');
            await tx.brokerRequirement.upsert({
              where: { sourceEntryId_sourceUnitKey: { sourceEntryId: entry.id, sourceUnitKey } },
              create: { ...data, organizationId: entry.batch.organizationId, sourceEntryId: entry.id, sourceUnitKey },
              update: {},
            });
          }
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
