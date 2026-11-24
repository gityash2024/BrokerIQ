import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  offeredRequirement,
  capturedEntitySchema,
  extractCapture,
  chatExportMessages,
  inventoryMonth,
  inventoryMonthSchema,
  missingInventoryFolderFields,
  brokerRequirementSchema,
  type CapturedEntity,
  type CapturedMessage,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { AuditService } from '../../core/audit/audit.service';
import { AiService, parseJsonLoose } from '../../core/ai/ai.service';
import { OcrService, OcrInputError } from './ocr.service';
import { registerContext, previousRegisterPage, queueNextRegisterPage } from './register-context';
import { imageCaptureSchema, IMAGE_COVERAGE_PROMPT, combineRegisterReads, registerImageSections } from './capture-register-images';
import { captureFactsSchema, CAPTURE_FACTS_PROMPT, REGISTER_LAYOUT_PROMPT, registerPageSector, captureTextParts, factsToEntities } from './capture-ai';
import type { RequestUser } from '../../common/decorators';
import { z } from 'zod';
import sharp from 'sharp';
import { ModulesService } from '../../core/features/modules.service';
import { openCaptureSource, textMessages, type ArchiveSummary } from './capture-stream';
import { InventoryService } from '../inventory/inventory.service';
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
    target: z.enum(['AUTO', 'INVENTORY', 'REQUIREMENT', 'SURVEY']).optional(),
    directoryMonth: inventoryMonthSchema.optional(),
  })
  .refine((s) => !!s.rawText?.trim() || !!s.fileDataUrl, 'Text or a file is required');
export const reviewSchema = z.object({
  entities: z.array(capturedEntitySchema).max(100),
  ignore: z.boolean().optional(),
  destination: z.enum(['INVENTORY', 'REQUIREMENT', 'SURVEY']).optional(),
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

class RegisterCoverageError extends Error {
  constructor() {
    super('AI could not verify all readable rows on this register page. The original is saved. Retry extraction resumes this register.');
  }
}

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
    private readonly inventory: InventoryService,
  ) {
    this.jobs.register('import.extract', (p) => this.extract(p.batchId));
  }
  private org(user: RequestUser) {
    if (!user.orgId) throw new ForbiddenException('A broker firm is required');
    return user.orgId;
  }
  private scope(user: RequestUser) {
    return {
      sourceType: { not: 'PDF' },
      ...(user.role === 'SUPER_ADMIN' ? {} : {
          organizationId: this.org(user),
          ...(user.role === 'BROKER_AGENT' ? { createdById: user.id } : {}),
      }),
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
            metadata: {
              contentType: contentType ?? 'text/plain',
              requestedTarget: input.target ?? 'AUTO',
              ...(input.target === 'INVENTORY' && input.directoryMonth ? { directoryMonth: input.directoryMonth } : {}),
            },
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
  private async extractText(text: string, organizationId: string, userId?: string, reserveRequest?: () => boolean): Promise<CapturedEntity[] | null> {
    try {
      const parts = captureTextParts(text);
      if (!parts) return null;
      const entities: CapturedEntity[] = [];
      for (const part of parts) {
        if (reserveRequest && !reserveRequest()) return null;
        const facts = await this.ai.json(
          [
            { role: 'system', content: CAPTURE_FACTS_PROMPT },
            { role: 'user', content: part },
          ],
          { feature: 'capture', orgId: organizationId, userId, schema: captureFactsSchema, strictSchema: true, maxTokens: 6000, temperature: 0 },
        );
        entities.push(...factsToEntities(facts, part));
      }
      return entities;
    } catch {
      // A partial long-post extraction is not presented as a successful complete draft.
      return null;
    }
  }
  private async extractPhoto(
    body: Buffer,
    text: string,
    organizationId: string,
    userId?: string,
    register?: { previousSector: string | null; setSector: (sector: string | null) => void },
  ): Promise<CapturedEntity[] | null> {
    if (!(await this.ai.isAvailable('vision', 'capture'))) return null;
    let isRegister = Boolean(register);
    try {
      const oriented = await sharp(body)
        .rotate()
        .resize({ width: 2200, height: 3000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 96 })
        .toBuffer({ resolveWithObject: true });
      const prompt = CAPTURE_FACTS_PROMPT + REGISTER_LAYOUT_PROMPT + IMAGE_COVERAGE_PROMPT;
      const previousSector = register?.previousSector ?? null;
      const context = previousSector ? '\nConfirmed preceding register-page sector: ' + previousSector + '. Use until a new printed sector heading.' : '';
      const read = async (image: Buffer, description: string, original: boolean) => {
        const response = await this.ai.vision(
          'data:image/jpeg;base64,' + image.toString('base64'),
          prompt + context + '\n' + description + (original ? '\nUse OCR only as secondary evidence:\n' + text.slice(0, 8000) : ''),
          {
            feature: 'capture',
            orgId: organizationId,
            userId,
            json: true,
            maxTokens: 12000,
            temperature: 0,
            responseSchema: imageCaptureSchema,
            strictSchema: true,
          },
        );
        return imageCaptureSchema.parse(parseJsonLoose(response));
      };
      const full = await read(oriented.data, 'Read this complete source photo.', true);
      isRegister ||= full.layout === 'REGISTER';
      let facts: z.infer<typeof captureFactsSchema> | null = full;
      if (isRegister) {
        const images = await registerImageSections(oriented.data, oriented.info.width, oriented.info.height);
        const sections = [];
        for (const [i, image] of images.entries()) {
          sections.push(await read(image, i === 0 ? 'Read only the upper section.' : 'Read only the lower section.', false));
        }
        facts = combineRegisterReads(full, sections);
        if (!facts) throw new RegisterCoverageError();
      }
      if (!facts || (!isRegister && full.layout === 'UNREADABLE')) return null;
      const entities = factsToEntities(facts, text, true, isRegister);
      if (isRegister) {
        const sector = registerPageSector(facts, text, previousSector);
        register?.setSector(sector);
        return entities.map((entity) => {
          if (entity.kind === 'INVENTORY' && entity.inventory && !entity.inventory.sector) return { ...entity, inventory: { ...entity.inventory, sector } };
          if (entity.kind === 'REQUIREMENT' && entity.requirement && !entity.requirement.localityNames.length)
            return { ...entity, requirement: { ...entity.requirement, localityNames: sector ? [sector] : [] } };
          return entity;
        });
      }
      return entities;
    } catch (error) {
      if (isRegister) throw error instanceof RegisterCoverageError ? error : new RegisterCoverageError();
      return null;
    }
  }
  async extract(batchId: string) {
    const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    if (['NEEDS_REVIEW', 'COMPLETE'].includes(batch.status)) return;
    if (!(await this.prisma.organization.findFirst({ where: { id: batch.organizationId, status: 'ACTIVE' } })))
      throw new ForbiddenException('Firm is inactive');
    const register = registerContext(batch);
    let inheritedSector: string | null = register?.sector ?? null;
    if (register && register.pageNo > 1) {
      const previous = await previousRegisterPage(this.prisma, batch);
      if (!previous || !['NEEDS_REVIEW', 'COMPLETE'].includes(previous.status))
        throw new BadRequestException('The preceding register page must finish extraction first. Retry it to continue this register.');
      inheritedSector = registerContext(previous)?.sector ?? null;
    }
    let registerSector = inheritedSector;
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: 'PROCESSING', lastError: null } });
    try {
      let text = batch.rawText ?? '';
      let entities: CapturedEntity[] | null = null;
      let imageWarning: string | null = null;
      let streamed: AsyncIterable<CapturedMessage & { sourceFile?: string }> | undefined;
      let archiveSummary: ArchiveSummary = { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 };
      let archiveFiles: ReviewAttachment[] = [];
      if (batch.mediaRef) {
        const source = await openCaptureSource(this.storage, batch.mediaRef);
        if (source.contentType.startsWith('image/')) {
          const buffers: Buffer[] = [];
          for await (const part of source.bytes) buffers.push(part);
          const file = { contentType: source.contentType, body: Buffer.concat(buffers) };
          try {
            text = (await this.ocr.recognize(file.body)).text;
          } catch (error) {
            if (error instanceof OcrInputError) throw error;
            text = ''; // A temporary OCR outage must not prevent approved vision or source review.
            imageWarning = 'OCR unavailable. Review the original image and all extracted fields.';
          }
          entities = await this.extractPhoto(
            file.body,
            text,
            batch.organizationId,
            batch.createdById ?? undefined,
            register
              ? {
                  previousSector: inheritedSector,
                  setSector: (sector) => {
                    registerSector = sector;
                  },
                }
              : undefined,
          );
          if (register && !entities) throw new RegisterCoverageError();
        } else if (source.contentType === 'application/zip') {
          const archive = await prepareArchiveReview(this.storage, this.ocr, { ...batch, mediaRef: batch.mediaRef }, (body, _type, ocrText) =>
            this.extractPhoto(body, ocrText, batch.organizationId, batch.createdById ?? undefined),
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
      const textAiReady = await this.ai.isAvailable('json', 'capture');
      let textAiRequests = 0,
        textAiDrafts = 0;
      const textCache = new Map<string, CapturedEntity[] | null>();
      for await (const message of messages) {
        const evidence = archiveEvidence(message, archiveFiles);
        let textProposal: CapturedEntity[] | null = null;
        // Bounded per import; no repeated provider request for identical forwarded posts.
        // Beyond the budget, original messages still enter normal manual source review.
        if (!message.system && !entities && textAiReady && message.text.length <= 20_000 && /[\p{L}]/u.test(message.text)) {
          const key = sha(message.text);
          if (textCache.has(key)) textProposal = structuredClone(textCache.get(key) ?? null);
          else if (textAiRequests < 100) {
            textProposal = await this.extractText(message.text, batch.organizationId, batch.createdById ?? undefined, () => {
              if (textAiRequests >= 100) return false;
              textAiRequests++;
              return true;
            });
            textCache.set(key, structuredClone(textProposal));
          }
          if (textProposal) textAiDrafts++;
        }
        const extracted: CapturedEntity[] = message.system
          ? [{ kind: 'UNRELATED', warnings: ['WhatsApp system event; retained only as source evidence'] }]
          : (entities ?? textProposal ?? extractCapture(message.text));
        if (imageWarning) for (const entity of extracted) entity.warnings.push(imageWarning);
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
            ...(register ? { register: { ...register, sector: registerSector } } : {}),
            textAi: { available: textAiReady, requests: textAiRequests, draftMessages: textAiDrafts, maxRequestsPerImport: 100 },
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
      if (register) await queueNextRegisterPage(this.prisma, this.jobs, batch);
    } catch (error) {
      await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: 'FAILED', lastError: (error as Error).message.slice(0, 500) } });
      throw error;
    }
  }
  async review(entryId: string, input: z.infer<typeof reviewSchema>, user: RequestUser, approve = false) {
    const survey = input.destination === 'SURVEY';
    const propertyDestination = survey || input.destination === 'INVENTORY';
    if (approve && !input.ignore) {
      if (!input.entities.some((e) => e.kind !== 'UNRELATED')) throw new BadRequestException('Approve a property/requirement or choose Ignore');
      const directInventory = propertyDestination && input.entities.some((entity) => entity.kind === 'INVENTORY');
      const needsRequirements = input.entities.some((entity) => entity.kind === 'REQUIREMENT' || (entity.kind === 'INVENTORY' && !directInventory));
      if (needsRequirements) {
        await this.modules.assertPath('/broker-requirements', user.role);
        if (user.delegatedActor && !user.delegatedPermissions?.includes('leads:create')) throw new ForbiddenException('Leads create permission is required');
      }
      if (directInventory) {
        await this.modules.assertPath('/inventory', user.role);
        if (user.delegatedActor && !user.delegatedPermissions?.includes('inventory:create'))
          throw new ForbiddenException('Inventory create permission is required');
      }
    }
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entryId}))`;
        const entry = await tx.sourceEntry.findFirst({ where: { id: entryId, batch: this.scope(user) }, include: { batch: true } });
        if (!entry) throw new NotFoundException('Source entry not found');
        if (previewParent(entry.batch.metadata)) throw new ForbiddenException('Extraction previews are read-only.');
        if (['APPROVED', 'IGNORED', 'DUPLICATE'].includes(entry.reviewState)) return { state: entry.reviewState, duplicate: true };
        if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== entry.updatedAt.getTime())
          throw new ConflictException('Entry changed. Reload review.');
        const surveySource = survey || (entry.batch.metadata as { requestedTarget?: string } | null)?.requestedTarget === 'SURVEY';
        if (approve && !input.ignore) {
          for (let index = 0; index < input.entities.length; index++) {
            const entity = input.entities[index];
            const sourceUnitKey = String(index);
            if (entity.kind === 'UNRELATED') continue;
            if (entity.kind === 'INVENTORY' && !entity.inventory) throw new BadRequestException('Offered property fields required');
            if (entity.kind === 'REQUIREMENT' && !entity.requirement) throw new BadRequestException('Requirement fields required');
            if (entity.kind === 'INVENTORY' && propertyDestination) {
              const unit = entity.inventory!;
              const rented = unit.availability === 'RENTED';
              const missing =
                rented || survey
                  ? [
                      ...(!unit.houseNo?.trim() ? ['House / plot number'] : []),
                      ...(!unit.sector?.trim() && !unit.address?.trim() ? ['Sector / locality or address'] : []),
                    ]
                  : missingInventoryFolderFields(unit);
              if (missing.length) throw new BadRequestException(`Property ${index + 1}: fill ${missing.join(', ')} before approval.`);
              const preferredMonth = inventoryMonthSchema.safeParse((entry.batch.metadata as { directoryMonth?: unknown } | null)?.directoryMonth);
              const directoryMonth = unit.directoryMonth ?? (preferredMonth.success ? preferredMonth.data : inventoryMonth(entry.batch.createdAt));
              const {
                organizationId: _organizationId,
                assignedToId: _assignee,
                clientMutationId: _clientMutationId,
                expectedRevision: _revision,
                survey: _survey,
                ...fields
              } = unit;
              await this.inventory.create(
                {
                  ...fields,
                  organizationId: entry.batch.organizationId,
                  ...(surveySource ? { survey: true as const, purpose: unit.purpose ?? ('RENT' as const) } : {}),
                  ...(survey
                    ? {
                        directoryMonth: undefined,
                        availability: rented ? ('RENTED' as const) : ('UNKNOWN' as const),
                        status: rented ? ('RENTED' as const) : ('DRAFT' as const),
                        verificationStatus: 'NEEDS_REVIEW' as const,
                      }
                    : rented
                      ? { directoryMonth: undefined, availability: 'RENTED', status: surveySource ? 'RENTED' : 'INACTIVE', verificationStatus: 'NEEDS_REVIEW' }
                      : { directoryMonth }),
                },
                user,
                tx,
                {
                  sourceEntryId: entry.id,
                  sourceUnitKey,
                  sourceType: entry.batch.sourceType,
                },
              );
              continue;
            }
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
          data: {
            extracted: input.entities as Prisma.InputJsonValue,
            reviewState: state,
            ...(approve ? { reviewedById: user.id, reviewedAt: new Date() } : {}),
          },
        });
        const pending = await tx.sourceEntry.count({ where: { batchId: entry.batchId, reviewState: 'NEEDS_REVIEW' } });
        if (!pending) await tx.importBatch.update({ where: { id: entry.batchId }, data: { status: 'COMPLETE' } });
        return { state, duplicate: false, updatedAt: saved.updatedAt };
      },
      { timeout: 30_000 },
    );
    await this.audit.log(user, approve ? 'import.approve' : 'import.review_save', 'SourceEntry', entryId, result);
    return result;
  }
}
