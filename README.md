<p align="center">
  <img src="frontend/public/favicon.ico" alt="Project Logo" width="120" height="120"/>
</p>

# 🗣️ Accentric: Gamifying Speech Truth Through Crowd Validation and Accent Diversity 🗣️


<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/frontend-react%20%7C%20typescript-blue?style=for-the-badge" /></a>
  <a href="#"><img src="https://img.shields.io/badge/asr-6%20models%20%7C%20parallel-green?style=for-the-badge" /></a>
  <a href="#"><img src="https://img.shields.io/badge/ai-gemini%20%7C%20nlp-purple?style=for-the-badge" /></a>
  <a href="#"><img src="https://img.shields.io/badge/storage-postgresql%20%7C%20supabase-yellow?style=for-the-badge" /></a>
  <a href="#"><img src="https://img.shields.io/badge/infra-docker%20%7C%20microservices-lightgrey?style=for-the-badge" /></a>
</p>
<p align="left">
  Powered by 6 parallel ASR models, Gemini AI, and FastAPI microservices. Designed for accent-aware speech recognition with cultural discourse particle detection and crowd validation.
</p>

This repository contains our Final Year Project submission for accent-aware speech recognition with gamification elements and cultural context preservation.

**Key Resources:**

*   🎨 **Live Demo:** [Coming Soon - Frontend Integration Complete]
*   📄 **Documentation:** [System Architecture & Setup](https://github.com/DarrenSJZ/Accentric/tree/documentation) | [Sprint Planning & Progress](https://github.com/DarrenSJZ/Accentric/blob/main/sprint-planning-table.md) | [Frontend Navigation Flow](https://github.com/DarrenSJZ/Accentric/blob/main/frontend-navigation-flowcharts.md)
*   🎥 **Demo Videos:** [System Walkthrough - Coming Soon]
*   📊 **Research Data:** [Dataset Examples](./exports/) | [Evaluation Results - Coming Soon]

---

## 📺 System Demonstration

<div align="center">
  
  <!-- Video placeholders - you can replace these with your actual demo videos -->
  
  <p><h3>🎙️ Multi-Model ASR Processing</h3>
  "Watch how our system processes audio through 6 different ASR models simultaneously, then uses AI consensus to create the most accurate transcription."
  
  *[Demo video coming soon - Frontend integration complete]*
  </p>

  <p><h3>🌍 Accent-Aware Particle Detection</h3>
  "See our cultural discourse particle detection in action - identifying Malaysian 'lah', Singaporean 'sia', and British 'innit' with IPA phoneme analysis."
  
  *[Demo video coming soon - Particle detection system operational]*
  </p>

  <p><h3>🎮 Gamified Crowd Validation</h3>
  "Experience the gamification system where users earn points for validating transcriptions and contributing to accent diversity research."
  
  *[Demo video coming soon - Validation system implemented]*
  </p>

</div>

---

## 🚀 Getting Started

### Prerequisites

**System Requirements:**
- **Node.js 18+** for frontend development
- **Python 3.11+** for backend services  
- **Docker & Docker Compose** for ASR model services
- **Git** for version control

### Quick Start (Automated Setup)

**For Linux Users (Arch/Ubuntu/Debian):**
```bash
# Clone the repository
git clone https://github.com/DarrenSJZ/FYP.git
cd FYP

# Make setup scripts executable
chmod +x build-all-docker.sh cleanup-docker.sh tui/run_asr_tui.sh

# Automated Docker build and setup
./build-all-docker.sh --parallel --start
```

**Manual Setup:**

### 1. Frontend Setup

```bash
# Check Node.js version
node --version  # Should be 18+

# Install frontend dependencies
cd frontend/
npm install

# Start React development server
npm run dev
```

### 2. Backend ASR Services Setup

```bash
# Build all ASR services with shared base layer
./build-all-docker.sh

# Or step-by-step manual build:
docker-compose up --build -d
```

**API Keys Setup:**
The build script will guide you through setting up required API keys:
- **Gemini API Key**: For AI consensus analysis ([Get here](https://makersuite.google.com/app/apikey))
- **Tavily API Key**: For web validation ([Get here](https://tavily.com/))

### 3. Start All Services

```bash
# Start all services (6 ASR models + orchestrator + autocomplete + Redis)
docker-compose up -d

# Check service health
curl http://localhost:8000/health
curl http://localhost:8007/health
```

### 4. Test the System

```bash
# Test individual ASR service
curl -X POST -F "file=@test-audio.mp3" http://localhost:8001/transcribe

# Test Stage 1: Multi-model consensus pipeline
curl -X POST -F "file=@test-audio.mp3" http://localhost:8000/transcribe-consensus

# Test Stage 2: Particle detection (requires Stage 1 data)
curl -X POST -F "file=@accented-speech.mp3" -F "accent_hint=singaporean" http://localhost:8000/transcribe-with-particles

# Test diagnostic mode with full ASR details
curl -X POST -F "file=@test-audio.mp3" http://localhost:8000/transcribe/debug
```

---

## 🐧 Linux Distribution Compatibility

### **Arch Linux** ✅ **Fully Supported**
```bash
# Install dependencies
sudo pacman -S docker docker-compose nodejs npm python python-pip git curl jq dialog ffmpeg

# Enable Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER  # Logout and login again

# Run setup
./build-all-docker.sh --parallel --start
```

### **Ubuntu/Debian** ✅ **Fully Supported**
```bash
# Install dependencies
sudo apt update
sudo apt install docker.io docker-compose nodejs npm python3 python3-pip git curl jq dialog ffmpeg

# Enable Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER  # Logout and login again

# Run setup
./build-all-docker.sh --parallel --start
```

### **Fedora/RHEL** ✅ **Compatible**
```bash
# Install dependencies
sudo dnf install docker docker-compose nodejs npm python3 python3-pip git curl jq dialog ffmpeg

# Enable Docker service  
sudo systemctl enable --now docker
sudo usermod -aG docker $USER  # Logout and login again

# Run setup
./build-all-docker.sh --parallel --start
```

### **Other Linux Distributions**
The system should work on any Linux distribution with:
- Docker Engine 20.10+
- Docker Compose v2
- Node.js 18+
- Python 3.11+

---

## 🛠️ Build Scripts and Utilities

### **Automated Build Script**
```bash
# Full automated setup with parallel builds
./build-all-docker.sh --parallel --start

# Available options:
./build-all-docker.sh --help
  -p, --parallel        Build ASR services in parallel
  -v, --verbose         Show detailed build output  
  -f, --force           Force rebuild (--no-cache)
  --start               Start services after build
  --no-orchestrator     Skip orchestrator service
```

### **System Cleanup**
```bash
# Clean up Docker images and containers
./cleanup-docker.sh

# Reset everything for fresh build
./cleanup-docker.sh && ./build-all-docker.sh --force --start
```

### **TUI Interface for Testing**
```bash
# Interactive Terminal User Interface
./tui/run_asr_tui.sh

# Command-line usage
./tui/run_asr_tui.sh --services --audio-dir /path/to/audio/
```

### **Service Management**
```bash
# View running services
docker-compose ps

# View logs  
docker-compose logs -f orchestrator
docker-compose logs -f whisper-service

# Restart specific service
docker-compose restart wav2vec-service

# Scale services
docker-compose up -d --scale whisper-service=3
```

---

## ⚙️ Tech Stack Overview

### Frontend
- **React 18** with **TypeScript** for modern UI development
- **Tailwind CSS** + **Shadcn/UI** for beautiful, accessible components  
- **Supabase Client** for direct database integration
- **VIM Mode Support** for power users and accessibility

### Backend & ASR
- **FastAPI** for high-performance API routing and async processing
- **6 Parallel ASR Models**: Whisper, Wav2Vec, Moonshine, Mesolitica, Vosk, Allosaurus
- **Docker Microservices** for scalable, fault-tolerant architecture
- **Gemini 2.0 Flash** for AI consensus analysis and NLP enhancement

### AI & Analysis  
- **Multi-Strategy Aggregation**: Majority voting + confidence weighting
- **Cultural Particle Detection**: IPA phoneme analysis for accent markers
- **Web Validation**: Tavily API for fact-checking and proper noun correction
- **Semantic Enhancement**: Context understanding and grammar refinement

### Storage & Data
- **Supabase PostgreSQL** for user data and validated transcriptions
- **Supabase Storage** for audio file management
- **Local Processing** with automatic cleanup for privacy
- **JSONL Logging** for complete audit trails and research data

### Infrastructure
- **Docker Compose** for multi-container orchestration
- **Redis** for autocomplete caching and session management  
- **Supabase Authentication** for user management and secure access
- **Automated Health Monitoring** across all microservices

---

## 🏗️ System Architecture & Features

### **📊 Core Processing Capabilities:**

**🎙️ Multi-Model ASR Pipeline:**
- ✅ **6 Parallel ASR Models** running simultaneously in Docker containers
- ✅ **Advanced AI Consensus** using Gemini 2.0 Flash for intelligent aggregation
- ✅ **Cultural Particle Detection** across Southeast Asian, British, North American accents
- ✅ **IPA Phoneme Analysis** using Allosaurus for linguistic research accuracy
- ✅ **Web Validation** via Tavily API for proper noun and technical term verification

**🎮 Gamification & Validation:**
- ✅ **Human-in-the-Loop Validation** with A/B testing interface
- ✅ **Crowd Validation System** with user feedback and scoring mechanisms
- ✅ **Practice Mode** with pre-validated clips for educational purposes
- ✅ **Real-time Autocomplete** with confidence-based suggestions
- ✅ **User Progress Tracking** and validation accuracy metrics

**🔬 Research & Analysis Features:**
- ✅ **Accent Diversity Analysis** through discourse particle distribution
- ✅ **Dataset Export** in Common Voice TSV format with enhanced metadata
- ✅ **Performance Benchmarking** with Word Error Rate (WER) calculations
- ✅ **Mixed-Method Evaluation** combining quantitative and qualitative assessment
- ✅ **Privacy-First Architecture** with local processing and automatic cleanup

### **Service Status & Architecture:**
| Service Type | Count | Ports | Status |
|-------------|-------|-------|---------|
| **ASR Models** | 6 | 8001-8006 | ✅ All Operational |
| **Orchestrator** | 1 | 8000 | ✅ Advanced Pipeline Working |
| **Autocomplete** | 1 | 8007 | ✅ Redis Integration Complete |
| **Frontend** | 1 | 3000 | ✅ React + Supabase Integrated |
| **Total Endpoints** | **25+** | - | **All Systems Operational** |

## Complete API Endpoints Summary

### **🎯 Orchestrator Service (Port 8000)**
**Main ASR Processing & LLM Analysis**

| Endpoint | Method | Description | Status |
|----------|--------|-------------|---------|
| `/health` | GET | Health check for all ASR services | ✅ Working |
| `/models` | GET | List available ASR models | ✅ Working |
| `/transcribe` | POST | Parallel transcription across all models | ✅ Working |
| `/transcribe-consensus` | POST | **Stage 1: Multi-model consensus with web validation** | ✅ Working |
| `/transcribe-with-particles` | POST | **Stage 2: Accent-specific discourse particle detection** | ✅ Working |
| `/transcribe/debug` | POST | Full diagnostic transcription with ASR model details | ✅ Working |
| `/initialize-autocomplete` | POST | Initialize autocomplete service with transcription data | ✅ Working |

**Key Features:**
- **Two-Stage Pipeline Architecture**: Stage 1 (Consensus) → Stage 2 (Particle Detection)
- **Stage 1 Features**: Multi-model consensus, web validation via Tavily API, A-B choice system
- **Stage 2 Features**: Accent-specific particle detection, cultural discourse analysis
- **Multi-model Consensus**: Combines results from 6 ASR models with confidence weighting
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
| `/suggest/position` | GET | Position-based word suggestions | ✅ Working |
| `/suggest/prefix` | GET | Prefix-based text completion | ✅ Working |

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
| **Autocomplete** | 1 | 8007 | ✅ Redis Integration Working |
| **Total Endpoints** | **25+** | - | **All Systems Operational** |

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
