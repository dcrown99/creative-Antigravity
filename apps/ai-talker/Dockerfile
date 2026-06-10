# =============================================================================
# STAGE 1: base - 依存関係のインストール層
# =============================================================================
FROM node:20-slim AS base
RUN npm install -g pnpm

WORKDIR /app

# 1. Monorepoのルート依存関係ファイルをコピー
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# 2. 共有パッケージとアプリ固有のファイルをコピー
COPY packages /app/packages
COPY apps/ai-talker/package.json apps/ai-talker/next.config.ts apps/ai-talker/tsconfig.json apps/ai-talker/tailwind.config.ts apps/ai-talker/

# 3. 依存関係のインストール
RUN pnpm install --frozen-lockfile

# =============================================================================
# STAGE 1.5: dev - 開発環境層
# =============================================================================
FROM base AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED 1
# ソースコードはdocker-composeでマウントされるため、ここではコマンドのみ定義
CMD ["pnpm", "--filter", "ai-talker", "dev"]

# =============================================================================
# STAGE 2: builder - アプリケーションのビルド層
# =============================================================================
FROM base AS builder

WORKDIR /app

# 1. アプリケーションのソースコードをコピー
COPY apps/ai-talker/src apps/ai-talker/src
COPY apps/ai-talker/public apps/ai-talker/public

# 2. Next.jsアプリケーションのビルド
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm --filter ai-talker run build

# =============================================================================
# STAGE 3: runner - 実行環境層
# =============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# 1. Next.jsのstandalone成果物、静的ファイルをコピー
COPY --from=builder /app/apps/ai-talker/.next/standalone ./
COPY --from=builder /app/apps/ai-talker/.next/static ./.next/static
COPY --from=builder /app/apps/ai-talker/public ./public

# 2. 環境変数
ENV NODE_ENV production
ENV NEXT_PUBLIC_PORT 3000

# 実行コマンド
CMD ["node", "server.js"]
