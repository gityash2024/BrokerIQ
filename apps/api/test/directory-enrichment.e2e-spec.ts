import { PrismaClient } from '@prisma/client';
import { enrichDirectory } from '../prisma/enrich-area-directory';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Exact-identity directory metadata enrichment', () => {
  const prisma = new PrismaClient();
  const externalId = `enrichment-test-${Date.now()}`;
  const sourceUrl = 'https://haryanarera.gov.in/view_project/searchprojectDetail/987654321';
  let folder: string;
  let id: string;
  let inventoryCount: number;
  const enrichment = {
    version: 1,
    sourceUrl: 'https://haryanarera.gov.in/view_project/project_preview_open/987654321',
    fetchedAt: '2026-10-18T00:00:00Z',
    facts: { landArea: '2 acres' },
    tables: [],
    photos: [],
  };
  const update = { provider: 'HARERA', externalId, sourceUrl, enrichment };
  beforeAll(async () => {
    folder = await fs.mkdtemp(join(tmpdir(), 'biq-directory-'));
    inventoryCount = await prisma.inventoryItem.count();
    id = (
      await prisma.areaDirectoryEntry.create({
        data: {
          provider: 'HARERA',
          externalId,
          sourceUrl,
          name: 'Isolated enrichment fixture',
          sourceFetchedAt: new Date('2026-01-01'),
          sourceHash: 'a'.repeat(64),
          latitude: 28.4,
          longitude: 77.02,
          metadata: { classificationNote: 'Preserve source identity', retained: true },
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (id) await prisma.areaDirectoryEntry.delete({ where: { id } });
    if (folder) await fs.rm(folder, { recursive: true });
    await prisma.$disconnect();
  });
  it('dry-runs without changing data, requires backup, and preserves other facts on repeat apply', async () => {
    const before = await prisma.areaDirectoryEntry.findUniqueOrThrow({ where: { id } });
    expect(await enrichDirectory(prisma, { updates: [update] })).toMatchObject({ applied: false, matched: 1 });
    expect(await prisma.areaDirectoryEntry.findUniqueOrThrow({ where: { id } })).toEqual(before);
    const backup = join(folder, 'before.json');
    await enrichDirectory(prisma, { updates: [update] }, backup);
    const changed = await prisma.areaDirectoryEntry.findUniqueOrThrow({ where: { id } });
    expect(changed).toMatchObject({
      sourceUrl,
      sourceHash: before.sourceHash,
      sourceFetchedAt: before.sourceFetchedAt,
      latitude: before.latitude,
      longitude: before.longitude,
      metadata: { retained: true, classificationNote: 'Preserve source identity', enrichment },
    });
    expect(JSON.parse(await fs.readFile(backup, 'utf8')).records[0].metadata).toEqual(before.metadata);
    await expect(enrichDirectory(prisma, { updates: [update] }, backup)).rejects.toThrow('EEXIST');
    expect(await prisma.inventoryItem.count()).toBe(inventoryCount);
  });
  it('rejects mismatched project identity and rolls back an entire batch on unknown records', async () => {
    await expect(
      enrichDirectory(prisma, {
        updates: [{ ...update, enrichment: { ...enrichment, sourceUrl: 'https://haryanarera.gov.in/view_project/project_preview_open/999' } }],
      }),
    ).rejects.toThrow('Mismatched HARERA');
    const before = await prisma.areaDirectoryEntry.findUniqueOrThrow({ where: { id } });
    await expect(enrichDirectory(prisma, { updates: [update, { ...update, externalId: 'missing-identity' }] }, join(folder, 'invalid.json'))).rejects.toThrow(
      'Existing exact source identity',
    );
    expect(await prisma.areaDirectoryEntry.findUniqueOrThrow({ where: { id } })).toEqual(before);
    await expect(fs.stat(join(folder, 'invalid.json'))).rejects.toThrow('ENOENT');
  });
});
