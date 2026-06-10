FROM node:20-slim AS base
RUN npm install -g pnpm turbo
WORKDIR /app

# =============================================================================
# STAGE: pruner
# =============================================================================
FROM base AS pruner
COPY . .
RUN turbo prune --scope=news-reader --docker

# =============================================================================
# STAGE: installer (Development Dependencies)
# =============================================================================
FROM base AS installer
WORKDIR /app

# Install system dependencies if needed (e.g. for native modules)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy pruned lockfile and package.jsons
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies
RUN pnpm install

# =============================================================================
# STAGE: dev
# =============================================================================
FROM installer AS dev
ENV NODE_ENV=development
# Copy source code for dev logic if missed, but volumes usually handle it. 
# However, turbo prune COPY --from=pruner /app/out/full/ . is usually needed for build.
# For Dev, we rely on volumes, BUT the anonymous volume for node_modules needs the installed modules from 'installer'.
CMD ["pnpm", "--filter", "news-reader", "dev"]

# =============================================================================
# STAGE: prod-builder (Production Build)
# =============================================================================
FROM installer AS prod-builder
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm turbo build --filter=news-reader...

# =============================================================================
# STAGE: runner
# =============================================================================
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=prod-builder /app/apps/news-reader/publi[c] ./apps/news-reader/public
COPY --from=prod-builder --chown=nextjs:nodejs /app/apps/news-reader/.next/standalone ./
COPY --from=prod-builder --chown=nextjs:nodejs /app/apps/news-reader/.next/static ./apps/news-reader/.next/static

USER nextjs
ENV PORT 3000
CMD ["node", "apps/news-reader/server.js"]
