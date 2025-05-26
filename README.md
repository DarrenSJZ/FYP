# YouTube Clip Transcription and Annotation Platform

## Project Objectives

This project aims to create a crowd-sourced transcription platform for YouTube videos, similar to OpenSubtitles but with a focus on accuracy and community validation. The platform will help create high-quality transcriptions for YouTube content through a combination of ASR models, LLM processing, and human validation.

### Core Features

1. **YouTube Clip Extraction**
   - Browser extension for easy clip creation from YouTube videos
   - Similar to Twitch's clipping functionality
   - Enables users to select and save specific segments of videos

2. **Multi-Model ASR Pipeline**
   - Currently implements 5 different ASR models:
     - Wav2Vec
     - Whisper
     - DeepSpeech
     - Moonshine
     - Mesolitica
   - Each model runs in its own isolated virtual environment
   - Models are containerized for consistent performance and easy deployment

3. **LLM-Enhanced Transcription**
   - ASR model outputs are processed through an LLM
   - Integration with Tavily search API for context-aware corrections
   - LLM helps clean and standardize transcriptions
   - Reduces common ASR errors and improves accuracy

4. **Community Annotation Tool**
   - Interactive interface for human validation and correction
   - Smart autocomplete suggestions (similar to GitHub Copilot)
   - Tab-completion workflow:
     - Users can accept LLM-suggested completions with Tab
     - Manual edits become new ground truth if suggestions are rejected
   - Community moderation system for validation

5. **Ground Truth Management**
   - Validated transcriptions become the new ground truth
   - Community moderation ensures quality
   - Version control for transcription history
   - Confidence scoring based on validation count

### Technical Implementation

The current implementation uses a microservices architecture:
- FastAPI backend for handling clip processing and transcription
- Isolated virtual environments for each ASR model
- Google Cloud Storage for audio file management
- Supabase for database and authentication
- Future plans for Docker containerization of ASR models

### Future Goals

1. **Docker Integration**
   - Containerize ASR models for better isolation and deployment
   - Implement Kubernetes for orchestration
   - Enable horizontal scaling of transcription services

2. **Enhanced LLM Integration**
   - Implement more sophisticated prompt engineering
   - Add context-aware corrections
   - Improve handling of domain-specific terminology

3. **Community Features**
   - Reputation system for validators
   - Gamification elements
   - Quality metrics and reporting

4. **API Development**
   - Public API for third-party integration
   - Webhook support for automated workflows
   - Rate limiting and usage tracking

# FYP
## ASR MODELS USED
    - Moonshine
    - Deepspeech
    - Pykaldi
    - Whisper
    - Mesolitica
## How to use
    1.  
    2.
    3.

