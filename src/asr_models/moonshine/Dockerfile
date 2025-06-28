# Optimized Dockerfile for Moonshine ASR Model
FROM asr-base AS moonshine-deps

# Install moonshine-specific dependencies from requirements file
COPY src/asr_models/moonshine/moonshine_requirements.txt /app/requirements.txt
RUN . /app/.venv/bin/activate && \
    uv pip install -r /app/requirements.txt

# Stage 2: Model download
FROM moonshine-deps AS model-download

# Create user and set up cache directory
RUN useradd --create-home --shell /bin/bash app && \
    mkdir -p /home/app/.cache/moonshine && \
    chown -R app:app /home/app

USER app

# Pre-download moonshine model to cache
# TODO: Fix TensorFlow dependency issue before enabling model pre-download
# RUN . /app/.venv/bin/activate && \
#     python -c "import moonshine; moonshine.load_model('moonshine/base')"

# Stage 3: Final runtime image
FROM asr-base AS runtime

# Copy dependencies from moonshine-deps stage
COPY --from=moonshine-deps /app/.venv /app/.venv

# Copy pre-downloaded models from model-download stage  
COPY --from=model-download /home/app/.cache/moonshine /home/app/.cache/moonshine

# Copy application code
COPY src/asr_models/moonshine/stt_model_moonshine.py ./src/asr_models/moonshine/
COPY src/asr_models/moonshine/moonshine_service.py ./src/asr_models/moonshine/
COPY src/asr_utils ./src/asr_utils/

# Create non-root user and set permissions
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app /home/app

USER app

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Expose HTTP port
EXPOSE 8003

# Health check for HTTP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

# Default command - run HTTP service
ENTRYPOINT ["python", "src/asr_models/moonshine/moonshine_service.py"] 