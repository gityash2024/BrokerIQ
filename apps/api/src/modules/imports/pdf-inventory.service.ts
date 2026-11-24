import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { normalizeIndianPhone, pdfInventoryFields, type PdfInventoryFilters, type PdfInventoryUpdate } from '@brokeriq/shared';
import { z } from 'zod';
import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import { AiService } from '../../core/ai/ai.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { openCaptureSource } from './capture-stream';
import { parseRentalTable, type ParsedPdfRow } from './pdf-inventory-parser';

const run = promisify(execFile);
const batchSelect = { id: true, fileName: true, status: true, lastError: true, createdAt: true, metadata: true } as const;
const inferredFloors = z.array(z.object({ row: z.number().int(), floor: z.string().max(30) })).max(30);
const floorInterpretations: Record<string, string[]> = { UG: ['Upper ground floor'], LG: ['Lower ground floor'], STILT: ['Stilt floor'] };
const cleanRow = ({ id, batchId, pageNo, rowNo, rawText, locality, sector, address, propertyType, areaSqft, floor, configuration, furnishing,
  monthlyRent, availability, ownerName, contacts, notes, review, updatedAt }: Prisma.PdfInventoryRowGetPayload<object>, canReadContacts: boolean) => ({
  id, batchId, pageNo, rowNo, locality, sector, address, propertyType, areaSqft, floor, configuration, furnishing,
  monthlyRent, availability, review, updatedAt,
  rawText: canReadContacts ? rawText : '', ownerName: canReadContacts ? ownerName : null, contacts: canReadContacts ? contacts : [],
  notes: canReadContacts ? notes : null,
});
const hasPdfContactAccess = (user: RequestUser) => !user.delegatedActor || Boolean(user.delegatedPermissions?.includes('inventory:approve_details'));

@Injectable()
export class PdfInventoryService {
  constructor(private readonly db: PrismaService, private readonly storage: LocalStorageService,
    private readonly queue: JobsService, private readonly ai: AiService) {
    this.queue.register('import.pdf', (job) => this.extract(job.batchId));
  }

  async list(user: RequestUser, filters: PdfInventoryFilters) {
    const organizationId = requireOrg(user);
    const canReadContacts = hasPdfContactAccess(user);
    const where: Prisma.PdfInventoryRowWhereInput = {
      organizationId, deletedAt: null, batchId: filters.batchId,
      availability: filters.availability, review: filters.review,
      ...(filters.minArea !== undefined || filters.maxArea !== undefined ? { areaSqft: { gte: filters.minArea, lte: filters.maxArea } } : {}),
      ...(filters.minRent !== undefined || filters.maxRent !== undefined ? { monthlyRent: { gte: filters.minRent, lte: filters.maxRent } } : {}),
    };
    for (const field of ['locality', 'sector', 'propertyType', 'floor', 'configuration', 'furnishing'] as const) {
      if (filters[field]) where[field] = { contains: filters[field], mode: 'insensitive' };
    }
    if (filters.search) {
      const term = { contains: filters.search, mode: 'insensitive' } as const;
      const contact = normalizeIndianPhone(filters.search);
      where.OR = [{ address: term }, { locality: term }, { sector: term }];
      if (canReadContacts) {
        where.OR.push({ ownerName: term });
        if (contact) where.OR.push({ contacts: { has: contact } });
      }
    }
    const [items, total, batches] = await Promise.all([
      this.db.pdfInventoryRow.findMany({ where, take: 30, skip: (filters.page - 1) * 30,
        orderBy: [{ batch: { createdAt: 'desc' } }, { batchId: 'asc' }, { pageNo: 'asc' }, { rowNo: 'asc' }] }),
      this.db.pdfInventoryRow.count({ where }),
      this.db.importBatch.findMany({ where: { sourceType: 'PDF', organizationId }, orderBy: { createdAt: 'desc' }, take: 100, select: batchSelect }),
    ]);
    return { items: items.map((row) => cleanRow(row, canReadContacts)), total, page: filters.page, batches };
  }

  async update(id: string, user: RequestUser, dto: PdfInventoryUpdate) {
    const organizationId = requireOrg(user);
    const { expectedUpdatedAt, reviewed, ...fields } = dto;
    const canReadContacts = hasPdfContactAccess(user);
    if (!canReadContacts && (fields.ownerName !== undefined || fields.contacts !== undefined || fields.notes !== undefined)) {
      throw new ForbiddenException('Private PDF contact details require approval access');
    }
    return this.db.$transaction(async (tx) => {
      const where = { id, organizationId, deletedAt: null };
      const row = await tx.pdfInventoryRow.findFirst({ where });
      if (!row) throw new NotFoundException('PDF property not found');
      const saved = await tx.pdfInventoryRow.updateMany({
        where: { ...where, updatedAt: new Date(expectedUpdatedAt) }, data: { ...fields, ...(reviewed ? { review: 'SAVED' } : {}) },
      });
      if (!saved.count) throw new ConflictException('This property changed. Refresh and try again.');
      await tx.auditLog.create({ data: { actorId: user.id, organizationId, entity: 'PdfInventoryRow', entityId: id,
        action: 'inventory.pdf.edit', meta: { fields: Object.keys(fields), reviewed: reviewed === true } } });
      return cleanRow(await tx.pdfInventoryRow.findUniqueOrThrow({ where: { id } }), canReadContacts);
    });
  }

  async archive(id: string, user: RequestUser) {
    const organizationId = requireOrg(user);
    return this.db.$transaction(async (tx) => {
      const result = await tx.pdfInventoryRow.updateMany({ where: { id, organizationId, deletedAt: null }, data: { deletedAt: new Date() } });
      if (!result.count) throw new NotFoundException('PDF property not found');
      await tx.auditLog.create({ data: { actorId: user.id, organizationId, entity: 'PdfInventoryRow', entityId: id, action: 'inventory.pdf.archive' } });
      return { ok: true };
    });
  }

  async retry(id: string, user: RequestUser) {
    const organizationId = requireOrg(user);
    const batch = await this.db.importBatch.findFirst({ where: { id, organizationId, sourceType: 'PDF' }, select: batchSelect });
    if (!batch) throw new NotFoundException('PDF import not found');
    if (!['FAILED', 'PARTIAL', 'PENDING'].includes(batch.status)) throw new ConflictException('This PDF is already processing or complete');
    if (batch.status !== 'PENDING') {
      const changed = await this.db.importBatch.updateMany({ where: { id, status: batch.status }, data: { status: 'PENDING', lastError: null } });
      if (!changed.count) throw new ConflictException('This import is already queued');
    }
    await this.queue.enqueue('import.pdf', { batchId: id, orgId: organizationId }, { key: 'pdf-inventory:' + id, repeat: true });
    return { id, status: 'PENDING' };
  }

  private async extract(id: string) {
    const batch = await this.db.importBatch.findFirst({ where: { id, sourceType: 'PDF' } });
    if (!batch?.mediaRef || ['COMPLETE', 'PARTIAL'].includes(batch.status)) return;
    await this.db.importBatch.update({ where: { id }, data: { status: 'PROCESSING', lastError: null } });
    const directory = await mkdtemp(join(tmpdir(), 'brokeriq-pdf-'));
    try {
      const source = await openCaptureSource(this.storage, batch.mediaRef);
      if (source.contentType !== 'application/pdf') throw new BadRequestException('Select a valid PDF document');
      const path = join(directory, 'source.pdf');
      await pipeline(source.bytes, createWriteStream(path, { mode: 0o600 }));
      const opts = { timeout: 20_000, maxBuffer: 8 * 1024 * 1024 };
      const { stdout: info } = await run('pdfinfo', [path], opts);
      const pageCount = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
      if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 50) throw new BadRequestException('Upload a PDF of up to 50 pages');
      const { stdout } = await run('pdftotext', ['-layout', path, '-'], opts);
      const pages = stdout.split('\f');
      const listingPages: number[] = [];
      const reviewPages: number[] = [];
      const rows: ParsedPdfRow[] = [];
      for (let i = 0; i < pageCount; i++) {
        const pageNo = i + 1;
        let page = pages[i] ?? '';
        let entries = parseRentalTable(page, pageNo);
        if (!entries && page.trim().length < 100) {
          const image = join(directory, 'page');
          try {
            await run('pdftoppm', ['-f', String(pageNo), '-l', String(pageNo), '-scale-to', '2200', '-png', '-singlefile', path, image], opts);
            const result = await run('tesseract', [image + '.png', 'stdout', '--psm', '6', '-c', 'preserve_interword_spaces=1'], opts);
            page = result.stdout;
            entries = parseRentalTable(page, pageNo);
          } catch {
            reviewPages.push(pageNo);
          } finally {
            await rm(image + '.png', { force: true });
          }
        }
        if (entries?.length) {
          listingPages.push(pageNo);
          rows.push(...entries);
        } else if (/\bLOCALITY\b[^\r\n]{0,150}\b(?:FLOOR|FLR|CONTACT)\b/i.test(page) && !reviewPages.includes(pageNo)) {
          reviewPages.push(pageNo);
        }
      }
      if (!rows.length) throw new BadRequestException('No supported property tables were found. The original PDF is preserved.');
      await this.normalizeFloors(rows, batch.organizationId);
      await this.db.$transaction(async (tx) => {
        const fingerprints = new Set<string>();
        const records = rows.map(({ needsReview, rawText, pageNo, rowNo, ...fields }) => {
          const data = pdfInventoryFields.parse(fields);
          const fingerprint = data.address && data.locality && data.areaSqft && data.configuration && data.floor
            ? createHash('sha256').update([data.address, data.locality, data.areaSqft, data.configuration, data.floor].join('|').toLowerCase().replace(/\s+/g, '')).digest('hex') : null;
          if (fingerprint) fingerprints.add(fingerprint);
          return { batchId: id, organizationId: batch.organizationId, pageNo, rowNo, rawText, fingerprint, ...data, review: needsReview ? 'NEEDS_REVIEW' : 'SAVED' };
        });
        const prior = await tx.pdfInventoryRow.findMany({ where: { organizationId: batch.organizationId, batchId: { not: id }, deletedAt: null,
          review: { not: 'DUPLICATE' }, fingerprint: { in: [...fingerprints] } }, distinct: ['fingerprint'], select: { fingerprint: true } });
        const seen = new Set(prior.map((row) => row.fingerprint));
        for (const row of records) {
          if (!row.fingerprint) continue;
          if (seen.has(row.fingerprint)) row.review = 'DUPLICATE';
          seen.add(row.fingerprint);
        }
        await tx.pdfInventoryRow.createMany({ data: records, skipDuplicates: true });
        await tx.importBatch.update({ where: { id }, data: { status: reviewPages.length ? 'PARTIAL' : 'COMPLETE',
          metadata: { ...(batch.metadata as Prisma.JsonObject ?? {}), pageCount, listingPages, reviewPages } } });
      }, { timeout: 25_000 });
    } catch (error) {
      const absent = (error as NodeJS.ErrnoException).code === 'ENOENT';
      const lastError = error instanceof BadRequestException ? error.message : absent
        ? 'PDF processing requires Poppler and Tesseract on the API host.' : 'Could not read the PDF. The original is preserved.';
      await this.db.importBatch.update({ where: { id }, data: { status: 'FAILED', lastError } });
      if (!(error instanceof BadRequestException)) throw new Error(lastError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async normalizeFloors(rows: ParsedPdfRow[], orgId: string) {
    const selected = rows.flatMap((row, index) => row.floor && floorInterpretations[row.floor.toUpperCase()] ? [{ index, code: row.floor.toUpperCase() }] : []).slice(0, 30);
    if (!selected.length) return;
    try {
      const values = await this.ai.json([
        { role: 'system', content: 'Normalize only the provided floor abbreviations. Return JSON array of {row, floor}. Skip uncertain abbreviations.' },
        { role: 'user', content: JSON.stringify(selected) },
      ], { feature: 'capture', orgId, openRouterOnly: true, schema: inferredFloors, temperature: 0, maxTokens: 600 });
      for (const value of values) {
        const source = selected.find(({ index }) => index === value.row);
        if (source && floorInterpretations[source.code].includes(value.floor)) rows[value.row].floor = value.floor;
      }
    } catch {
      for (const item of selected) rows[item.index].needsReview = true;
    }
  }
}
