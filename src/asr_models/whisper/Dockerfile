# Multi-stage Dockerfile for Whisper ASR Model
# Stage 1: Base image with system dependencies
FROM asr-base:latest

# Set environment variable for cache location
ENV XDG_CACHE_HOME=/home/app/.cache

# Set working directory
WORKDIR /app

# Stage 2: Dependencies installation
FROM asr-base AS deps

# Install uv for faster dependency management
RUN pip install uv

# Copy project files (relative to build context from project root)
COPY pyproject.toml uv.lock ./
COPY src/asr_utils ./src/asr_utils/

# Create virtual environment and install dependencies using uv
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install ".[whisper]"

# Stage 3: Model download (optional - can be done at runtime)
FROM deps AS model-download

RUN useradd --create-home --shell /bin/bash app
USER app

RUN mkdir -p /home/app/.cache/whisper && \
    . .venv/bin/activate && \
    python -c "import whisper; whisper.load_model('base')"

# Stage 4: Final runtime image
FROM asr-base AS runtime

# Copy virtual environment from dependencies stage
COPY --from=deps /app/.venv /app/.venv
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code with proper structure
COPY src/asr_models/whisper/stt_model_whisper.py ./src/asr_models/whisper/
COPY src/asr_utils ./src/asr_utils/

# Copy downloaded models (optional)
COPY --from=model-download /home/app/.cache/whisper /home/app/.cache/whisper

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
    CMD python -c "import whisper; print('Whisper model ready')" || exit 1

# Default command
ENTRYPOINT ["python", "src/asr_models/whisper/stt_model_whisper.py"]

# Default arguments
CMD ["base"] 