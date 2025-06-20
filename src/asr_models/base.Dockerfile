FROM python:3.12.2-slim AS asr-base

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-dev \
    gcc \
    g++ \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY src/asr_utils ./src/asr_utils/ 