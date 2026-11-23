import { PrismaClient } from '@prisma/client';
import { LocalStorageService } from '../core/media/local-storage.service';
import { PropertyPhotoService } from '../core/media/property-photo.service';

const db = new PrismaClient();
const storage = new LocalStorageService();
const media = new PropertyPhotoService(storage);

async function run() {
  if (!storage.enabled) throw new Error('Property photo storage is unavailable.');
  const totals = { prepared: 0, unsupported: 0, unavailable: 0 };
  const exceptions = new Map<string, number>();
  const prepare = async (code: string, urls: string[], firm?: string | null) => {
    for (const url of new Set(urls)) {
      try {
        if (await media.warm(url, code, firm)) totals.prepared++;
        else {
          totals.unsupported++;
          exceptions.set(code, (exceptions.get(code) ?? 0) + 1);
        }
      } catch {
        totals.unavailable++;
        exceptions.set(code, (exceptions.get(code) ?? 0) + 1);
      }
    }
  };

  let cursor: string | undefined;
  for (;;) {
    const batch: { id: string; propertyCode: string; photoUrls: string[]; organization: { name: string } }[] = await db.inventoryItem.findMany({
      where: { deletedAt: null, ...(cursor && { id: { gt: cursor } }) },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, propertyCode: true, photoUrls: true, organization: { select: { name: true } } },
    });
    if (!batch.length) break;
    for (const item of batch) await prepare(item.propertyCode, item.photoUrls, item.organization.name);
    cursor = batch.at(-1)?.id;
  }

  cursor = undefined;
  for (;;) {
    const batch: { id: string; propertyCode: string; coverUrl: string | null; media: { url: string }[]; organization: { name: string } | null }[] =
      await db.listing.findMany({
        where: { deletedAt: null, ...(cursor && { id: { gt: cursor } }) },
        orderBy: { id: 'asc' },
        take: 100,
        select: {
          id: true,
          propertyCode: true,
          coverUrl: true,
          media: { where: { kind: { not: 'VIDEO' } }, select: { url: true } },
          organization: { select: { name: true } },
        },
      });
    if (!batch.length) break;
    for (const listing of batch) {
      await prepare(
        listing.propertyCode,
        [...listing.media.map(({ url }) => url), ...(listing.coverUrl ? [listing.coverUrl] : [])],
        listing.organization?.name,
      );
    }
    cursor = batch.at(-1)?.id;
  }
  console.log(JSON.stringify({ ...totals, exceptions: [...exceptions].map(([propertyCode, files]) => ({ propertyCode, files })) }));
}

void run()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
