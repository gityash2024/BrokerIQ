// pm2 apps for BrokerIQ. Both run on BrokerIQ's own Node 22 (not the server's global Node).
const fs = require('fs');
const BASE = '/opt/brokeriq';
const NODE = `${BASE}/runtime/node/bin/node`;

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const common = { interpreter: NODE, exec_mode: 'fork', instances: 1, autorestart: true, time: true, kill_timeout: 10000, restart_delay: 3000, max_restarts: 50 };

module.exports = {
  apps: [
    {
      ...common,
      name: 'brokeriq-api',
      cwd: `${BASE}/app/apps/api`,
      script: 'dist/src/main.js',
      env: { WATCHDOG_INCIDENTS_FILE: `${BASE}/logs/incidents.log`, ...loadEnv(`${BASE}/secrets/api.env`) },
      max_memory_restart: '1200M',
      out_file: `${BASE}/logs/api.out.log`,
      error_file: `${BASE}/logs/api.err.log`,
    },
    {
      ...common,
      name: 'brokeriq-web',
      cwd: `${BASE}/app/apps/web`,
      script: 'node_modules/next/dist/bin/next',
      args: `start -H 127.0.0.1 -p ${loadEnv(`${BASE}/secrets/web.env`).PORT || 3101}`,
      env: { NODE_ENV: 'production', ...loadEnv(`${BASE}/secrets/web.env`) },
      max_memory_restart: '900M',
      out_file: `${BASE}/logs/web.out.log`,
      error_file: `${BASE}/logs/web.err.log`,
    },
  ],
};
