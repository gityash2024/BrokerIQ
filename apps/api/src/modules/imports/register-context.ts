import { z } from 'zod';
import type { ImportBatch } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JobsService } from '../../core/jobs/jobs.service';

const contextSchema = z.object({
  sessionId: z.string().uuid(),
  pageNo: z.number().int().min(1).max(10000),
  sector: z.string().max(100).nullable().optional(),
  customFolderId: z.string().min(1).max(100).nullable().optional(),
});

export function registerContext(batch: Pick<ImportBatch, 'metadata'>) {
  const parsed = contextSchema.safeParse((batch.metadata as { register?: unknown } | null)?.register);
  return parsed.success ? parsed.data : null;
}

export async function previousRegisterPage(db: PrismaService, batch: ImportBatch) {
  const context = registerContext(batch);
  if (!context || context.pageNo === 1 || !batch.createdById) return null;
  const upload = await db.importUpload.findFirst({
    where: {
      organizationId: batch.organizationId,
      createdById: batch.createdById,
      registerSessionId: context.sessionId,
      registerPageNo: context.pageNo - 1,
    },
    select: { batchId: true },
  });
  return upload?.batchId ? db.importBatch.findUnique({ where: { id: upload.batchId } }) : null;
}

/** Later pages wait for the preceding heading to be extracted, including upload retries. */
export async function queueCaptureExtraction(db: PrismaService, jobs: JobsService, batch: ImportBatch) {
  if (batch.status !== 'PENDING') return;
  const context = registerContext(batch);
  if (context && context.pageNo > 1) {
    const previous = await previousRegisterPage(db, batch);
    if (!previous || !['NEEDS_REVIEW', 'COMPLETE'].includes(previous.status)) return;
  }
  await jobs.enqueue('import.extract', { batchId: batch.id }, { key: 'import:' + batch.id });
}

export async function queueNextRegisterPage(db: PrismaService, jobs: JobsService, batch: ImportBatch) {
  const context = registerContext(batch);
  if (!context || !batch.createdById) return;
  const next = await db.importUpload.findFirst({
    where: {
      organizationId: batch.organizationId,
      createdById: batch.createdById,
      registerSessionId: context.sessionId,
      registerPageNo: context.pageNo + 1,
    },
    select: { batchId: true },
  });
  if (!next?.batchId) return;
  const following = await db.importBatch.findUnique({ where: { id: next.batchId } });
  if (following) await queueCaptureExtraction(db, jobs, following);
}
