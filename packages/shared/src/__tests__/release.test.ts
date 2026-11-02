import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseManifestSchema } from '../release';
const identity = { version: '2.3.0', commit: 'a'.repeat(40), builtAt: '2026-11-02T07:00:00Z', publishedAt: '2026-11-02T07:05:00Z' };
test('release identity requires actual artifact metadata and safe same-site public assets', () => {
  const manifest = {
    schemaVersion: 1,
    environment: 'staging',
    portals: identity,
    android: {
      ...identity,
      versionCode: 41,
      url: '/downloads/BrokerIQ-v2.3.0-build41.apk',
      sha256: 'b'.repeat(64),
      bytes: 100,
      certificateSha256: 'c'.repeat(64),
    },
    screenshots: [],
  };
  assert.equal(releaseManifestSchema.safeParse(manifest).success, true);
  for (const android of [
    { ...manifest.android, sha256: '' },
    { ...manifest.android, url: 'https://foreign.example/app.apk' },
    { ...manifest.android, commit: 'unknown' },
    { ...manifest.android, bytes: 0 },
  ])
    assert.equal(releaseManifestSchema.safeParse({ ...manifest, android }).success, false);
  assert.equal(
    releaseManifestSchema.safeParse({
      ...manifest,
      screenshots: [{ src: '/product/../../private.png', description: 'x', commit: null, versionCode: 26, capturedAt: identity.builtAt }],
    }).success,
    false,
  );
});
