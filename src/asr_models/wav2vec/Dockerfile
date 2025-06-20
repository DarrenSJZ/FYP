# Multi-stage Dockerfile for Wav2Vec ASR Model
FROM python:3.12.2-slim AS base

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

RUN pip install uv

COPY pyproject.toml uv.lock ./
COPY src/asr_utils ./src/asr_utils/

# Create virtual environment and install dependencies using uv
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install ".[wav2vec]"

# Create pydub workaround for missing audioop module
RUN mkdir -p $(python -c 'import site; print(site.getsitepackages()[0])')/pydub && \
    echo '# Stub implementation for pyaudioop' > $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def max(fragment, width): return 0' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def avg(fragment, width): return 0' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def rms(fragment, width): return 0' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def findfit(fragment, reference, width): return 0' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def findmax(fragment, width): return 0' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def findfactor(fragment, reference, width): return 1.0' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def lin2lin(fragment, width, newwidth): return fragment' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py && \
    echo 'def ratecv(fragment, width, nchannels, inrate, outrate, state, weightA=1, weightB=0): return (fragment, (0, 0))' >> $(python -c 'import site; print(site.getsitepackages()[0])')/pydub/pyaudioop.py

FROM deps AS model-download

RUN mkdir -p /app/models
RUN . .venv/bin/activate && \
    python -c "from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor; processor = Wav2Vec2Processor.from_pretrained('facebook/wav2vec2-base-960h'); model = Wav2Vec2ForCTC.from_pretrained('facebook/wav2vec2-base-960h')"

FROM base AS runtime

COPY --from=deps /app/.venv /app/.venv
COPY --from=deps /usr/local/bin /usr/local/bin
COPY --from=deps /usr/local/lib/python3.12/site-packages/pydub /usr/local/lib/python3.12/site-packages/pydub
COPY src/asr_models/wav2vec/stt_model_wav2vec.py ./
COPY src/asr_utils ./src/asr_utils/
COPY --from=model-download /root/.cache/huggingface /root/.cache/huggingface

RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "from transformers import Wav2Vec2ForCTC; print('Wav2Vec model ready')" || exit 1

ENTRYPOINT ["python", "stt_model_wav2vec.py"]
CMD ["--help"] 