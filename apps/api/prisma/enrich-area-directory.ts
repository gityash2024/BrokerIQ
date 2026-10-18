import { PrismaClient, Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { directoryEnrichmentSchema } from '@brokeriq/shared';

const inputSchema = z.object({
  updates: z
    .array(
      z.object({
        provider: z.enum(['HARERA', 'GMDA_TCP', 'OSM']),
        externalId: z.string().max(200),
        sourceUrl: z.string().url(),
        enrichment: directoryEnrichmentSchema,
      }),
    )
    .max(5000),
});

/** Metadata only: exact identities, no insert, no inventory writes, preserved original source facts. */
export async function enrichDirectory(prisma: PrismaClient, input: unknown, backupPath?: string) {
  const { updates } = inputSchema.parse(input);
  const identities = new Set<string>();
  for (const row of updates) {
    const identity = `${row.provider}:${row.externalId}`;
    if (identities.has(identity)) throw new Error(`Duplicate source identity: ${identity}`);
    identities.add(identity);
    const origin = new URL(row.sourceUrl);
    const detail = new URL(row.enrichment.sourceUrl);
    if (origin.protocol !== 'https:' || detail.protocol !== 'https:' || origin.hostname !== detail.hostname)
      throw new Error(`Mismatched source origin: ${identity}`);
    if (row.provider === 'HARERA' && (origin.hostname !== 'haryanarera.gov.in' || origin.pathname.split('/').pop() !== detail.pathname.split('/').pop()))
      throw new Error(`Mismatched HARERA project: ${identity}`);
    if (row.provider === 'OSM' && (origin.hostname !== 'www.openstreetmap.org' || row.sourceUrl !== row.enrichment.sourceUrl))
      throw new Error(`Mismatched OSM object: ${identity}`);
  }
  return prisma.$transaction(
    async (tx) => {
      const backup = [];
      for (const row of updates) {
        const previous = await tx.areaDirectoryEntry.findUnique({ where: { provider_externalId: { provider: row.provider, externalId: row.externalId } } });
        if (!previous || previous.sourceUrl !== row.sourceUrl) throw new Error(`Existing exact source identity required: ${row.provider}:${row.externalId}`);
        backup.push({
          id: previous.id,
          provider: previous.provider,
          externalId: previous.externalId,
          sourceUrl: previous.sourceUrl,
          metadata: previous.metadata,
        });
      }
      // Backup must be durable before the first mutation. Existing files are never overwritten.
      if (backupPath) {
        const handle = await fs.open(backupPath, 'wx', 0o600);
        try {
          await handle.writeFile(JSON.stringify({ generatedAt: new Date().toISOString(), records: backup }));
          await handle.sync();
        } finally {
          await handle.close();
        }
        for (let i = 0; i < updates.length; i++) {
          const metadata = backup[i].metadata;
          const original = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
          await tx.areaDirectoryEntry.update({
            where: { id: backup[i].id },
            data: { metadata: { ...original, enrichment: updates[i].enrichment } as Prisma.InputJsonValue },
          });
        }
      }
      return {
        matched: backup.length,
        applied: !!backupPath,
        total: await tx.areaDirectoryEntry.count(),
        mapped: await tx.areaDirectoryEntry.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 },
  );
}

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (!/^brokeriq_(b2b|release_test)[a-z0-9_]*$/.test(database)) throw new Error('BrokerIQ-specific database required');
  const [file, mode, backupPath] = process.argv.slice(2);
  if (!file || (mode && mode !== '--apply') || (mode === '--apply' && !backupPath))
    throw new Error('Usage: enrich-area-directory <enrichment.json> [--apply <new-private-backup.json>]');
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(await enrichDirectory(prisma, JSON.parse(await fs.readFile(file, 'utf8')), mode === '--apply' ? backupPath : undefined)));
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
