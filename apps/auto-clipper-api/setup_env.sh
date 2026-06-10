#!/bin/bash

# Exit on error
set -e

echo "🚀 Setting up Auto-Clipper API Environment using uv..."

# 1. System Dependencies Check
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: FFmpeg is required but not installed."
    echo "   Please install it (e.g., 'brew install ffmpeg' or 'sudo apt install ffmpeg')."
    exit 1
fi

# 2. uv Version Check
if command -v uv &> /dev/null; then
    echo "✨ Using uv: $(uv --version)"
else
    echo "❌ Error: uv is not found. Please install it."
    exit 1
fi

# 3. Sync Dependencies
echo "⬇️ Installing Python packages..."
uv sync

# 4. Create Directory Structure
mkdir -p temp
mkdir -p storage

echo "✅ Setup Complete!"
echo "👉 To start the server:"
echo "   uv run fastapi dev main.py --port 8000"
