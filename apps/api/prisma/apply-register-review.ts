/** Apply private, source-checked visual transcripts to a fresh BrokerIQ database.
 * Original OCR observations remain stored. Only explicitly ready groups are
 * approved through the authenticated review API. Replays preserve broker edits.
 * Usage: <review.json> <broker-email> <super-admin-email> [http://127.0.0.1:3100]
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { capturedEntitySchema } from '@brokeriq/shared';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assertNoDroppedSourceFields, assertRepeatedSourcePage } from '../src/common/utils/source-validation';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const stable = (value: any): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );
const schema = z.object({
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageNo: z.number().int().min(1).max(500),
  repeatedPageOf: z.number().int().min(1).max(500).optional(),
  pageImageSha256: z.string().length(64),
  coverageReviewed: z.literal(true),
  reviewMethod: z.string().min(20).max(2000),
  headerNotes: z.string().max(5000),
  groups: z
    .array(
      z.object({
        groupNo: z.number().int().positive(),
        bbox: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }),
        transcription: z.string().min(1).max(20000),
        entities: z.array(capturedEntitySchema).min(1).max(50),
        issues: z.array(z.string().max(500)).max(50),
        ready: z.boolean(),
      }),
    )
    .min(1)
    .max(200),
});
const SUPERSEDED = 'SUPERSEDED_BY_VISUAL_REVIEW';
async function main() {
  const db = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(db.hostname) || !/^brokeriq_(b2b|release_test)/.test(db.pathname.slice(1)))
    throw new Error('Only a local fresh BrokerIQ B2B/test database is allowed');
  const [file, brokerEmail, reviewerEmail, apiOrigin = 'http://127.0.0.1:3100'] = process.argv.slice(2);
  if (!file || !brokerEmail || !reviewerEmail) throw new Error('Private review file, broker email and Super Admin email required');
  const origin = new URL(apiOrigin);
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname) || !['3100', '3099', '3320'].includes(origin.port))
    throw new Error('Only a BrokerIQ local API origin is allowed');
  const input = JSON.parse(await readFile(file, 'utf8'));
  const review = schema.parse(input);
  assertNoDroppedSourceFields(input, review);
  const annotationSha = sha(stable(review));
  if (new Set(review.groups.map((g) => g.groupNo)).size !== review.groups.length) throw new Error('Repeated source group identity');
  for (const group of review.groups) {
    if (group.bbox.x + group.bbox.width > 1.00001 || group.bbox.y + group.bbox.height > 1.00001) throw new Error('Invalid source crop');
    if (group.entities.some((e) => e.kind !== 'INVENTORY' || !e.inventory)) throw new Error('Register groups must contain inventory drafts');
    if (group.ready && (group.issues.length || group.entities.some((e) => !e.inventory?.sector && !e.inventory?.address)))
      throw new Error('Ready groups must be resolved and have an address');
  }
  const prisma = new PrismaClient();
  try {
    const broker = await prisma.user.findUniqueOrThrow({ where: { email: brokerEmail.toLowerCase() }, include: { organization: true } });
    const reviewer = await prisma.user.findUniqueOrThrow({ where: { email: reviewerEmail.toLowerCase() } });
    if (
      broker.role !== 'BROKER_ADMIN' ||
      broker.status !== 'ACTIVE' ||
      broker.deletedAt ||
      broker.organization?.status !== 'ACTIVE' ||
      reviewer.role !== 'SUPER_ADMIN' ||
      reviewer.status !== 'ACTIVE' ||
      reviewer.deletedAt
    )
      throw new Error('Active broker firm and Super Admin required');
    if (!process.env.JWT_ACCESS_SECRET) throw new Error('BrokerIQ API signing secret is required locally; no token is printed');
    const token = new JwtService().sign(
      { sub: reviewer.id, role: reviewer.role, email: reviewer.email },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' },
    );
    const account = await fetch(`${origin.origin}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!account.ok || ((await account.json()) as any).id !== reviewer.id)
      throw new Error('The review API does not match the selected database/account; no source rows were changed');
    const batch = await prisma.importBatch.findUniqueOrThrow({
      where: { organizationId_sourceType_sourceHash: { organizationId: broker.organizationId!, sourceType: 'PDF_REGISTER', sourceHash: review.sourceSha256 } },
    });
    const metadata = batch.metadata as any;
    if (!metadata.pages?.some((p: any) => p.pageNo === review.pageNo && p.sha256 === review.pageImageSha256))
      throw new Error('Transcript does not match a stored original page');
    const previous = metadata.visualReviews?.find((p: any) => p.pageNo === review.pageNo);
    if (previous && previous.annotationSha !== annotationSha)
      throw new Error('This page already has another transcript. Resolve revisions through source review; never overwrite broker corrections');
    const repeatedOriginal = review.repeatedPageOf
      ? await prisma.sourceEntry.findMany({ where: { batchId: batch.id, pageNo: review.repeatedPageOf, entryKey: { startsWith: 'visual-v1-' } } })
      : null;
    if (repeatedOriginal) {
      if (review.repeatedPageOf! >= review.pageNo || !metadata.visualReviews?.some((page: any) => page.pageNo === review.repeatedPageOf && !page.repeatedPageOf))
        throw new Error('Repeated page must refer to an earlier visually reviewed original page');
      assertRepeatedSourcePage(review.groups, repeatedOriginal);
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${batch.id}))`;
      const latest = await tx.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
      const latestReview = (latest.metadata as any).visualReviews?.find((p: any) => p.pageNo === review.pageNo);
      if (latestReview && latestReview.annotationSha !== annotationSha)
        throw new Error('Concurrent transcript revision was preserved; resolve it through source review');
      const originals = await tx.sourceEntry.findMany({ where: { batchId: batch.id, pageNo: review.pageNo, entryKey: { not: { startsWith: 'visual-v1-' } } } });
      if (originals.some((e) => !['NEEDS_REVIEW', 'IGNORED'].includes(e.reviewState) || (e.reviewState === 'IGNORED' && e.reviewNote !== SUPERSEDED)))
        throw new Error('Original entries have broker reviews; manual conflict resolution required');
      await tx.sourceEntry.createMany({
        skipDuplicates: true,
        data: review.groups.map((group) => ({
          organizationId: batch.organizationId,
          batchId: batch.id,
          pageNo: review.pageNo,
          rowNo: group.groupNo,
          entryKey: `visual-v1-p${String(review.pageNo).padStart(3, '0')}-g${String(group.groupNo).padStart(3, '0')}`,
          rawText: group.transcription,
          bbox: group.bbox,
          ocr: { annotationSha, visualReview: true, sourceImageSha256: review.pageImageSha256, reviewMethod: review.reviewMethod, issues: group.issues },
          extracted: group.entities.map((e) => ({ ...e, warnings: [...e.warnings, ...group.issues] })) as Prisma.InputJsonValue,
          reviewState: repeatedOriginal ? 'DUPLICATE' : 'NEEDS_REVIEW',
          ...(repeatedOriginal ? {
            reviewNote: `VISUALLY_CONFIRMED_REPEAT_OF:${repeatedOriginal.find((entry) => entry.rowNo === group.groupNo)!.id}`,
            reviewedById: reviewer.id,
            reviewedAt: new Date(),
          } : {}),
        })),
      });
      await tx.sourceEntry.updateMany({
        where: { id: { in: originals.map((e) => e.id) }, reviewState: 'NEEDS_REVIEW' },
        data: { reviewState: 'IGNORED', reviewNote: SUPERSEDED },
      });
      const current = await tx.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
      const meta = current.metadata as any;
      const visualReviews = [
        ...(meta.visualReviews ?? []).filter((p: any) => p.pageNo !== review.pageNo),
        {
          pageNo: review.pageNo,
          annotationSha,
          groups: review.groups.length,
          readyGroups: review.groups.filter((g) => g.ready).length,
          unresolvedGroups: repeatedOriginal ? 0 : review.groups.filter((g) => !g.ready).length,
          duplicateGroups: repeatedOriginal ? review.groups.length : 0,
          headerNotes: review.headerNotes,
          ...(review.repeatedPageOf ? { repeatedPageOf: review.repeatedPageOf } : {}),
          reviewedBy: 'Codex-assisted source transcription',
        },
      ];
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          metadata: {
            ...meta,
            visualReviews,
            reconciliation: { ...meta.reconciliation, status: 'VISUAL_REVIEW_IN_PROGRESS', visuallyReviewedPages: visualReviews.length },
          },
        },
      });
    });
    let approved = 0,
      preserved = 0;
    for (const group of review.groups.filter((g) => g.ready)) {
      const entry = await prisma.sourceEntry.findUniqueOrThrow({
        where: {
          batchId_entryKey: { batchId: batch.id, entryKey: `visual-v1-p${String(review.pageNo).padStart(3, '0')}-g${String(group.groupNo).padStart(3, '0')}` },
        },
      });
      if (entry.reviewState !== 'NEEDS_REVIEW') {
        preserved++;
        continue;
      }
      const expected = group.entities.map((e) => ({ ...e, warnings: [...e.warnings, ...group.issues] }));
      if (stable(entry.extracted) !== stable(expected)) {
        preserved++;
        continue;
      }
      const response = await fetch(`${origin.origin}/api/imports/entries/${entry.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities: expected, expectedUpdatedAt: entry.updatedAt.toISOString() }),
      });
      if (!response.ok) throw new Error(`Source approval failed (${response.status}); pending source and existing corrections were preserved`);
      approved++;
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${batch.id}))`;
      const current = await tx.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
      const meta = current.metadata as any;
      const verified = await tx.inventoryItem.count({ where: { sourceEntry: { batchId: batch.id }, deletedAt: null } });
      const pending = await tx.sourceEntry.count({ where: { batchId: batch.id, reviewState: 'NEEDS_REVIEW' } });
      await tx.importBatch.update({
        where: { id: batch.id },
        data: { status: pending ? 'NEEDS_REVIEW' : 'COMPLETE', metadata: { ...meta, reconciliation: { ...meta.reconciliation, visuallyVerifiedUnits: verified } } },
      });
      await tx.auditLog.create({
        data: {
          actorId: reviewer.id,
          actorRole: reviewer.role,
          organizationId: batch.organizationId,
          action: 'import.visual_transcription',
          entity: 'ImportBatch',
          entityId: batch.id,
          meta: { pageNo: review.pageNo, annotationSha, approvedGroups: approved, preservedGroups: preserved, operator: 'Codex-assisted source transcription' },
        },
      });
    });
    console.log(
      JSON.stringify({
        page: review.pageNo,
        groups: review.groups.length,
        approvedGroups: approved,
        preservedGroups: preserved,
        unresolvedGroups: repeatedOriginal ? 0 : review.groups.filter((g) => !g.ready).length,
        duplicateGroups: repeatedOriginal ? review.groups.length : 0,
        annotationSha,
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
