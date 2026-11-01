import { readFile } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../core/settings/crypto.service';
import { SettingsService } from '../core/settings/settings.service';
import { LocalStorageService } from '../core/media/local-storage.service';
import { KycPrivateMigration } from '../core/media/kyc-migration';
import { env } from '../config/env';

/** Operations only. Environment must already be loaded securely; this command never boots AppModule/jobs. */
export async function runKycPrivateMigration(options: {
  mode: 'plan' | 'inspect' | 'copy' | 'verify' | 'retire';
  expectedDatabase: string;
  backupProof?: string;
  inspectSample?: boolean;
  originalKycSnapshot?: { count: string; digest: string };
}) {
  if (!['plan', 'inspect', 'copy', 'verify', 'retire'].includes(options.mode)) throw Error('Unsupported migration mode');
  const current = new URL(env().DATABASE_URL).pathname.slice(1);
  if (!options.expectedDatabase || current !== options.expectedDatabase) throw Error('Explicit database does not match the selected connection');
  let proof: { privateKycDocuments?: number; snapshotStartedAt?: string } | null = null;
  if (options.mode !== 'plan') {
    if (!options.backupProof) throw Error('A verified off-host restore proof is required');
    const verified = JSON.parse(await readFile(options.backupProof, 'utf8'));
    if (
      verified.result !== 'VERIFIED_SCRATCH_RESTORE_NO_APPLICATION_STARTED' ||
      !verified.tablesVerified ||
      !verified.mediaFilesVerified ||
      !/^[a-f0-9]{64}$/.test(verified.dumpSha256)
    )
      throw Error('Backup/restore proof is invalid');
    proof = verified;
  }
  if (
    options.mode === 'retire' &&
    (current.startsWith('brokeriq_restore_') || current.startsWith('brokeriq_test') || process.env.BROKERIQ_KYC_RETIRE_PUBLIC !== '1')
  )
    throw Error('Public retirement requires the explicit production release gate; never run it from a scratch/test database');
  const db = new PrismaService();
  await db.$connect();
  try {
    const crypto = new CryptoService();
    const migration = new KycPrivateMigration(db, new LocalStorageService(), crypto, new SettingsService(db, crypto));
    const before = await migration.plan();
    if (options.mode === 'plan') return { mode: options.mode, before };
    if (options.mode === 'verify') {
      if (!options.originalKycSnapshot || !/^[a-f0-9]{32}$/.test(options.originalKycSnapshot.digest))
        throw Error('Original authenticated backup KYC digest is required');
      return { mode: options.mode, before, verification: await migration.verifyCopies(options.originalKycSnapshot) };
    }
    const results = [];
    if (options.mode === 'copy' || options.mode === 'inspect') {
      const rows = await db.kycDocument.findMany({ where: { privateKey: null }, select: { id: true }, orderBy: { id: 'asc' } });
      for (const row of options.mode === 'inspect' && options.inspectSample ? rows.slice(0, 1) : rows)
        results.push(options.mode === 'inspect' ? await migration.inspect(row.id) : await migration.copy(row.id));
    } else {
      if (
        !proof?.snapshotStartedAt ||
        !proof.privateKycDocuments ||
        proof.privateKycDocuments < before.copied ||
        !Number.isFinite(new Date(proof.snapshotStartedAt).getTime()) ||
        new Date(proof.snapshotStartedAt).getTime() > Date.now() + 300000 ||
        Date.now() - new Date(proof.snapshotStartedAt).getTime() > 24 * 60 * 60 * 1000
      )
        throw Error('Retirement requires a fresh restored off-host backup containing the copied private KYC documents');
      const rows = await db.systemSetting.findMany({
        where: { key: { startsWith: 'kyc.private-migration.' } },
        select: { key: true, value: true },
        orderBy: { key: 'asc' },
      });
      for (const row of rows) {
        const value = row.value as { enc?: string };
        const copiedAt = value.enc ? new Date(JSON.parse(crypto.decrypt(value.enc)).copiedAt).getTime() : NaN;
        if (!Number.isFinite(copiedAt) || copiedAt >= new Date(proof.snapshotStartedAt).getTime())
          throw Error('Off-host backup predates a private copy; refresh and restore it before public retirement');
      }
      for (const row of rows) results.push(await migration.retire(row.key.slice('kyc.private-migration.'.length)));
    }
    return { mode: options.mode, before, after: await migration.plan(), results };
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  const [mode, expectedDatabase, backupProof] = process.argv.slice(2);
  if (!['plan', 'inspect', 'copy', 'retire'].includes(mode)) throw Error('Use plan/inspect/copy/retire plus explicit database name and backup proof');
  runKycPrivateMigration({ mode: mode as 'plan' | 'inspect' | 'copy' | 'retire', expectedDatabase, backupProof })
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error('KYC migration stopped. No credential/provider URL was logged; inspect encrypted migration state.');
      process.exitCode = 1;
    });
}
