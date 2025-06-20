# Multi-stage Dockerfile for Moonshine ASR Model
FROM python:3.12.2-slim AS base

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-dev \
    gcc \
    g++ \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

RUN pip install uv

COPY pyproject.toml uv.lock ./
COPY src/asr_utils ./src/asr_utils/

# Create virtual environment and install dependencies using uv
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install ".[moonshine]"

FROM deps AS model-download

RUN mkdir -p /app/models
# (Optional) Download default models here if needed

FROM base AS runtime

COPY --from=deps /app/.venv /app/.venv
COPY --from=deps /usr/local/bin /usr/local/bin
COPY src/asr_models/moonshine/stt_model_moonshine.py ./
COPY src/asr_utils ./src/asr_utils/

RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import useful_moonshine; print('Moonshine model ready')" || exit 1

ENTRYPOINT ["python", "stt_model_moonshine.py"]
CMD ["--help"] 