FROM python:3.11-slim

WORKDIR /app

# Python出力をバッファリングしない (ログ即時表示用)
ENV PYTHONUNBUFFERED=1

# インストール中にバイトコードをコンパイルしない(高速化)
ENV UV_COMPILE_BYTECODE=1

# システム依存関係のインストール
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# uvバイナリのコピー
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 依存関係のインストール (ソースはまだコピーしないことでキャッシュを最大限活かす)
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

# ソースコードのコピー
COPY src ./src

# /app/.venv の環境変数を追加して仮想環境をアクティベート状態にする
ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
