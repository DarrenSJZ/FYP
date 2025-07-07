# Optimized Dockerfile for Whisper ASR Model
FROM asr-base AS whisper-deps

# Install whisper-specific dependencies directly to base venv
RUN . /app/.venv/bin/activate && \
    uv pip install ".[whisper]"

# Stage 2: Model download
FROM whisper-deps AS model-download

# Create user and set up cache directory
RUN useradd --create-home --shell /bin/bash app && \
    mkdir -p /home/app/.cache/whisper && \
    chown -R app:app /home/app

USER app

# Pre-download whisper model to cache
RUN . /app/.venv/bin/activate && \
    python -c "import whisper; whisper.load_model('base')"

# Stage 3: Final runtime image
FROM asr-base AS runtime

# Copy dependencies from whisper-deps stage
COPY --from=whisper-deps /app/.venv /app/.venv

# Copy pre-downloaded models from model-download stage  
COPY --from=model-download /home/app/.cache/whisper /home/app/.cache/whisper

# Copy application code
COPY backend/src/asr_models/whisper/stt_model_whisper.py ./src/asr_models/whisper/
COPY backend/src/asr_models/whisper/whisper_service.py ./src/asr_models/whisper/
COPY backend/src/asr_utils ./src/asr_utils/

# Create non-root user and set permissions
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app /home/app

USER app

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Expose HTTP port
EXPOSE 8001

# Health check for HTTP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Default command - run HTTP service
ENTRYPOINT ["python", "src/asr_models/whisper/whisper_service.py"] 