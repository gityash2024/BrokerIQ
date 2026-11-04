#!/usr/bin/env node
// Invoke only after strict active API/web/APK verification has succeeded.
const fs = require('node:fs');
const pin = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(pin || '')) throw Error('Exact release pin required');
const root = '/opt/brokeriq/current';
const manifest = JSON.parse(fs.readFileSync(root + '/release-manifest.json'));
if (manifest.android.commit !== pin || manifest.portals.commit !== pin || !manifest.android.publishedAt) throw Error('Active release identity mismatch');
for (const line of fs.readFileSync('/opt/brokeriq/secrets/api.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
process.env.JOBS_ENABLED = 'false';
const { PrismaService } = require(root + '/apps/api/dist/src/prisma/prisma.service');
const { CryptoService } = require(root + '/apps/api/dist/src/core/settings/crypto.service');
const { SettingsService } = require(root + '/apps/api/dist/src/core/settings/settings.service');
const db = new PrismaService();
(async () => {
  try {
    const settings = new SettingsService(db, new CryptoService());
    const current = await settings.getAppConfig();
    const android = manifest.android;
    await settings.updateAppConfig({
      mobile: {
        ...current.mobile,
        latestVersion: android.version,
        forceUpdateMessage: `Secure login और नए broker tools के लिए BrokerIQ v${android.version} / Build${android.versionCode} install करें। Existing app को uninstall न करें।`,
      },
      playStoreUrl: 'https://brokeriq.mymultimeds.com' + android.url,
    });
    console.log(
      JSON.stringify({
        commit: pin,
        minimumVersion: current.mobile.minVersion,
        latestVersion: android.version,
        updateLinkVersionCode: android.versionCode,
        emailOtpStillRequired: current.auth.requireLoginEmailOtp,
      }),
    );
  } finally {
    await db.$disconnect();
  }
})().catch(() => {
  console.error('Active release runtime-link update failed; inspect before claiming release acceptance');
  process.exitCode = 1;
});
