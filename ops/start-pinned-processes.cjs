// BrokerIQ-only immutable activation. PM2 reload can retain an older absolute script path.
const fs = require('node:fs');
const path = require('node:path');
const file = process.argv[2];
if (!file || !/^\/opt\/brokeriq\/(?:ecosystem\.config\.js|ops\/rollback-ecosystem-(?:build\d+|rc-[a-f0-9]{12})\.cjs)$/.test(file))
  throw Error('Scoped reviewed configuration required');
const config = require(file);
const names = ['brokeriq-api', 'brokeriq-web'];
const apps = config?.apps?.filter((a) => names.includes(a.name)).map((a) => ({ ...a, script: path.resolve(a.cwd, a.script) }));
if (!apps || apps.length !== 2 || new Set(apps.map((a) => a.name)).size !== 2) throw Error('Only the two BrokerIQ services are allowed');
for (const app of apps) {
  if (!app.cwd.startsWith('/opt/brokeriq/releases/') || !fs.existsSync(app.script) || app.interpreter !== '/opt/brokeriq/runtime/node/bin/node')
    throw Error('Pinned runtime paths are invalid');
}
const pm2 = require('/usr/lib/node_modules/pm2');
const run = (method, ...args) => new Promise((resolve, reject) => pm2[method](...args, (error, value) => (error ? reject(error) : resolve(value))));
(async () => {
  await run('connect');
  try {
    const existing = await run('list');
    for (const name of names) if (existing.some((a) => a.name === name)) await run('delete', name);
    await run('start', { apps });
    const current = await run('list');
    for (const expected of apps) {
      const actual = current.find((a) => a.name === expected.name);
      if (!actual || actual.pm2_env.pm_exec_path !== expected.script || actual.pm2_env.pm_cwd !== expected.cwd)
        throw Error('PM2 did not adopt the exact pinned paths');
    }
    console.log(JSON.stringify({ result: 'BROKERIQ_PINNED_PROCESSES_STARTED', services: apps.map((a) => ({ name: a.name, cwd: a.cwd, script: a.script })) }));
  } finally {
    pm2.disconnect();
  }
})().catch(() => {
  console.error('BrokerIQ scoped activation failed; run the reviewed rollback configuration');
  process.exitCode = 1;
});
