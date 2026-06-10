# =============================================================================
# STAGE 1: base - 依存関係のインストール層 (キャッシュのキー)
# =============================================================================
FROM node:20-slim AS base
# pnpmをグローバルにインストール
RUN npm install -g pnpm

# Monorepoのルートディレクトリが/appになるように調整
WORKDIR /app

# 1. Monorepoのルート依存関係ファイルをコピー (キャッシュヒット率最大化)
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# 2. 共有パッケージとアプリ固有のファイルをコピー
COPY packages /app/packages
# アプリ固有の設定ファイルをコピー
COPY apps/my-kindle/package.json apps/my-kindle/next.config.ts apps/my-kindle/tsconfig.json apps/my-kindle/
COPY apps/my-kindle/app-config.json apps/my-kindle/
COPY apps/my-kindle/public apps/my-kindle/public

# 3. 依存関係のインストール (ロックファイルに変更がない限りキャッシュ再利用)
RUN pnpm install --frozen-lockfile

# =============================================================================
# STAGE 2: dev - 開発環境層 (Hot Reload)
# =============================================================================
FROM base AS dev
WORKDIR /app
ENV NODE_ENV development
# ソースコードはdocker-composeでマウントされる前提
CMD ["pnpm", "--filter", "my-kindle", "dev"]

# =============================================================================
# STAGE 3: builder - アプリケーションのビルド層
# =============================================================================
FROM base AS builder

WORKDIR /app

# 1. アプリケーションのソースコードをコピー
COPY apps/my-kindle/src apps/my-kindle/src
# publicはbaseでコピー済みだが、念のためここでも確認（baseから継承されているので不要だが、明示的に）

# 2. Next.jsアプリケーションのビルド (standaloneモードで最小構成を生成)
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm --filter my-kindle run build

# =============================================================================
# STAGE 4: runner - 実行環境層 (最小限のイメージ)
# =============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# 1. Next.jsのstandalone成果物、静的ファイルをコピー
# standaloneモードはnext.config.jsをコピーする必要がある
COPY --from=builder /app/apps/my-kindle/.next/standalone ./
COPY --from=builder /app/apps/my-kindle/.next/static ./apps/my-kindle/.next/static
COPY --from=builder /app/apps/my-kindle/public ./apps/my-kindle/public

# 2. 環境変数をコピー
ENV NODE_ENV production
ENV NEXT_PUBLIC_PORT 3000
COPY apps/my-kindle/app-config.json ./apps/my-kindle/

# 実行コマンド
CMD ["node", "apps/my-kindle/server.js"]