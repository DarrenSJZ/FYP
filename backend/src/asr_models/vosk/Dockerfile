# Optimized Dockerfile for Vosk ASR Model
FROM asr-base AS vosk-deps

# Install vosk-specific dependencies from requirements file
COPY backend/src/asr_models/vosk/vosk_requirements.txt /app/requirements.txt
RUN . /app/.venv/bin/activate && \
    uv pip install -r /app/requirements.txt

# Stage 2: Model download
FROM vosk-deps AS model-download

# Create user and set up cache directory
RUN useradd --create-home --shell /bin/bash app && \
    mkdir -p /home/app/.cache/vosk && \
    chown -R app:app /home/app

USER app

# Pre-download vosk model to cache
RUN . /app/.venv/bin/activate && \
    python -c "from vosk import Model; model = Model(lang='en-us')"

# Stage 3: Final runtime image
FROM asr-base AS runtime

# Copy dependencies from vosk-deps stage
COPY --from=vosk-deps /app/.venv /app/.venv

# Copy pre-downloaded models from model-download stage  
COPY --from=model-download /home/app/.cache/vosk /home/app/.cache/vosk

# Copy application code
COPY backend/src/asr_models/vosk/stt_model_vosk.py ./src/asr_models/vosk/
COPY backend/src/asr_models/vosk/vosk_service.py ./src/asr_models/vosk/
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
EXPOSE 8005

# Health check for HTTP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8005/health || exit 1

# Default command - run HTTP service
ENTRYPOINT ["python", "src/asr_models/vosk/vosk_service.py"] 