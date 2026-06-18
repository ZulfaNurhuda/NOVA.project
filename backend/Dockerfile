FROM node:25-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
ENV NODE_ENV=development
RUN npm ci
COPY api ./api
COPY db ./db
COPY scripts ./scripts
COPY server.ts tsconfig.json drizzle.config.ts ./
RUN npm run build

FROM node:25-slim AS deps
RUN apt-get update && apt-get install -y python3 make g++ openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force && rm -rf /root/.npm /tmp/*

FROM node:25-slim
RUN apt-get update && apt-get install -y wget openssl ca-certificates gosu && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r app && useradd -r -g app -m -d /home/app app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN chmod +x /docker-entrypoint.sh && \
    mkdir -p /app/uploads && chown -R app:app /app

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health/ready || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
