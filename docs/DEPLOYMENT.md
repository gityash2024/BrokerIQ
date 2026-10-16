# BrokerIQ deployment और rollback

वर्तमान shared DigitalOcean server पर केवल `/opt/brokeriq` तथा PM2 के `brokeriq-api` और `brokeriq-web` बदलें। nginx, PostgreSQL clusters, global runtimes, `/etc/cron.d`, अन्य products और global PM2 state को न बदलें। वर्तमान instance broker-first staging है; live provider और physical-device acceptance अभी बाकी है।

| भाग | वर्तमान स्थिति |
|---|---|
| Web / landing / login | https://brokeriq.mymultimeds.com |
| API health | https://brokeriqapi.mymultimeds.com/api/health |
| Active checkout | `/opt/brokeriq/current` → `/opt/brokeriq/releases/f02daa4` — directory का पुराना नाम commit/version नहीं है |
| Database | `brokeriq_b2b_20261015`, PostgreSQL 14, localhost:5433 |
| Private encrypted media | `/opt/brokeriq/storage/media-b2b` |
| Secrets | `/opt/brokeriq/secrets/api.env`, `web.env` |
| Original rollback state | `/opt/brokeriq/app` और पुराना `brokeriq` database सुरक्षित हैं |

## Deploy

```sh
git push origin feat/production
ssh root@165.232.182.189 'bash /opt/brokeriq/bin/deploy.sh'
```

Script shared → API → web builds, fresh active database पर migrations और केवल BrokerIQ PM2 registrations reload करता है। Server का global Node नहीं बदलता। Broker accounts या passwords code/seed में न डालें; bootstrap encrypted/private inputs से होता है। Integration credentials Settings में encrypted रखे जाते हैं।

PM2 का cwd/environment बदलने पर केवल process-name reload पर्याप्त नहीं होता। BrokerIQ ecosystem file इस्तेमाल करें:

```sh
pm2 startOrReload /opt/brokeriq/ecosystem.config.js --only brokeriq-api,brokeriq-web --update-env
```

Global `pm2 save`, अन्य process reload या पुराने database पर migrations न चलाएँ।

## Backup और restore verification

```sh
bash /opt/brokeriq/bin/checkpoint.sh
```

Checkpoint में encrypted database, secrets, source checkout और register evidence तथा पहले से encrypted private media शामिल हैं। यह अपने scratch database में वास्तविक restore करके सभी public tables की exact counts मिलाता है; media और register evidence के SHA256 भी मिलते हैं। `RESTORE_VERIFIED.txt`, `SHA256SUMS` और `release-commit.txt` प्रमाण हैं। वर्तमान verified checkpoint [release handoff](RELEASE_HANDOFF.md) में दर्ज है।

अतिरिक्त non-live restore test:

```sh
bash /opt/brokeriq/bin/restore.sh /opt/brokeriq/backups/checkpoints/<checkpoint>
```

यह BrokerIQ scratch database बनाकर हटाता है। `--live` वर्तमान business data बदलता है; इसका उपयोग केवल चुने हुए checkpoint से वास्तविक recovery के समय करें। Checksum failure पर restore database/process operations से पहले रुकता है। Media और secrets encryption keys सुरक्षित रखें; केवल source code से encrypted data नहीं खुलेगा।

पुराने pre-cutover instance पर लौटने का retained script:

```sh
bash /opt/brokeriq/backups/cutover/20261015-175526/rollback.sh
```

यह original release/database configuration पर लौटता है; नए database के बाद के edits पुराने database में नहीं आते। पहले नवीनतम checkpoint सुरक्षित रखें। इस release में rollback script दोबारा नहीं चलाया गया है।

## Release acceptance

[RELEASE_HANDOFF.md](RELEASE_HANDOFF.md), [REGISTER_RECONCILIATION.md](REGISTER_RECONCILIATION.md) और [RELEASE_PROGRESS.md](RELEASE_PROGRESS.md) वर्तमान evidence तथा सीमाएँ रखते हैं। Provider credentials, authorized WhatsApp test recipient और physical Android-device verification मिलने तक integrations/device acceptance को complete न मानें। Deployment script global cron configuration नहीं लिखता; इस handoff में recurring scheduling की नई स्थापना का दावा नहीं है।

## Local checks

```sh
pnpm --filter @brokeriq/shared build
pnpm -r typecheck
DATABASE_URL='<isolated-test-database-url>' pnpm --filter @brokeriq/api test:e2e
```

Tests के लिए मौजूदा business database इस्तेमाल न करें। Android release के signing material को private रखें; build instructions [PLAY_STORE.md](PLAY_STORE.md) में हैं।
