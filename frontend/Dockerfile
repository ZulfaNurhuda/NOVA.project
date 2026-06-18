# Build stage
FROM node:25-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage — Hono serveStatic (same as original monolith)
FROM node:25-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY serve.mjs ./
EXPOSE 3000
CMD ["node", "serve.mjs"]
