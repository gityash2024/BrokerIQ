import { PrismaClient, Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
const schema = z.object({
  provider: z.enum(['HARERA', 'GMDA_TCP', 'OSM']),
  externalId: z.string().max(200),
  name: z.string().max(1000),
  builderName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  city: z.literal('Gurugram'),
  category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'UNCLASSIFIED']),
  categoryEvidence: z.string().optional(),
  registrationNumber: z.string().nullable().optional(),
  registrationStatus: z.string().nullable().optional(),
  registrationUntil: z.string().nullable().optional(),
  sourceUrl: z
    .string()
    .url()
    .refine((url) => ['haryanarera.gov.in', 'onemapdepts.gmda.gov.in', 'www.openstreetmap.org'].includes(new URL(url).hostname)),
  sourceFetchedAt: z.string().datetime({ offset: true }),
  sourceHash: z.string().length(64),
  latitude: z.number().min(27).max(30).nullable(),
  longitude: z.number().min(75).max(79).nullable(),
  coordinateSource: z.string().nullable(),
  geometry: z.any().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (!/^brokeriq_(b2b|release_test)/.test(database)) throw new Error('Only isolated BrokerIQ B2B/test databases may import this dataset');
  const file = process.argv[2];
  if (!file) throw new Error('Private directory.json path required');
  const data = z.object({ scope: z.literal('GURUGRAM_CITY'), records: z.array(schema).max(50000) }).parse(JSON.parse(await fs.readFile(file, 'utf8')));
  const prisma = new PrismaClient();
  try {
    for (const record of data.records) {
      const { geometry, metadata, ...fields } = record;
      const value = {
        ...fields,
        sourceFetchedAt: new Date(fields.sourceFetchedAt),
        geometry: geometry ?? Prisma.DbNull,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      };
      await prisma.areaDirectoryEntry.upsert({
        where: { provider_externalId: { provider: record.provider, externalId: record.externalId } },
        create: value,
        update: value,
      });
    }
    console.log(
      JSON.stringify({
        importedSourceRecords: data.records.length,
        total: await prisma.areaDirectoryEntry.count(),
        mapped: await prisma.areaDirectoryEntry.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
