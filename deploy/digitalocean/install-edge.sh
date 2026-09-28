#!/usr/bin/env bash
# nginx vhost + Let's Encrypt cert + backup cron for BrokerIQ. Touches only BrokerIQ files:
#   /etc/nginx/sites-enabled/brokeriq -> /opt/brokeriq/nginx/brokeriq.conf
#   /etc/letsencrypt/live/brokeriq.mymultimeds.com (both domains)
#   /etc/cron.d/brokeriq
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
SRC="$BASE/app/deploy/digitalocean"
CERT="/etc/letsencrypt/live/$WEB_DOMAIN/fullchain.pem"

install -m 644 "$SRC"/nginx/*.conf "$BASE/nginx/"
reload_nginx() { nginx -t && systemctl reload nginx; }

if [ ! -f "$CERT" ]; then
  log "Phase 1: ACME-only vhost"
  ln -sfn "$BASE/nginx/brokeriq-bootstrap.conf" /etc/nginx/sites-enabled/brokeriq
  reload_nginx
  certbot certonly --webroot -w "$BASE/nginx/acme" -d "$WEB_DOMAIN" -d "$API_DOMAIN" \
    --cert-name "$WEB_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email \
    --deploy-hook "systemctl reload nginx"
fi

log "Full vhost"
ln -sfn "$BASE/nginx/brokeriq.conf" /etc/nginx/sites-enabled/brokeriq
reload_nginx

log "Backup cron"
install -m 644 "$SRC/cron.brokeriq" /etc/cron.d/brokeriq
log "Edge ready: https://$WEB_DOMAIN  https://$API_DOMAIN"
