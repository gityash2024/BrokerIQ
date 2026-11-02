#!/usr/bin/env node
// Publish only the immutable candidate APK before switching the serving release.
// This avoids a new download URL briefly returning404 while the old web worker drains.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [commit, expectedHash] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(commit || '') || !/^[a-f0-9]{64}$/.test(expectedHash || ''))
  throw Error('Supply the independently tested full commit and signed APK SHA256');
const base = '/opt/brokeriq';
const candidate = `${base}/releases/rc-${commit.slice(0, 12)}`;
const assert = (ok, reason) => { if (!ok) throw Error(reason); };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main() {
  assert(fs.realpathSync(candidate) === candidate, 'Candidate must be a real release directory');
  const current = fs.realpathSync(`${base}/current`);
  assert(current.startsWith(`${base}/releases/`) && current !== candidate, 'A separate active release is required');
  assert(fs.readFileSync(`${candidate}/.candidate-build-complete`, 'utf8').trim() === commit, 'Candidate build is incomplete');
  const manifest = require(candidate + '/packages/shared/dist').releaseManifestSchema.parse(JSON.parse(fs.readFileSync(candidate + '/release-manifest.json', 'utf8')));
  const artifact = manifest.android;
  const filename = path.basename(artifact.url);
  assert(artifact.commit === commit && artifact.sha256 === expectedHash && artifact.url === `/downloads/${filename}` && filename.endsWith('.apk'), 'Unexpected artifact identity/path');
  const source = `${candidate}/apps/web/public/downloads/${filename}`;
  assert(fs.statSync(source).isFile() && fs.statSync(source).size === artifact.bytes && sha(source) === expectedHash, 'Candidate APK bytes do not match');
  const downloads = `${current}/apps/web/public/downloads`;
  assert(fs.realpathSync(downloads) === downloads, 'Active downloads must not be a symlink');
  const target = `${downloads}/${filename}`;
  try { fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  assert(fs.lstatSync(target).isFile() && fs.statSync(target).size === artifact.bytes && sha(target) === expectedHash, 'Existing artifact collision; no file was overwritten');
  const response = await fetch('https://brokeriq.mymultimeds.com' + artifact.url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  assert(response.ok && response.body, 'Public candidate APK is not reachable from the active web release');
  const hash = crypto.createHash('sha256'); let bytes = 0;
  for await (const part of response.body) { hash.update(part); bytes += part.byteLength; }
  assert(hash.digest('hex') === expectedHash && bytes === artifact.bytes, 'Public prepublished APK differs');
  console.log(JSON.stringify({ result: 'CANDIDATE_APK_PREPUBLISHED_NOT_ACTIVATED', commit, versionCode: artifact.versionCode, sha256: expectedHash, bytes }));
}
main().catch(error => { console.error(JSON.stringify({ result: 'PREPUBLICATION_FAILED', reason: error.message })); process.exitCode = 1; });
