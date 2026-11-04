import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PRIVACY_HTML, TERMS_HTML } from './legal-pages';

const pages = [
  { slug: 'privacy', previous: '6b8acb493f08680ceb3516d803dbfea860576fc45f67b950b6029409f32c358d', content: PRIVACY_HTML },
  { slug: 'terms', previous: '3786739c56b3ef2946040df4ad8a78556134068b89414caecd55469228adab4a', content: TERMS_HTML },
] as const;

async function run() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) throw new Error('Expected no argument or --apply');
  if (!process.env.DATABASE_URL) throw new Error('Select the intended DATABASE_URL before running this command');
  const apply = args[0] === '--apply';
  const db = new PrismaClient();

  try {
    const result = await db.$transaction(async (tx) => {
      const results: { slug: string; status: string }[] = [];
      for (const page of pages) {
        const current = await tx.page.findUnique({ where: { slug: page.slug }, select: { id: true, content: true, isPublished: true, updatedAt: true } });
        if (!current?.isPublished) {
          results.push({ slug: page.slug, status: 'NOT_PUBLISHED' });
          continue;
        }
        if (current.content === page.content) {
          results.push({ slug: page.slug, status: 'CURRENT' });
          continue;
        }
        if (createHash('sha256').update(current.content).digest('hex') !== page.previous) {
          results.push({ slug: page.slug, status: 'CMS_EDIT_PRESERVED' });
          continue;
        }
        if (apply) {
          const update = await tx.page.updateMany({
            where: { id: current.id, content: current.content, isPublished: true, updatedAt: current.updatedAt },
            data: { content: page.content },
          });
          if (update.count !== 1) throw new Error('CMS page changed during update. Review the latest version before retrying.');
        }
        results.push({ slug: page.slug, status: apply ? 'UPDATED' : 'READY' });
      }
      return results;
    });
    console.log(JSON.stringify({ apply, pages: result }));
  } finally {
    await db.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Policy update failed');
  process.exitCode = 1;
});
