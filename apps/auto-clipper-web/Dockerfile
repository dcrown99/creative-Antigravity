# =============================================================================
# STAGE 1: base - 依存関係のインストール層 (キャッシュのキー)
# =============================================================================
FROM node:20-slim AS base
# pnpmを使用しているため、ルートの依存関係ファイルを先にコピーすることで、
# ロックファイルが変更されない限り、このレイヤーのキャッシュが再利用される。
RUN npm install -g pnpm

WORKDIR /app

# 1. Monorepoのルート依存関係ファイルをコピー
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# 2. 共有パッケージとアプリ固有のファイルをコピー
COPY packages /app/packages
COPY apps/auto-clipper-web/package.json apps/auto-clipper-web/next.config.ts apps/auto-clipper-web/tsconfig.json apps/auto-clipper-web/tailwind.config.ts apps/auto-clipper-web/postcss.config.mjs apps/auto-clipper-web/
COPY apps/auto-clipper-web/public apps/auto-clipper-web/public

# 3. 依存関係のインストール
RUN pnpm install --frozen-lockfile

# =============================================================================
# STAGE 1.5: dev - 開発環境層 (Hot Reloading)
# =============================================================================
FROM base AS dev
ENV NODE_ENV=development
# 開発サーバー起動
CMD ["pnpm", "--filter", "auto-clipper-web", "dev"]

# =============================================================================
# STAGE 2: builder - アプリケーションのビルド層
# =============================================================================
FROM base AS builder

WORKDIR /app

# 1. アプリケーションのソースコードをコピー
COPY apps/auto-clipper-web/src apps/auto-clipper-web/src

# 2. ビルド
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm --filter auto-clipper-web run build

# =============================================================================
# STAGE 3: runner - 実行環境層 (最小限のイメージ)
# =============================================================================
FROM node:20-slim AS runner

# Next.jsのstandaloneモードで、実行に必要なファイルのみをコピー
WORKDIR /app

# 1. Next.jsのstandalone成果物、静的ファイルをコピー
# standaloneモードはnext.config.jsをコピーする必要がある
COPY --from=builder /app/apps/auto-clipper-web/.next/standalone ./
COPY --from=builder /app/apps/auto-clipper-web/.next/static ./apps/auto-clipper-web/.next/static
COPY --from=builder /app/apps/auto-clipper-web/public ./apps/auto-clipper-web/public

# 2. 環境変数を設定
ENV NODE_ENV production
ENV NEXT_PUBLIC_PORT 3000

# 実行コマンド
CMD ["node", "apps/auto-clipper-web/server.js"]