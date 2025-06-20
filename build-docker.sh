#!/bin/bash

set -e

echo "Building Whisper image..."
docker build -t asr-whisper -f src/asr_models/whisper/Dockerfile .

echo "Building Wav2Vec image..."
docker build -t asr-wav2vec -f src/asr_models/wav2vec/Dockerfile .

echo "Building Moonshine image..."
docker build -t asr-moonshine -f src/asr_models/moonshine/Dockerfile .

echo "Building Mesolitica image..."
docker build -t asr-mesolitica -f src/asr_models/mesolitica/Dockerfile .

echo "Building Vosk image..."
docker build -t asr-vosk -f src/asr_models/vosk/Dockerfile .

echo "Building Allosaurus image..."
docker build -t asr-allosaurus -f src/asr_models/allosaurus/Dockerfile .

echo "All Docker images built successfully!" 