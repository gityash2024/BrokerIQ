# BrokerIQ — Production Deployment, DevOps & Infrastructure Runbook

## 1. Production Topology & Architecture Overview

BrokerIQ is architected for automated, highly resilient deployment across modern cloud infrastructure. The baseline production deployment targets a **DigitalOcean Dedicated Droplet (or Cloud VPS)** running **Docker Compose**, with Nginx serving as the edge ingress controller for SSL termination, reverse proxying, and WebSocket connection upgrades.

```
                                  PUBLIC INTERNET (Clients & Webhooks)
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ INGRESS TIER: NGINX REVERSE PROXY                                                        │
│ - Ports: 80 (HTTP -> 301 Redirect to HTTPS), 443 (TLS 1.3 SSL Termination)               │
│ - Let's Encrypt Automated Certificate Lifecycle                                          │
│ - Static Asset Caching (Cache-Control: public, max-age=31536000)                        │
│ - Dynamic Routing & WebSocket Upgrade Headers:                                           │
│     * /api/v1/*   ──► apps/api:4000 (NestJS HTTP REST API)                               │
│     * /socket.io/*──► apps/api:4000 (Socket.io WebSocket Gateway)                        │
│     * /admin/*    ──► apps/admin:3000 (Next.js Super Admin SSR Portal)                   │
└──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ APPLICATION CONTAINER TIER (Internal Docker Bridge Network: brokeriq-net)                │
│                                                                                          │
│  ┌────────────────────────────────────┐         ┌─────────────────────────────────────┐  │
│  │ container_name: brokeriq-api       │         │ container_name: brokeriq-admin      │  │
│  │ image: brokeriq/api:latest         │         │ image: brokeriq/admin:latest        │  │
│  │ port: 4000 (Internal)              │         │ port: 3000 (Internal)               │  │
│  │ healthcheck: GET /api/v1/health    │         │ healthcheck: GET /api/health        │  │
│  └──────────────────┬─────────────────┘         └──────────────────┬──────────────────┘  │
│                     │                                              │                     │
└─────────────────────┼──────────────────────────────────────────────┼─────────────────────┘
                      │                                              │
                      ▼                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ DATA PERSISTENCE & QUEUEING TIER                                                         │
│                                                                                          │
│  ┌────────────────────────────────────┐         ┌─────────────────────────────────────┐  │
│  │ container_name: brokeriq-postgres  │         │ container_name: brokeriq-redis      │  │
│  │ image: postgres:16-alpine          │         │ image: redis:7-alpine               │  │
│  │ volume: postgres_data -> /var/lib  │         │ volume: redis_data -> /data         │  │
│  │ healthcheck: pg_isready -U brokeriq│         │ healthcheck: redis-cli ping         │  │
│  └────────────────────────────────────┘         └─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Docker Compose Production Configuration

The multi-container cluster is managed via `docker-compose.yml`:

```yaml
version: '3.8'

networks:
  brokeriq-net:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  certbot_conf:
    driver: local
  certbot_www:
    driver: local

services:
  postgres:
    image: postgres:16-alpine
    container_name: brokeriq-postgres
    restart: unless-stopped
    networks:
      - brokeriq-net
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-brokeriq_prod}
      POSTGRES_USER: ${POSTGRES_USER:-brokeriq}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-brokeriq} -d ${POSTGRES_DB:-brokeriq_prod}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2048M

  redis:
    image: redis:7-alpine
    container_name: brokeriq-redis
    restart: unless-stopped
    networks:
      - brokeriq-net
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1024M

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: brokeriq-api
    restart: unless-stopped
    networks:
      - brokeriq-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      MASTER_ENCRYPTION_KEY: ${MASTER_ENCRYPTION_KEY}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    container_name: brokeriq-admin
    restart: unless-stopped
    networks:
      - brokeriq-net
    depends_on:
      - api
    environment:
      NODE_ENV: production
      PORT: 3000
      NEXT_PUBLIC_API_URL: https://${DOMAIN_NAME}/api/v1
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
```

---

## 3. Nginx Reverse Proxy & WebSocket Configuration

The production reverse proxy configuration (`nginx/nginx.conf`) handles SSL, static asset caching, and WebSocket handshakes:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # WebSocket Upgrade Mapping
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # HTTP to HTTPS Redirect
    server {
        listen 80;
        server_name brokeriq.in *.brokeriq.in;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # Primary HTTPS Virtual Host
    server {
        listen 443 ssl http2;
        server_name brokeriq.in *.brokeriq.in;

        ssl_certificate /etc/letsencrypt/live/brokeriq.in/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/brokeriq.in/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers off;

        client_max_body_size 25M;

        # NestJS REST API
        location /api/ {
            proxy_pass http://api:4000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }

        # Socket.io Real-Time WebSocket Gateway
        location /socket.io/ {
            proxy_pass http://api:4000/socket.io/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 300s;
        }

        # Next.js Super Admin Portal
        location /admin {
            proxy_pass http://admin:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

## 4. DigitalOcean Droplet Production Setup Runbook

### Step 1: Server Provisioning & OS Hardening
Deploy an **Ubuntu 24.04 LTS x64 Droplet** (Recommended: 4 vCPU, 8GB RAM, 160GB NVMe SSD):
```bash
# Update and upgrade core packages
sudo apt update && sudo apt upgrade -y

# Configure 4GB Swap Space for burst workloads
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Harden SSH and configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 2: Install Docker Engine & Docker Compose Plugin
```bash
# Install Docker prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key & repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
```

### Step 3: Application Deployment
```bash
# Clone production repository
git clone git@github.com:brokeriq/brokeriq.git /opt/brokeriq
cd /opt/brokeriq

# Configure production environment variables
cp .env.example .env
nano .env

# Generate 256-bit encryption key and JWT secrets
openssl rand -hex 32 # MASTER_ENCRYPTION_KEY
openssl rand -base64 48 # JWT_ACCESS_SECRET
openssl rand -base64 48 # JWT_REFRESH_SECRET

# Build and start services
docker compose -f docker-compose.yml up -d --build

# Run database migrations and seed script
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

---

## 5. Automated Backup & Disaster Recovery Strategy

BrokerIQ enforces a strict **Recovery Point Objective (RPO) of < 24 hours** (15 minutes with WAL archiving) and **Recovery Time Objective (RTO) of < 30 minutes**.

### 5.1 Automated PostgreSQL Backup Script
Run daily via system cron at 02:00 UTC (`/usr/local/bin/brokeriq-backup.sh`):

```bash
#!/bin/bash
set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/brokeriq_backups"
BACKUP_FILE="${BACKUP_DIR}/brokeriq_db_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

mkdir -p "${BACKUP_DIR}"

# 1. Dump and gzip PostgreSQL Database
docker exec brokeriq-postgres pg_dump -U brokeriq -d brokeriq_prod | gzip > "${BACKUP_FILE}"

# 2. Encrypt using OpenSSL AES-256-CBC with backup secret
openssl enc -aes-256-cbc -salt -in "${BACKUP_FILE}" -out "${ENCRYPTED_FILE}" -pass env:BACKUP_PASSPHRASE

# 3. Upload to DigitalOcean Spaces (S3-Compatible)
s3cmd put "${ENCRYPTED_FILE}" "s3://brokeriq-backups/postgres/${TIMESTAMP}_db.sql.gz.enc"

# 4. Clean local temporary files
rm -f "${BACKUP_FILE}" "${ENCRYPTED_FILE}"

# 5. Prune backups older than 30 days on Spaces
s3cmd ls s3://brokeriq-backups/postgres/ | while read -r line; do
  createDate=`echo $line|awk {'print $1" "$2'}`
  createDate=`date -d"$createDate" +%s`
  olderThan=`date --date "30 days ago" +%s`
  if [[ $createDate -lt $olderThan ]]; then
    fileName=`echo $line|awk {'print $4'}`
    if [[ $fileName != "" ]]; then
      s3cmd del "$fileName"
    fi
  fi
done
```

---

## 6. Future AWS Enterprise Migration Roadmap

When platform scale exceeds 10,000 active brokerage tenants, the infrastructure seamlessly transitions to a fully managed AWS architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AWS ENTERPRISE ARCHITECTURE                     │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ Component          │ Current (DO)       │ AWS Target Service           │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Ingress / SSL      │ Nginx + Certbot    │ AWS Application Load         │
│                    │                    │ Balancer (ALB) + ACM SSL     │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ API & Web Services │ Docker Containers  │ Amazon ECS Fargate           │
│                    │ on Droplet         │ (Auto-scaling serverless)    │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Relational Database│ PostgreSQL 16      │ Amazon RDS PostgreSQL 16     │
│                    │ Container Volume   │ Multi-AZ with Read Replica   │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ In-Memory Caching  │ Redis 7 Container  │ Amazon ElastiCache for Redis │
│ & BullMQ Queues    │                    │ (Cluster Mode Enabled)       │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Object Storage     │ DO Spaces (S3 API) │ Amazon S3 + CloudFront CDN   │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ Secret Management  │ Local .env Files   │ AWS Secrets Manager with     │
│                    │                    │ automatic rotation           │
└────────────────────┴────────────────────┴──────────────────────────────┘
```
