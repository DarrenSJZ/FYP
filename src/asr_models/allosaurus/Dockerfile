# Optimized Dockerfile for Allosaurus ASR Model
FROM asr-base AS allosaurus-deps

# Install allosaurus-specific dependencies from requirements file
COPY src/asr_models/allosaurus/allosaurus_requirements.txt /app/requirements.txt
RUN . /app/.venv/bin/activate && \
    uv pip install -r /app/requirements.txt

# Stage 2: Model download
FROM allosaurus-deps AS model-download

# Download the default Allosaurus model so the image is ready for offline/edge use
RUN . /app/.venv/bin/activate && \
    python -c "import allosaurus; from allosaurus.app import read_recognizer; read_recognizer()"

# Create user
RUN useradd --create-home --shell /bin/bash app

# Stage 3: Final runtime image
FROM asr-base AS runtime

# Copy dependencies from allosaurus-deps stage
COPY --from=allosaurus-deps /app/.venv /app/.venv

# Copy application code for execution
COPY src/asr_models/allosaurus/stt_model_allosaurus.py ./src/asr_models/allosaurus/
COPY src/asr_models/allosaurus/allosaurus_service.py ./src/asr_models/allosaurus/
COPY src/asr_utils ./src/asr_utils/

# Create non-root user and set permissions
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app

USER app

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Expose HTTP port
EXPOSE 8006

# Health check for HTTP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8006/health || exit 1

# Default command - run HTTP service
ENTRYPOINT ["python", "src/asr_models/allosaurus/allosaurus_service.py"]