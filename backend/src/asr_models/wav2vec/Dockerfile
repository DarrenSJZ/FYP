# Optimized Dockerfile for Wav2Vec ASR Model
FROM asr-base AS wav2vec-deps

# Install wav2vec-specific dependencies from pyproject.toml (already in base)
RUN . /app/.venv/bin/activate && \
    UV_HTTP_TIMEOUT=1800 uv pip install ".[wav2vec]"

# Stage 2: Model download
FROM wav2vec-deps AS model-download

# Create user and set up cache directory
RUN useradd --create-home --shell /bin/bash app && \
    mkdir -p /home/app/.cache/huggingface && \
    chown -R app:app /home/app

USER app

# Pre-download wav2vec model to cache
RUN . /app/.venv/bin/activate && \
    python -c "from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor; processor = Wav2Vec2Processor.from_pretrained('facebook/wav2vec2-base-960h'); model = Wav2Vec2ForCTC.from_pretrained('facebook/wav2vec2-base-960h')"

# Stage 3: Final runtime image
FROM asr-base AS runtime

# Copy dependencies from wav2vec-deps stage
COPY --from=wav2vec-deps /app/.venv /app/.venv

# Copy pre-downloaded models from model-download stage  
COPY --from=model-download /home/app/.cache/huggingface /home/app/.cache/huggingface

# Copy application code for execution
COPY backend/src/asr_models/wav2vec/stt_model_wav2vec.py ./src/asr_models/wav2vec/
COPY backend/src/asr_models/wav2vec/wav2vec_service.py ./src/asr_models/wav2vec/
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
EXPOSE 8002

# Health check for HTTP service
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Default command - run HTTP service
ENTRYPOINT ["python", "src/asr_models/wav2vec/wav2vec_service.py"] 