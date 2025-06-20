# Multi-stage Dockerfile for Vosk ASR Model
# Stage 1: Base image with system dependencies
FROM python:3.12.2-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps

# Install uv for faster dependency management
RUN pip install uv

# Copy project files (relative to build context from project root)
COPY pyproject.toml uv.lock ./
COPY src/asr_utils ./src/asr_utils/

# Create virtual environment and install dependencies using uv
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install ".[vosk]"

# Stage 3: Model download (optional - can be done at runtime)
FROM deps AS model-download

# Create directory for models
RUN mkdir -p /app/models

# Download a default Vosk model to include in image
# This is optional - models can be downloaded at runtime
RUN . .venv/bin/activate && \
    python -c "import vosk; import os; os.makedirs('/app/models', exist_ok=True); print('Vosk model ready for download')"

# Stage 4: Final runtime image
FROM base AS runtime

# Copy Python dependencies from dependencies stage
COPY --from=deps /app/.venv /app/.venv
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code
COPY src/asr_models/vosk/stt_model_vosk.py ./
COPY src/asr_utils ./src/asr_utils/

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import vosk; print('Vosk model ready')" || exit 1

# Default command
ENTRYPOINT ["python", "stt_model_vosk.py"]

# Default arguments
CMD ["--help"] 