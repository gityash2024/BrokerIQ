#!/usr/bin/env node
// Run on the BrokerIQ host. No credential values, row contents or raw dumps go to logs.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const ROOT = '/opt/brokeriq';
const destination = process.argv[2];
if (!/^\/opt\/brokeriq\/backups\/production-\d{8}T\d{6}Z$/.test(destination || '')) throw Error('A new scoped backup directory is required');
function setting(key) {
  let value = fs
    .readFileSync(ROOT + '/secrets/api.env', 'utf8')
    .split('\n')
    .find((line) => line.startsWith(key + '='))
    ?.slice(key.length + 1)
    .trim();
  if (value?.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
  else if (value?.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
  if (!value) throw Error('Required backup configuration missing');
  return value;
}
const databaseUrl = setting('DATABASE_URL');
const dbUrl = new URL(databaseUrl);
const { PrismaClient } = require(ROOT + '/current/apps/api/node_modules/@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const sha = async (file) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
async function mediaManifest(dir, entries) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error('Storage symlink requires explicit backup review');
    if (entry.isDirectory()) await mediaManifest(file, entries);
    else if (entry.isFile()) entries.push({ path: path.relative(ROOT, file), bytes: (await fsp.stat(file)).size, sha256: await sha(file) });
  }
}
async function main() {
  await fsp.mkdir(destination, { mode: 0o700 }); // fail if this run already exists
  const startedAt = new Date().toISOString();
  const database = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      const [{ snapshot }] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot() AS snapshot');
      const tables = await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
      const rows = [];
      for (const { tablename } of tables) {
        const quoted = '"' + tablename.replace(/"/g, '""') + '"';
        const [item] = await tx.$queryRawUnsafe(
          `SELECT count(*)::text AS count, md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) AS digest FROM ${quoted} t`,
        );
        rows.push({ table: tablename, ...item });
      }
      await new Promise((resolve, reject) => {
        const child = spawn(
          'pg_dump',
          ['--format=custom', '--no-owner', '--no-privileges', '--snapshot=' + snapshot, '--file=' + destination + '/database.dump'],
          {
            env: {
              ...process.env,
              PGHOST: dbUrl.hostname,
              PGPORT: dbUrl.port || '5432',
              PGUSER: decodeURIComponent(dbUrl.username),
              PGPASSWORD: decodeURIComponent(dbUrl.password),
              PGDATABASE: dbUrl.pathname.slice(1),
            },
            stdio: ['ignore', 'ignore', 'ignore'],
          },
        );
        child.on('error', () => reject(Error('Database dump could not start')));
        child.on('exit', (code) => (code === 0 ? resolve() : reject(Error('Database dump failed'))));
      });
      return rows;
    },
    { isolationLevel: 'RepeatableRead', timeout: 600000, maxWait: 10000 },
  );
  const files = [];
  await mediaManifest(ROOT + '/storage', files);
  const manifest = {
    startedAt,
    finishedAt: new Date().toISOString(),
    release: await fsp.realpath(ROOT + '/current'),
    database,
    dumpSha256: await sha(destination + '/database.dump'),
    files,
  };
  await fsp.writeFile(destination + '/manifest.json', JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify({
      backup: destination,
      tables: database.length,
      mediaFiles: files.length,
      mediaBytes: files.reduce((n, f) => n + f.bytes, 0),
      dumpSha256: manifest.dumpSha256,
    }),
  );
}
main()
  .catch(() => {
    console.error('Backup failed; no production data was changed. Inspect the scoped backup directory.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
