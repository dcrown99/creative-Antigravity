FROM python:3.11-slim

WORKDIR /app

# System dependencies (if needed for ccxt compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install dependencies via uv (using pyproject.toml)
COPY pyproject.toml uv.lock* ./
ENV UV_COMPILE_BYTECODE=1
RUN uv sync --frozen --no-dev
COPY src/ ./src/

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PATH="/app/.venv/bin:$PATH"

# Command
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
