FROM python:3.12.2-slim AS asr-base

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-dev \
    gcc \
    g++ \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app

# Install shared base dependencies that all services use
COPY pyproject.toml ./
COPY src/asr_utils ./src/asr_utils/
RUN uv venv .venv && \
    . .venv/bin/activate && \
    uv pip install ".[asr-base]"

# The base venv (/app/.venv) now contains all common dependencies
# Services will clone this venv and add their specific dependencies
