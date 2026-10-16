/** Read-only, PII-free register reconciliation. Usage: <broker-email> <source-sha256> */
import { PrismaClient } from '@prisma/client';

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(database.hostname) || !/^brokeriq_(b2b|release_test)/.test(database.pathname.slice(1)))
    throw new Error('Only a local fresh BrokerIQ B2B/test database is allowed');
  const [email, sourceSha256] = process.argv.slice(2);
  if (!email || !/^[a-f0-9]{64}$/.test(sourceSha256 ?? '')) throw new Error('Broker email and source SHA256 required');
  const prisma = new PrismaClient();
  try {
    const broker = await prisma.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    if (broker.role !== 'BROKER_ADMIN' || !broker.organizationId) throw new Error('Broker firm required');
    const batch = await prisma.importBatch.findUniqueOrThrow({
      where: { organizationId_sourceType_sourceHash: { organizationId: broker.organizationId, sourceType: 'PDF_REGISTER', sourceHash: sourceSha256 } },
    });
    const metadata = batch.metadata as any;
    const pageNumbers: number[] = metadata.pages?.map((page: any) => page.pageNo) ?? [];
    if (!pageNumbers.length || new Set(pageNumbers).size !== pageNumbers.length) throw new Error('Source page manifest is missing or invalid');
    const entries = await prisma.sourceEntry.findMany({
      where: { batchId: batch.id },
      select: { id: true, entryKey: true, pageNo: true, reviewState: true, reviewNote: true },
    });
    const inventory = await prisma.inventoryItem.findMany({
      where: { sourceEntry: { batchId: batch.id }, deletedAt: null },
      select: { sourceEntryId: true, availability: true },
    });
    const pages = pageNumbers.sort((a, b) => a - b).map((pageNo) => {
      const rows = entries.filter((entry) => entry.pageNo === pageNo);
      const visual = rows.filter((entry) => entry.entryKey.startsWith('visual-v1-'));
      const original = rows.filter((entry) => !entry.entryKey.startsWith('visual-v1-'));
      const ids = new Set(rows.map((entry) => entry.id));
      const records = inventory.filter((item) => item.sourceEntryId && ids.has(item.sourceEntryId));
      const examined = Boolean(metadata.visualReviews?.some((page: any) => page.pageNo === pageNo));
      return {
        pageNo,
        visuallyExamined: examined,
        originalCandidateBlocks: original.length,
        supersededObservations: original.filter((entry) => entry.reviewNote === 'SUPERSEDED_BY_VISUAL_REVIEW').length,
        pendingCandidateBlocks: original.filter((entry) => entry.reviewState === 'NEEDS_REVIEW').length,
        sourceGroups: visual.length,
        approvedGroups: visual.filter((entry) => entry.reviewState === 'APPROVED').length,
        unresolvedGroups: visual.filter((entry) => entry.reviewState === 'NEEDS_REVIEW').length,
        inventoryRecords: records.length,
        unknownAvailabilityRecords: records.filter((item) => item.availability === 'UNKNOWN').length,
      };
    });
    const sum = (field: keyof (typeof pages)[number]) => pages.reduce((total, page) => total + Number(page[field]), 0);
    const pendingCandidateBlocks = sum('pendingCandidateBlocks');
    const unresolvedGroups = sum('unresolvedGroups');
    const examinedPages = pages.filter((page) => page.visuallyExamined).length;
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceSha256,
      status: examinedPages === pages.length && !pendingCandidateBlocks && !unresolvedGroups ? 'RECONCILED' : 'INCOMPLETE_RECONCILIATION',
      totalPages: pages.length,
      visuallyExaminedPages: examinedPages,
      remainingPages: pages.length - examinedPages,
      sourceGroups: sum('sourceGroups'),
      approvedGroups: sum('approvedGroups'),
      unresolvedGroups,
      pendingCandidateBlocks,
      inventoryRecords: inventory.length,
      unknownAvailabilityRecords: sum('unknownAvailabilityRecords'),
      note: 'Candidate blocks, source groups and ledger records are different measures. Ledger records are not a final count of unique physical properties. Historical notes do not confirm current availability.',
      pages,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
