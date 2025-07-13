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

## Complete API Endpoints Summary

### **🎯 Orchestrator Service (Port 8000)**
**Main ASR Processing & LLM Analysis**

| Endpoint | Method | Description | Status |
|----------|--------|-------------|---------|
| `/health` | GET | Health check for all ASR services | ✅ Working |
| `/models` | GET | List available ASR models | ✅ Working |
| `/transcribe` | POST | Parallel transcription across all models | ✅ Working |
| `/transcribe-with-gemini` | POST | **Advanced 5-step pipeline with LLM analysis** | ✅ Working |

**Key Features:**
- **5-Step Gemini Pipeline**: Consensus → Search → Validation → Particle Detection → Final Output
- **Cultural Particle Analysis**: Detects Southeast Asian, British, Indian discourse particles
- **Multi-model Consensus**: Combines results from 6 ASR models
- **IPA Phoneme Analysis**: Uses Allosaurus for phonetic particle detection

---

### **🤖 Individual ASR Services (Ports 8001-8006)**
**Dedicated Model Endpoints**

| Service | Port | Model | Method | Endpoint | Status |
|---------|------|-------|--------|----------|---------|
| **Whisper** | 8001 | OpenAI Whisper | POST | `/transcribe` | ✅ Working |
| **Wav2Vec** | 8002 | Facebook Wav2Vec2 | POST | `/transcribe` | ✅ Working |
| **Moonshine** | 8003 | Useful Sensors | POST | `/transcribe` | ✅ Working |
| **Mesolitica** | 8004 | Malaysian Model | POST | `/transcribe` | ✅ Working |
| **Vosk** | 8005 | Offline Toolkit | POST | `/transcribe` | ✅ Working |
| **Allosaurus** | 8006 | Phoneme Recognition | POST | `/transcribe` | ✅ Working |

**Universal Endpoints** (All services 8001-8006):
- `GET /health` - Service health check
- `GET /model-info` - Model capabilities and information

---

### **🔍 Autocomplete Service (Port 8007)**
**Smart Text Suggestions for Transcription Editing**

| Endpoint | Method | Description | Status |
|----------|--------|-------------|---------|
| `/health` | GET | Service health check | ✅ Working |
| `/suggest/position` | GET | Position-based word suggestions | ✅ Implemented |
| `/suggest/prefix` | GET | Prefix-based text completion | ✅ Implemented |

**Query Parameters:**
- **Position suggestions**: `?audio_id={id}&word_index={pos}`
- **Prefix completion**: `?audio_id={id}&prefix={text}&max_results={n}`

**Features:**
- **Prefix Trie**: Fast O(m) prefix matching
- **Position Mapping**: Word-level suggestion by index
- **Confidence Scoring**: Ranked suggestions with confidence scores
- **Multi-source Integration**: Combines Gemini + ASR model alternatives

---

## 🏗️ Current Backend Architecture

### **Total Functionality Available:**

**📊 Core Processing Capabilities:**
- ✅ **6 Parallel ASR Models** running simultaneously
- ✅ **Advanced LLM Pipeline** with Gemini 2.0 Flash (5-step processing)
- ✅ **Cultural Particle Detection** across multiple English varieties
- ✅ **IPA Phoneme Analysis** for linguistic research
- ✅ **Smart Autocomplete** with confidence-based suggestions
- ✅ **Multi-format Audio Support** (MP3, WAV, FLAC, etc.)

**🔬 Research & Analysis Features:**
- ✅ **Consensus Building** across multiple ASR outputs  
- ✅ **Web Search Integration** for context validation
- ✅ **Accent Detection** through particle distribution analysis
- ✅ **Timing Analysis** with phoneme-level alignment
- ✅ **Debug Endpoints** for detailed pipeline inspection

**⚡ Performance & Scalability:**
- ✅ **Docker Microservices** - Each ASR model as independent service
- ✅ **Shared Base Images** - Optimized builds and reduced disk usage
- ✅ **Health Monitoring** - Built-in health checks for all services
- ✅ **Parallel Processing** - Async execution with `asyncio.gather()`
- ✅ **Auto-scaling Ready** - Container-based architecture

### **Service Status:**
| Service Type | Count | Ports | Status |
|-------------|-------|-------|---------|
| **ASR Models** | 6 | 8001-8006 | ✅ All Operational |
| **Orchestrator** | 1 | 8000 | ✅ Working |
| **Autocomplete** | 1 | 8007 | ⚠️ Minor networking issue |
| **Total Endpoints** | **22** | - | **21/22 Working** |

### **Ready for Frontend Integration:**
- 🎯 **Real-time Transcription** endpoints ready
- 🎯 **Autocomplete API** implemented and tested locally  
- 🎯 **Multi-model Comparison** data available
- 🎯 **Cultural Analysis** results structured for visualization
- 🎯 **Debug & Research** endpoints for detailed analysis

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

---

## 🎨 Frontend - Accentric Editor

### Overview
A powerful VIM-enabled text editor interface for transcription editing and ASR output processing, built with React and modern web technologies.

### Features
- ✅ **VIM Mode Support** - Full VIM modal editing with CodeMirror 6
- ✅ **Custom Kanagawa Theming** - Light and dark modes matching project design
- ✅ **Audio Upload & Transcription** - Direct integration with backend ASR services  
- ✅ **Real-time Theme Switching** - Seamless light/dark mode transitions
- ✅ **Modern React Architecture** - Built with Vite, TypeScript, and Tailwind CSS

### Tech Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **CodeMirror 6** with VIM extension for professional text editing
- **Tailwind CSS** for responsive styling
- **Next Themes** for theme management
- **Lucide React** for modern icons

### Quick Start
```bash
# Install dependencies
npm install

# Start frontend development server
npm run frontend:dev

# Start both frontend and backend together
npm run dev
```

### Development
```bash
# Frontend only
cd frontend
npm run dev

# Build frontend
npm run frontend:build

# Preview production build
npm run frontend:preview
```

### Architecture
- **Workspace Structure** - Monorepo with frontend and backend workspaces
- **Theme Integration** - Custom CodeMirror themes map to CSS custom properties
- **Component Architecture** - Modular React components for editor, ribbon, audio upload
- **State Management** - React hooks for VIM mode, themes, and transcription state

### API Integration
- **Audio Upload** endpoints for transcription processing
- **Real-time Results** display from backend ASR services
- **VIM Editor** for post-processing and editing transcribed text
- **Multi-model Support** - Switch between different ASR models and analysis modes

**Status: 🎉 FRONTEND FULLY INTEGRATED AND OPERATIONAL**