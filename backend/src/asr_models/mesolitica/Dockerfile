# Optimized Dockerfile for Mesolitica ASR Model
FROM asr-base AS mesolitica-deps

# Install mesolitica-specific dependencies from pyproject.toml (already in base)
RUN . /app/.venv/bin/activate && \
    UV_HTTP_TIMEOUT=1800 uv pip install ".[mesolitica]"

# Stage 2: Model download
FROM mesolitica-deps AS model-download

# Create user and set up cache directory
RUN useradd --create-home --shell /bin/bash app && \
    mkdir -p /home/app/.cache/huggingface && \
    chown -R app:app /home/app

USER app

# Pre-download mesolitica model to cache
RUN . /app/.venv/bin/activate && \
    python -c "from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor; processor = Wav2Vec2Processor.from_pretrained('mesolitica/wav2vec2-xls-r-300m-mixed'); model = Wav2Vec2ForCTC.from_pretrained('mesolitica/wav2vec2-xls-r-300m-mixed')"

# Stage 3: Final runtime image
FROM asr-base AS runtime

# Copy dependencies from mesolitica-deps stage
COPY --from=mesolitica-deps /app/.venv /app/.venv

# Copy pre-downloaded models from model-download stage  
COPY --from=model-download /home/app/.cache/huggingface /home/app/.cache/huggingface

# Copy application code for execution
COPY backend/src/asr_models/mesolitica/stt_model_mesolitica.py ./src/asr_models/mesolitica/
COPY backend/src/asr_models/mesolitica/mesolitica_service.py ./src/asr_models/mesolitica/
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
EXPOSE 8004

# Health check for HTTP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8004/health || exit 1

# Default command - run HTTP service
ENTRYPOINT ["python", "src/asr_models/mesolitica/mesolitica_service.py"] 