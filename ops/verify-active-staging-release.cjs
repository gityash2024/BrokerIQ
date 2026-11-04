#!/usr/bin/env node
// Read-only release acceptance. Expected values come from the tested artifact, never the running server.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const [commit, rawCode, expectedHash] = process.argv.slice(2);
const code = Number(rawCode);
if (!/^[a-f0-9]{40}$/.test(commit || '') || !Number.isInteger(code) || code <= 40 || !/^[a-f0-9]{64}$/.test(expectedHash || ''))
  throw Error('Supply the pinned full commit, expected Android versionCode and signed APK SHA256');
const base = '/opt/brokeriq';
const web = 'https://brokeriq.mymultimeds.com';
const api = 'https://brokeriqapi.mymultimeds.com';
const assert = (ok, reason) => {
  if (!ok) throw Error(reason);
};
async function json(url) {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  assert(response.ok, 'Release identity endpoint is unavailable');
  return response.json();
}
async function main() {
  const root = fs.realpathSync(base + '/current');
  assert(root === `${base}/releases/rc-${commit.slice(0, 12)}`, 'Current symlink does not point to the expected candidate');
  const [internalApi, internalWeb, publicApi, publicWeb] = await Promise.all([
    json('http://127.0.0.1:3100/api/health'),
    json('http://127.0.0.1:3101/release.json'),
    json(api + '/api/health'),
    json(web + '/release.json'),
  ]);
  for (const health of [internalApi, publicApi])
    assert(health.status === 'ok' && health.db === 'ok' && health.release?.commit === commit, 'API is not serving the expected tested commit');
  for (const release of [internalWeb, publicWeb])
    assert(
      release.portals?.commit === commit &&
        release.android?.commit === commit &&
        release.android.versionCode === code &&
        release.android.sha256 === expectedHash,
      'Portal/APK manifest is not the expected tested release',
    );
  const manifest = require(root + '/packages/shared/dist').releaseManifestSchema.parse(publicWeb);
  const processes = JSON.parse(cp.execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  for (const [name, app, script] of [
    ['brokeriq-api', 'api', 'dist/src/main.js'],
    ['brokeriq-web', 'web', 'node_modules/next/dist/bin/next'],
  ]) {
    const process = processes.find((p) => p.name === name);
    assert(
      process?.pm2_env.status === 'online' &&
        process.pm2_env.pm_cwd === `${root}/apps/${app}` &&
        process.pm2_env.pm_exec_path === `${root}/apps/${app}/${script}`,
      'PM2 is not executing the expected candidate',
    );
  }
  const download = await fetch(web + manifest.android.url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  assert(download.ok && download.body, 'Canonical public APK download is unavailable');
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for await (const part of download.body) {
    hash.update(part);
    bytes += part.byteLength;
  }
  assert(hash.digest('hex') === expectedHash && bytes === manifest.android.bytes, 'Public APK bytes do not match the signed artifact');
  console.log(
    JSON.stringify({
      result: 'EXPECTED_STAGING_RELEASE_AND_PUBLIC_APK_VERIFIED',
      commit,
      versionCode: code,
      sha256: expectedHash,
      bytes,
      publishedAt: manifest.portals.publishedAt,
      pm2CandidateVerified: true,
      installedDeviceAcceptance: false,
      fullProductSignoff: false,
    }),
  );
}
main().catch((error) => {
  console.error(JSON.stringify({ result: 'RELEASE_NOT_VERIFIED', reason: error.message }));
  process.exitCode = 1;
});
