# Advanced Transcription and Validation Platform

## Project Objectives

This project aims to create a high-quality transcription platform that combines multiple ASR (Automatic Speech Recognition) models with human validation to produce accurate, community-verified transcriptions. The platform leverages a microservices architecture with shared data to enable scalable, reliable transcription processing.

### Core Features

1. **Multi-Model ASR Pipeline**
   - Implements 5 different ASR models:
     - Wav2Vec
     - Whisper
     - DeepSpeech
     - Moonshine
     - Mesolitica
   - Each model runs in its own isolated virtual environment
   - Models are containerized for consistent performance and easy deployment

2. **LLM-Enhanced Transcription**
   - ASR model outputs are processed through an LLM
   - Integration with Tavily search API for context-aware corrections
   - LLM helps clean and standardize transcriptions
   - Reduces common ASR errors and improves accuracy

3. **Community Validation Tool**
   - Interactive interface for human validation and correction
   - Smart autocomplete suggestions (similar to GitHub Copilot)
   - Tab-completion workflow:
     - Users can accept LLM-suggested completions with Tab
     - Manual edits become new ground truth if suggestions are rejected
   - Community moderation system for validation

4. **Ground Truth Management**
   - Validated transcriptions become the new ground truth
   - Community moderation ensures quality
   - Version control for transcription history
   - Confidence scoring based on validation count

## Architecture

### Microservices with Shared Data Pattern

The platform implements a **microservices architecture with shared data**, which provides the benefits of service isolation while maintaining data consistency:

#### Service Layer (Microservices)
- **FastAPI Backend**: Main orchestration service for handling transcription requests and user interactions
- **ASR Model Services**: Each ASR model operates as an independent service:
  - Whisper Service
  - Wav2Vec Service  
  - Moonshine Service
  - Mesolitica Service
  - DeepSpeech Service
- **LLM Processing Service**: Handles context-aware corrections and standardization
- **Validation Service**: Manages the community validation workflow

#### Shared Data Layer
- **Google Cloud Storage (GCS)**: Centralized storage for audio files and processed data
- **Supabase**: Shared database for:
  - User authentication and management
  - Transcription metadata and results
  - Validation history and community feedback
  - Ground truth versioning

#### Benefits of This Architecture
- **Service Independence**: Each ASR model can be updated, scaled, or replaced independently
- **Data Consistency**: All services work with the same authoritative data sources
- **Scalability**: Services can be scaled horizontally based on demand
- **Fault Tolerance**: Individual service failures don't affect the entire system
- **Technology Flexibility**: Different services can use different technologies and dependencies

### Future Goals

1. **Docker Integration**
   - Containerize ASR models for better isolation and deployment
   - Implement Kubernetes for orchestration
   - Enable horizontal scaling of transcription services

2. **Enhanced LLM Integration**
   - Add context-aware corrections
   - Improve handling of domain-specific terminology

3. **Community Features**
   - Reputation system for validators
   - Gamification elements
   - Quality metrics and reporting

# Installation and Usage

## Prerequisites

- Python 3.10 or higher
- `uv` package manager (for faster dependency installation)
- FFmpeg (for audio processing)
- System dependencies:
  - For Debian/Ubuntu: `sudo apt-get install ffmpeg python3-dev`
  - For Arch Linux: `sudo pacman -S ffmpeg python-dev`

## Project Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. Create and activate the main virtual environment:
   ```bash
   uv venv env_main
   source env_main/bin/activate
   ```

3. Install the project with all dependencies:
   ```bash
   uv pip install ".[all]"
   ```

## Main Components

### FastAPI Backend (`src/main.py`)

The main FastAPI application provides endpoints for:
- Audio file processing and transcription
- ASR model orchestration
- Integration with Supabase for data storage

To run the backend:
```bash
cd src
uvicorn main:app --reload
```

Available endpoints:
- `GET /`: Health check
- `GET /audio/{audio_id}`: Retrieve audio metadata and processing status
- `POST /transcribe/{audio_id}`: Transcribe audio using specified ASR model

### ASR Utilities (`src/asr_utils/`)

The ASR utilities package provides common functionality for all ASR models:

1. **Audio Utilities** (`audio_utils.py`):
   - Audio file processing
   - Sample rate conversion
   - Audio format handling

2. **Base Transcriber** (`base_transcriber.py`):
   - Abstract base class for ASR models
   - Common transcription interface
   - Utility functions for model management

3. **Test Utilities** (`test_utils.py`):
   - Testing helpers for ASR models
   - Audio file validation
   - Transcription accuracy metrics

To use the ASR utilities:
```bash
cd src/asr_utils
uv venv env_asr_utils
source env_asr_utils/bin/activate
uv pip install ".[asr-utils]"
```

## ASR Models

Each ASR model runs as an independent microservice in its own isolated virtual environment. To use a specific model:

1. Navigate to the model directory:
   ```bash
   cd src/asr_models/<model-name>
   ```

2. Run the model's script:
   ```bash
   ./run_<model-name>.sh [options]
   ```

Available models and their options:
- **Whisper**: `./run_whisper.sh [model_name] [options]`
  - Models: tiny.en, tiny, base.en, base, small.en, small, medium.en, medium, large-v1, large-v2, large-v3, large, large-v3-turbo, turbo
  - Example: `./run_whisper.sh base`

- **Wav2Vec**: `./run_wav2vec.sh [audio_file] [options]`
  - Options: --help, --device (cpu/cuda)
  - Example: `./run_wav2vec.sh audio.wav --device cpu`

- **Moonshine**: `./run_moonshine.sh [audio_file] [options]`
  - Options: --help, --device (cpu/cuda)
  - Example: `./run_moonshine.sh audio.wav --device cpu`

- **Mesolitica**: `./run_mesolitica.sh [audio_file] [options]`
  - Options: --help, --device (cpu/cuda)
  - Example: `./run_mesolitica.sh audio.wav --device cpu`

## Environment Variables

Create a `.env` file in the project root with:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Development

1. Install development dependencies:
   ```bash
   uv pip install ".[dev]"
   ```

2. Run tests:
   ```bash
   pytest
   ```

3. Format code:
   ```bash
   black .
   ```

