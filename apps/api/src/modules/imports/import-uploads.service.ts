import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ImportUpload } from '@prisma/client';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { IMPORT_CHUNK_BYTES, IMPORT_MAX_BYTES } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { JobsService } from '../../core/jobs/jobs.service';
import type { RequestUser } from '../../common/decorators';

export const uploadStartSchema = z
  .object({
    clientKey: z.string().min(8).max(150),
    fileName: z.string().min(1).max(200),
    contentType: z.enum(['text/plain', 'application/zip', 'image/jpeg', 'image/png', 'image/webp']),
    sourceType: z.enum(['CHAT_EXPORT', 'IMAGE']),
    totalBytes: z.number().int().min(1).max(IMPORT_MAX_BYTES),
    groupName: z.string().max(150).optional(),
    target: z.enum(['AUTO', 'INVENTORY', 'REQUIREMENT']).default('AUTO'),
  })
  .refine((value) => (value.sourceType === 'IMAGE') === value.contentType.startsWith('image/'), 'Source type does not match file');

export const uploadChunkSchema = z.object({
  data: z
    .string()
    .min(4)
    .max(Math.ceil(IMPORT_CHUNK_BYTES / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});

export interface SourceChunk {
  key: string;
  size: number;
  hash: string;
}
export interface ChunkManifest {
  version: 1;
  contentType: string;
  totalBytes: number;
  hash: string;
  chunks: SourceChunk[];
}
export const CHUNK_MANIFEST_TYPE = 'application/vnd.brokeriq.capture-chunks+json';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

@Injectable()
export class ImportUploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly jobs: JobsService,
  ) {}

  private scope(user: RequestUser) {
    if (!user.orgId) throw new ForbiddenException('A broker firm is required');
    return { organizationId: user.orgId, createdById: user.id };
  }

  private state(row: ImportUpload) {
    return {
      id: row.id,
      nextIndex: (row.chunks as unknown as SourceChunk[]).length,
      receivedBytes: row.receivedBytes,
      chunkBytes: IMPORT_CHUNK_BYTES,
      batchId: row.batchId,
    };
  }

  async start(input: z.infer<typeof uploadStartSchema>, user: RequestUser) {
    const scope = this.scope(user);
    const row = await this.prisma.importUpload.upsert({
      where: { organizationId_createdById_clientKey: { ...scope, clientKey: input.clientKey } },
      create: { ...scope, ...input },
      update: {},
    });
    for (const name of ['fileName', 'contentType', 'sourceType', 'totalBytes', 'target'] as const) {
      if (row[name] !== input[name]) throw new ConflictException('Upload identity changed. Keep the original and start a new upload.');
    }
    if ((row.groupName ?? '') !== (input.groupName ?? '')) throw new ConflictException('Upload group changed.');
    return this.state(row);
  }

  async chunk(id: string, index: number, encoded: string, user: RequestUser) {
    const scope = this.scope(user);
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > IMPORT_CHUNK_BYTES) throw new BadRequestException('Invalid chunk size');
    const digest = hash(bytes);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const row = await tx.importUpload.findFirst({ where: { id, ...scope } });
        if (!row) throw new NotFoundException('Upload not found');
        const chunks = row.chunks as unknown as SourceChunk[];
        if (index < chunks.length) {
          if (chunks[index].hash !== digest || chunks[index].size !== bytes.length) throw new ConflictException('Retry bytes differ from the saved original');
          return this.state(row);
        }
        if (row.batchId || index !== chunks.length) throw new ConflictException('Resume from the next acknowledged chunk');
        const expected = Math.min(IMPORT_CHUNK_BYTES, row.totalBytes - row.receivedBytes);
        if (bytes.length !== expected) throw new BadRequestException('Chunk is incomplete or exceeds declared file size');
        // Each persisted chunk has an independent AES-GCM authentication tag.
        const key = await this.storage.putSource(bytes, 'application/octet-stream', row.organizationId);
        chunks.push({ key, size: bytes.length, hash: digest });
        const updated = await tx.importUpload.update({
          where: { id },
          data: { receivedBytes: row.receivedBytes + bytes.length, chunks: chunks as unknown as Prisma.InputJsonValue },
        });
        return this.state(updated);
      },
      { timeout: 30_000 },
    );
  }

  async complete(id: string, user: RequestUser) {
    const scope = this.scope(user);
    const row = await this.prisma.importUpload.findFirst({ where: { id, ...scope } });
    if (!row) throw new NotFoundException('Upload not found');
    if (row.receivedBytes !== row.totalBytes) throw new BadRequestException('Upload incomplete. Resume remaining chunks.');
    let batchId = row.batchId;
    if (!batchId) {
      const chunks = row.chunks as unknown as SourceChunk[];
      const digest = createHash('sha256');
      const sourceDigest = createHash('sha256').update(`${row.groupName ?? ''}\0\0`);
      for (const chunk of chunks) {
        const file = await this.storage.read(chunk.key);
        if (file.body.length !== chunk.size || hash(file.body) !== chunk.hash) throw new ConflictException('Saved chunk failed integrity verification');
        digest.update(file.body);
        sourceDigest.update(file.body);
      }
      const manifest: ChunkManifest = { version: 1, contentType: row.contentType, totalBytes: row.totalBytes, chunks, hash: digest.digest('hex') };
      const mediaRef = await this.storage.putSource(Buffer.from(JSON.stringify(manifest)), CHUNK_MANIFEST_TYPE, row.organizationId);
      const sourceHash = sourceDigest.digest('hex');
      batchId = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const current = await tx.importUpload.findFirstOrThrow({ where: { id, ...scope } });
        if (current.batchId) return current.batchId;
        const batch = await tx.importBatch.upsert({
          where: { organizationId_sourceType_sourceHash: { organizationId: row.organizationId, sourceType: row.sourceType, sourceHash } },
          create: {
            organizationId: row.organizationId,
            createdById: user.id,
            sourceType: row.sourceType,
            sourceHash,
            fileName: row.fileName,
            groupName: row.groupName,
            mediaRef,
            metadata: { contentType: row.contentType, requestedTarget: row.target, totalBytes: row.totalBytes, chunked: true },
          },
          update: {},
        });
        await tx.importUpload.update({ where: { id }, data: { batchId: batch.id } });
        return batch.id;
      });
    }
    const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    if (batch.status === 'PENDING') await this.jobs.enqueue('import.extract', { batchId }, { key: `import:${batchId}` });
    return { id: batchId, status: batch.status };
  }
}
