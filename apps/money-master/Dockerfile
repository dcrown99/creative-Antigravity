# =============================================================================
# STAGE 1: base - 依存関係のインストール層 (キャッシュのキー)
# =============================================================================
FROM node:22-slim AS base
# pnpmをグローバルにインストール
RUN npm install -g pnpm

WORKDIR /app

# 1. Monorepoのルート依存関係ファイルをコピー (キャッシュヒット率最大化)
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# 2. 共有パッケージとアプリ固有のファイルをコピー
COPY packages /app/packages
COPY apps/money-master/package.json apps/money-master/next.config.ts apps/money-master/tsconfig.json apps/money-master/
COPY apps/money-master/prisma apps/money-master/prisma

# 3. 依存関係のインストール (ロックファイルに変更がない限りキャッシュ再利用)
RUN pnpm install --frozen-lockfile

# =============================================================================
# STAGE 1.5: dev - 開発環境層 (Hot Reloading)
# =============================================================================
FROM base AS dev
ENV NODE_ENV=development
# Prisma用にOpenSSLをインストール (Bookworm = openssl 3.0)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# 開発サーバー起動
CMD ["pnpm", "--filter", "money-master", "dev"]

# =============================================================================
# STAGE 2: builder - アプリケーションのビルド層
# =============================================================================
FROM base AS builder

WORKDIR /app

# 1. アプリケーションのソースコードと静的ファイルをコピー
COPY apps/money-master/src apps/money-master/src
COPY apps/money-master/public apps/money-master/public

# 2. Next.jsアプリケーションのビルド (standaloneモードで最小構成を生成)
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm --filter money-master run build

# =============================================================================
# STAGE 3: runner - 実行環境層 (最小限のイメージ)
# =============================================================================
FROM node:22-slim AS runner

# Prisma用にOpenSSLをインストール
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Next.jsのstandalone成果物をmonorepo構造でコピー
COPY --from=builder /app/apps/money-master/.next/standalone ./
COPY --from=builder /app/apps/money-master/.next/static ./apps/money-master/.next/static
COPY --from=builder /app/apps/money-master/public ./apps/money-master/public

# 2. DBファイルをコピー
COPY --from=builder /app/apps/money-master/prisma/dev.db ./apps/money-master/prisma/dev.db

# 3. 環境変数
ENV NODE_ENV production
ENV PORT 3000

# 実行コマンド (standaloneはmonorepo構造を保持)
CMD ["node", "apps/money-master/server.js"]