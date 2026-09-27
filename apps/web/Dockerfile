FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @brokeriq/shared run build
RUN pnpm --filter @brokeriq/admin run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/admin ./apps/admin

EXPOSE 3001

CMD ["pnpm", "--filter", "@brokeriq/admin", "run", "start"]
