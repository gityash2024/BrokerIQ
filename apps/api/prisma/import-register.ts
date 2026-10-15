/** Controlled, resumable source import. Run only against the fresh BrokerIQ database.
 * Candidate fields are explicitly unverified; this script never approves inventory.
 * Input: private segmentation directory, original PDF, broker email.
 */
import 'reflect-metadata';
import { PrismaClient, Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { LocalStorageService } from '../src/core/media/local-storage.service';

const checksum = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const manifestSchema = z.object({
  status: z.literal('CANDIDATES_ONLY'),
  source: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), pages: z.number().int().positive().max(500), fileName: z.string() }),
  pages: z.array(
    z.object({
      pageNo: z.number().int().positive(),
      image: z.string(),
      sha256: z.string().length(64),
      segments: z.number().int(),
      header: z.unknown().optional(),
    }),
  ),
  entries: z.array(
    z.object({
      entryKey: z.string().max(100),
      pageNo: z.number().int().positive(),
      rowNo: z.number().int().positive(),
      rawText: z.string(),
      bbox: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }),
      ocr: z
        .object({
          houseCandidate: z.string().nullable(),
          localityEvidence: z.object({ locality: z.string().optional(), reviewed: z.boolean().optional() }).passthrough(),
        })
        .passthrough(),
      warnings: z.array(z.string()),
    }),
  ),
});

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (!/^brokeriq_(b2b|release_test)/.test(database)) throw new Error('Only fresh BrokerIQ B2B/test databases may import register sources');
  if (!process.env.MEDIA_ROOT || !process.env.ENCRYPTION_MASTER_KEY) throw new Error('Private MEDIA_ROOT and encryption key are required');
  const [directory, pdf, email] = process.argv.slice(2);
  if (!directory || !pdf || !email) throw new Error('Usage: import-register <private-directory> <original-pdf> <broker-email>');
  const root = resolve(directory);
  const sourcePath = (relative: string) => {
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep)) throw new Error('Source path escapes the private directory');
    return path;
  };
  const manifest = manifestSchema.parse(JSON.parse(await fs.readFile(sourcePath('segmented.json'), 'utf8')));
  const original = await fs.readFile(resolve(pdf));
  if (checksum(original) !== manifest.source.sha256) throw new Error('Original PDF checksum does not match');
  const pageNumbers = new Set(manifest.pages.map((p) => p.pageNo));
  const keys = new Set(manifest.entries.map((e) => e.entryKey));
  if (pageNumbers.size !== manifest.source.pages || manifest.pages.length !== pageNumbers.size || keys.size !== manifest.entries.length)
    throw new Error('Missing or repeated page/entry identities');
  for (let page = 1; page <= manifest.source.pages; page++) if (!pageNumbers.has(page)) throw new Error(`Missing page ${page}`);
  // Validate all files and geometry before writing anything to the database.
  for (const page of manifest.pages) {
    if (checksum(await fs.readFile(sourcePath(page.image))) !== page.sha256) throw new Error(`Page ${page.pageNo} checksum mismatch`);
    if (manifest.entries.filter((e) => e.pageNo === page.pageNo).length !== page.segments) throw new Error(`Page ${page.pageNo} segment count mismatch`);
  }
  for (const entry of manifest.entries) {
    if (!pageNumbers.has(entry.pageNo) || entry.bbox.x + entry.bbox.width > 1.00001 || entry.bbox.y + entry.bbox.height > 1.00001)
      throw new Error('Invalid page reference or crop geometry');
  }
  const prisma = new PrismaClient();
  try {
    const broker = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!broker || broker.role !== 'BROKER_ADMIN' || !broker.organizationId) throw new Error('An existing broker admin firm is required');
    const firm = await prisma.organization.findUniqueOrThrow({ where: { id: broker.organizationId } });
    if (firm.status !== 'ACTIVE') throw new Error('Firm is inactive');
    const storage = new LocalStorageService();
    let batch = await prisma.importBatch.findUnique({
      where: {
        organizationId_sourceType_sourceHash: {
          organizationId: firm.id,
          sourceType: 'PDF_REGISTER',
          sourceHash: manifest.source.sha256,
        },
      },
    });
    if (!batch)
      batch = await prisma.importBatch.create({
        data: {
          organizationId: firm.id,
          createdById: broker.id,
          sourceType: 'PDF_REGISTER',
          sourceHash: manifest.source.sha256,
          fileName: manifest.source.fileName,
          mediaRef: await storage.putSource(original, 'application/pdf', firm.id),
          status: 'NEEDS_REVIEW',
          metadata: {
            pages: [],
            reconciliation: {
              status: 'CANDIDATES_ONLY',
              sourcePages: manifest.source.pages,
              candidateBlocks: manifest.entries.length,
              visuallyVerifiedUnits: 0,
            },
          },
        },
      });
    const metadata = (batch.metadata ?? {}) as { pages?: { pageNo: number; mediaRef: string; sha256: string }[]; [key: string]: any };
    const pages = [...(metadata.pages ?? [])];
    for (const page of manifest.pages) {
      const existing = pages.find((p) => p.pageNo === page.pageNo);
      if (existing && existing.sha256 !== page.sha256) throw new Error('Stored page evidence differs; refusing to replace it');
      if (!existing) {
        pages.push({
          pageNo: page.pageNo,
          mediaRef: await storage.putSource(await fs.readFile(sourcePath(page.image)), 'image/png', firm.id),
          sha256: page.sha256,
        });
        await prisma.importBatch.update({ where: { id: batch.id }, data: { metadata: { ...metadata, pages } as Prisma.InputJsonValue } });
      }
      const entries = manifest.entries.filter((e) => e.pageNo === page.pageNo);
      await prisma.sourceEntry.createMany({
        skipDuplicates: true,
        data: entries.map((entry) => ({
          organizationId: firm.id,
          batchId: batch!.id,
          entryKey: entry.entryKey,
          pageNo: entry.pageNo,
          rowNo: entry.rowNo,
          rawText: entry.rawText,
          bbox: entry.bbox,
          ocr: { ...entry.ocr, warnings: entry.warnings, candidateOnly: true } as Prisma.InputJsonValue,
          extracted: [
            {
              kind: 'INVENTORY',
              inventory: {
                houseNo: entry.ocr.houseCandidate,
                sector: entry.ocr.localityEvidence.reviewed ? (entry.ocr.localityEvidence.locality ?? null) : null,
                availability: 'UNKNOWN',
                notes: entry.rawText,
              },
              warnings: [
                ...entry.warnings,
                'Candidate block may contain several floors/units. Verify its crop and split units before approval. Prices and contacts require visual transcription.',
              ],
            },
          ],
          reviewState: 'NEEDS_REVIEW',
        })),
      });
    }
    const rows = await prisma.sourceEntry.groupBy({ by: ['reviewState'], where: { batchId: batch.id }, _count: { _all: true } });
    console.log(
      JSON.stringify({
        batchId: batch.id,
        sourcePages: pages.length,
        candidateBlocks: manifest.entries.length,
        reviewStates: rows,
        canonicalInventoryCreatedByScript: 0,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
