# Advanced Transcription and Validation Platform

## Project Objectives

This project creates a high-quality transcription platform that combines multiple ASR (Automatic Speech Recognition) models with Docker orchestration for scalable, reliable transcription processing.

## Core Features

### Multi-Model ASR Pipeline
- **6 ASR Models Available:**
  - **Whisper** (8001): OpenAI's speech-to-text model
  - **Wav2Vec** (8002): Facebook's self-supervised speech model  
  - **Moonshine** (8003): Useful Sensors' edge-optimized model
  - **Mesolitica** (8004): Malaysian speech recognition model
  - **Vosk** (8005): Offline speech recognition toolkit
  - **Allosaurus** (8006): Universal phoneme recognition model

- **Docker Architecture:**
  - Each model runs as an HTTP microservice in Docker containers
  - Shared base Docker layer for optimized builds and reduced disk usage
  - All services accept any audio format (MP3, WAV, FLAC, etc.)
  - Parallel execution with `asyncio.gather()` for fast processing

### Docker Orchestrator

**Main Components:**
- **Orchestrator Service** (8000): FastAPI service managing parallel ASR requests
- **Individual ASR Services**: Each model as independent HTTP microservice
- **Shared Base Layer**: Common dependencies (PyTorch, FastAPI, etc.)

**Key Features:**
1. **Parallel Execution**: All models process simultaneously
2. **Health Monitoring**: Built-in health checks for all services
3. **Flexible Input**: Accepts any audio format with automatic conversion
4. **Model Selection**: Run specific models or all available models

## Quick Start

### 1. Start All Services
```bash
docker-compose up --build
```

### 2. Test Individual Service
```bash
curl -X POST -F "file=@audio.mp3" http://localhost:8001/transcribe  # Whisper
curl -X POST -F "file=@audio.mp3" http://localhost:8005/transcribe  # Vosk
```

### 3. Parallel Transcription (All Models)
```bash
curl -X POST -F "file=@audio.mp3" http://localhost:8000/transcribe
```

### 4. Health Check
```bash
curl http://localhost:8000/health
```

## API Endpoints

**Orchestrator (8000):**
- `POST /transcribe` - Parallel transcription across all/selected models
- `POST /transcribe-for-gemini` - Generates formatted JSON for Gemini LLM
- `GET /health` - Health check for all ASR services
- `GET /models` - List available ASR models

**Individual Services (8001-8006):**
- `POST /transcribe` - Single model transcription
- `GET /health` - Service health check
- `GET /model-info` - Model information and capabilities

## Architecture Benefits

- **Fast Builds**: Shared Docker base layer reduces build time significantly
- **Disk Efficiency**: No duplicate PyTorch/FastAPI installations across services
- **Service Isolation**: Each model can be updated/scaled independently
- **Format Flexibility**: Automatic audio conversion handles any input format
- **Fault Tolerance**: Individual service failures don't affect other models
- **Easy Scaling**: Services can be scaled horizontally based on demand

## Prerequisites

- Docker and Docker Compose
- At least 8GB RAM (for running multiple models)
- Audio files in any common format (MP3, WAV, FLAC, etc.)

## Development

```bash
# Build specific service
docker-compose build whisper-service

# View logs
docker-compose logs whisper-service

# Scale services
docker-compose up --scale whisper-service=3
```

## Model Capabilities

| Model | Type | Language | Speed | Accuracy |
|-------|------|----------|-------|----------|
| Whisper | Speech-to-Text | Multi-language | Medium | High |
| Wav2Vec | Speech-to-Text | English | Fast | High |
| Moonshine | Speech-to-Text | English | Very Fast | Medium |
| Mesolitica | Speech-to-Text | Malaysian/English | Fast | Medium |
| Vosk | Speech-to-Text | Multi-language | Fast | Medium |
| Allosaurus | Phoneme Recognition | Universal | Fast | High |

---

## Recent Updates

### ✅ Complete Docker Architecture Optimization (2025-06-28)

- **All 6 ASR services** now optimized with shared Docker base layer
- **Shared asr-base image** contains common ML dependencies (PyTorch, FastAPI, numpy, etc.)
- **Massive build time reduction** through dependency sharing
- **Fixed port mappings** and health checks for all services
- **Universal audio format support** - all services now accept MP3, WAV, FLAC, etc.
- **Successfully tested** - all services working with real audio files

**Architecture Changes:**
- Implemented shared `asr-base` Docker layer
- Optimized individual service Dockerfiles to use shared dependencies
- Fixed audio format handling (especially for Vosk service)
- Proper port mapping and service networking
- Comprehensive health monitoring and error handling

**Status: 🎉 ALL SERVICES OPERATIONAL AND OPTIMIZED**