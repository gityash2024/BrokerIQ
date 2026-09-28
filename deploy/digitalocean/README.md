# BrokerIQ — DigitalOcean self-host

Web, API, PostgreSQL और media सब एक ही server पर चलते हैं, और सब कुछ **सिर्फ़ `/opt/brokeriq`** में रहता है। Server की बाकी apps (mirsat, softlogic वगैरह) को कोई छूता नहीं।

| चीज़ | कहाँ |
|---|---|
| Website | `https://brokeriq.mymultimeds.com` → pm2 `brokeriq-web` (127.0.0.1:3101) |
| API | `https://brokeriqapi.mymultimeds.com` → pm2 `brokeriq-api` (127.0.0.1:3100) |
| Database | अलग PostgreSQL 14 cluster `brokeriq`, 127.0.0.1:5433, data `/opt/brokeriq/data/postgres` |
| Photos/documents | `/opt/brokeriq/storage/media` — WebP/brotli compressed + AES-256-GCM encrypted |
| Backups | `/opt/brokeriq/backups/{daily,weekly}` — रोज़ 02:30 IST, 7 daily + 4 weekly |
| Node | `/opt/brokeriq/runtime/node` (v22, सिर्फ़ BrokerIQ के लिए; server का global Node नहीं बदला) |
| Secrets | `/opt/brokeriq/secrets/` (api.env, web.env, db.password, backup.key — chmod 600) |

Folder के बाहर सिर्फ़ ये BrokerIQ-नाम वाली चीज़ें हैं: `/etc/nginx/sites-enabled/brokeriq` (symlink), `/etc/letsencrypt/live/brokeriq.mymultimeds.com`, `/etc/cron.d/brokeriq`, `/etc/postgresql/14/brokeriq`, pm2 processes `brokeriq-api`/`brokeriq-web`।

## रोज़ के काम

```bash
/opt/brokeriq/bin/deploy.sh                 # नया code: pull → build → migrate → pm2 reload → health check
pm2 logs brokeriq-api --lines 100           # logs (files: /opt/brokeriq/logs)
/opt/brokeriq/bin/backup.sh                 # अभी backup लें
/opt/brokeriq/bin/restore.sh /opt/brokeriq/backups/daily/<ts>          # test restore (scratch DB)
/opt/brokeriq/bin/restore.sh /opt/brokeriq/backups/daily/<ts> --live   # असली restore
```

## ⚠️ ज़रूरी

- `secrets/api.env` का `ENCRYPTION_MASTER_KEY` **कभी न बदलें और न खोएँ**। सारी media files और admin credentials इसी key से encrypted हैं। `secrets/` folder की एक copy server से बाहर (password manager / offline) ज़रूर रखें।
- `secrets/backup.key` के बिना backups नहीं खुलेंगे।
- Backups उसी server पर हैं। Droplet ही खो जाए तो ये भी जाएँगे; DigitalOcean → Droplet → Backups on करना सस्ता बचाव है।

## पहली बार setup (नए server पर)

1. `git clone -b claude/nifty-ritchie-wvtzhc https://github.com/gityash2024/BrokerIQ.git /opt/brokeriq/app`
2. `/opt/brokeriq/secrets/api.env` और `web.env` बनाएँ (नीचे template)।
3. `bash /opt/brokeriq/app/deploy/digitalocean/bootstrap.sh` → `bash /opt/brokeriq/app/deploy/digitalocean/deploy.sh` → `bash /opt/brokeriq/app/deploy/digitalocean/install-edge.sh`

`api.env`:
```
NODE_ENV=production
HOST=127.0.0.1
PORT=3100
DATABASE_URL=postgresql://brokeriq:<db.password>@127.0.0.1:5433/brokeriq?schema=public
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
ENCRYPTION_MASTER_KEY=<openssl rand -hex 32>
SUPER_ADMIN_EMAIL=...
SUPER_ADMIN_PASSWORD=...
PUBLIC_API_URL=https://brokeriqapi.mymultimeds.com
PUBLIC_WEB_URL=https://brokeriq.mymultimeds.com
CORS_ORIGINS=https://brokeriq.mymultimeds.com
MEDIA_ROOT=/opt/brokeriq/storage/media
```
`web.env`:
```
PORT=3101
NEXT_PUBLIC_API_URL=https://brokeriqapi.mymultimeds.com
NEXT_PUBLIC_SITE_URL=https://brokeriq.mymultimeds.com
API_INTERNAL_URL=http://127.0.0.1:3100
```
