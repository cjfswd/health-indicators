# ── Stage 1: Build ─────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build (client + server separately, skip type-check)
COPY . .
RUN pnpm run build.client && pnpm run build.server

# ── Stage 2: Production ───────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files and install production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy build output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Copy public assets (logo, watermark)
COPY --from=builder /app/public ./public

# Copy drizzle migrations
COPY --from=builder /app/drizzle ./drizzle

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=https://indicadores.healthmaiscuidados.com

EXPOSE 3000

CMD ["node", "server/entry.express.js"]
